// ============================================================================
// RIDECONNECT API GATEWAY & WEBSOCKET COORDINATOR
// ============================================================================
// This component forms the absolute entry point of the platform.
// 1. App Express Server: Exposes JSON REST endpoints to fetch registries (users, drivers, active metrics).
// 2. Socket.io WebSocket Server: Provides real-time bidirectional telemetry streams.
// 3. Real-Time GPS Route Simulator: Periodically calculates vectors towards pickup and
//    destination coordinates, updating positions smoothly.
// ============================================================================

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { KAFKA_TOPICS, EVENT_TYPES, Location } from 'shared';
import EventBus from '../eventbus/eventbus.js';
import AuthService from '../services/auth.service.js';
import DriverService from '../services/driver.service.js';
import RideService from '../services/ride.service.js';
import AnalyticsService from '../services/analytics.service.js';

export function startGatewayServer(port: number) {
  // Initialize Express HTTP container and tie it to standard Node Server
  const app = express();
  const httpServer = createServer(app);

  // In-memory chat storage
  const onlineUsers = new Map<string, string>(); // socket.id -> username
  const chatHistory: any[] = []; // Last 50 messages

  // ---- Walkie-Talkie In-Memory State ----
  interface WalkieMember {
    socketId: string;
    username: string;
    ip: string;
    city: string;
    country: string;
    countryCode: string;
    lat: number;
    lng: number;
    joinedAt: string;
    isTalking: boolean;
  }
  interface WalkieRoom {
    id: string;
    name: string;
    creatorId: string;
    creatorName: string;
    password?: string;
    maxUsers: number;
    members: WalkieMember[];
    createdAt: string;
    talkingSocketId?: string;
  }
  const walkieRooms = new Map<string, WalkieRoom>(); // roomId -> room
  const socketToWalkieRoom = new Map<string, string>(); // socketId -> roomId

  // Enable Cross-Origin Resource Sharing (CORS) and standard JSON body parsers
  app.use(cors());
  app.use(express.json());

  // WebSocket Server Setup bound to our Express HTTP server instance
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || '*', // Configurable for production
      methods: ['GET', 'POST'],
    },
  });

  // ==========================================================================
  // REST API DEFINITIONS
  // ==========================================================================

  // GET /api/users: Fetches pre-seeded Passenger registries
  app.get('/api/users', (req, res) => {
    res.json(AuthService.getUsers());
  });

  // GET /api/drivers: Fetches pre-seeded Driver registries
  app.get('/api/drivers', (req, res) => {
    res.json(AuthService.getDrivers());
  });

  // GET /api/rides/active: Retrieves active trip vectors in memory
  app.get('/api/rides/active', (req, res) => {
    res.json(RideService.getActiveRides());
  });

  // GET /api/analytics/metrics: Pulls real-time aggregated system operational data
  app.get('/api/analytics/metrics', (req, res) => {
    res.json(AnalyticsService.getMetricsSummary());
  });

  // GET /api/analytics/fraud: Pulls active security alerts (e.g. GPS jumps)
  app.get('/api/analytics/fraud', (req, res) => {
    res.json(AnalyticsService.getFraudAlerts());
  });

  // POST /api/rides/request: Endpoint used by passengers to instantiate a trip
  app.post('/api/rides/request', (req, res) => {
    const { passengerId, pickup, destination } = req.body;
    const ride = RideService.requestRide(passengerId, pickup, destination);
    if (!ride) {
      return res.status(400).json({ error: 'Failed to create ride request' });
    }
    // Return standard HTTP 201 Created
    res.status(201).json(ride);
  });

  // POST /api/drivers/:id/status: Updates duty status (e.g. going online/offline)
  app.post('/api/drivers/:id/status', (req, res) => {
    const { status } = req.body;
    const driverId = req.params.id;
    const driver = DriverService.updateStatus(driverId, status);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json(driver);
  });

  // Serve static assets from frontend build directory in production if it exists
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const frontendBuildPath = path.resolve(__dirname, '../../../frontend/dist');

  if (fs.existsSync(path.join(frontendBuildPath, 'index.html'))) {
    console.log(`[Gateway] Production mode detected. Serving frontend from: ${frontendBuildPath}`);
    app.use(express.static(frontendBuildPath));
    app.get('*', (req, res, next) => {
      // Let API requests fall through to 404 or original handlers
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
  }

  // ==========================================================================
  // WEBSOCKET LOGIC / EVENT ROOMS COORDINATOR
  // ==========================================================================

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join specific rooms depending on user type on connection
    socket.on('register', (data: { role: 'PASSENGER' | 'DRIVER' | 'SYSTEM'; id?: string }) => {
      if (data.role === 'PASSENGER' && data.id) {
        // Passengers join an isolated room targeted to their user ID
        socket.join(`user:${data.id}`);
        console.log(`[Socket] Registered Passenger in room: user:${data.id}`);
      } else if (data.role === 'DRIVER' && data.id) {
        // Drivers join a room targeted to their driver ID
        socket.join(`driver:${data.id}`);
        console.log(`[Socket] Registered Driver in room: driver:${data.id}`);
      } else if (data.role === 'SYSTEM') {
        // System operations join a broad system events broadcast group
        socket.join('system:events');
        console.log('[Socket] Registered Admin Console in room: system:events');
      }
    });

    // Handle manual GPS updates from active driving clients
    socket.on('driver:location_ping', (data: { driverId: string; location: Location }) => {
      DriverService.updateLocation(data.driverId, data.location);
    });

    // Handle ride accept triggers published by driving clients
    socket.on('ride:accept', (data: { rideId: string; driverId: string }) => {
      const ride = RideService.assignDriver(data.rideId, data.driverId);
      if (ride) {
        // Notify all clients listening on this specific ride room
        io.to(`ride:${data.rideId}`).emit('ride:status_updated', ride);
      }
    });

    // --- Live Chat Room Events ---
    socket.on('chat:join', (data: { username: string }) => {
      const username = data.username.trim();
      if (!username) return;

      // Map socket to username
      onlineUsers.set(socket.id, username);
      socket.join('chat:global');

      console.log(`[Chat] User ${username} joined chat:global`);

      // Broadcast updated online members list to room
      const members = Array.from(new Set(onlineUsers.values()));
      io.to('chat:global').emit('chat:online_users', members);

      // Send chat history back to new joiner
      socket.emit('chat:history', chatHistory);

      // Publish a system notice message to other users
      const systemMessage = {
        id: `sys-${Date.now()}`,
        username: 'System',
        text: `${username} entered the chat room.`,
        timestamp: new Date().toISOString(),
        readBy: [username],
        isSystem: true
      };
      chatHistory.push(systemMessage);
      if (chatHistory.length > 50) chatHistory.shift();
      io.to('chat:global').emit('chat:message', systemMessage);
    });

    socket.on('chat:message', (data: { text: string; username: string }) => {
      const { text, username } = data;
      if (!text.trim() || !username.trim()) return;

      const message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        username,
        text: text.trim(),
        timestamp: new Date().toISOString(),
        readBy: [username], // author has automatically read it
      };

      // Cache message in running history list (trim threshold 50)
      chatHistory.push(message);
      if (chatHistory.length > 50) chatHistory.shift();

      // Broadcast new message to chat channel
      io.to('chat:global').emit('chat:message', message);
    });

    socket.on('chat:typing', (data: { username: string; isTyping: boolean }) => {
      // Broadcast typing indicator status to other room listeners
      socket.to('chat:global').emit('chat:typing', data);
    });

    socket.on('chat:read', (data: { username: string }) => {
      const { username } = data;
      if (!username) return;

      let updated = false;
      chatHistory.forEach((msg) => {
        if (!msg.readBy.includes(username)) {
          msg.readBy.push(username);
          updated = true;
        }
      });

      if (updated) {
        // Broadcast the updated message list back so read receipts synchronize immediately
        io.to('chat:global').emit('chat:read_receipts', chatHistory);
      }
    });

    socket.on('chat:react', (data: { messageId: string; username: string; emoji: string }) => {
      const { messageId, username, emoji } = data;
      if (!messageId || !username || !emoji) return;

      // Find targeted message in active cache history
      const msg = chatHistory.find((m) => m.id === messageId);
      if (msg) {
        if (!msg.reactions) {
          msg.reactions = {};
        }

        if (!msg.reactions[emoji]) {
          msg.reactions[emoji] = [];
        }

        const userIndex = msg.reactions[emoji].indexOf(username);
        if (userIndex > -1) {
          // Toggle reaction off if clicked again
          msg.reactions[emoji].splice(userIndex, 1);
          if (msg.reactions[emoji].length === 0) {
            delete msg.reactions[emoji]; // Clean empty keys
          }
        } else {
          // Add username to this emoji reaction list
          msg.reactions[emoji].push(username);
        }

        // Broadcast updated cache history back to room to synchronize seen and emoji counts
        io.to('chat:global').emit('chat:read_receipts', chatHistory);
      }
    });

    // =========================================================================
    // WALKIE-TALKIE VOICE HUB SOCKET EVENTS
    // =========================================================================

    // Helper: broadcast room list to all connected clients
    const broadcastRoomsList = () => {
      const roomList = Array.from(walkieRooms.values()).map((r) => ({
        ...r,
        password: r.password ? '***' : undefined, // mask password
        isLocked: !!r.password,
        memberCount: r.members.length,
      }));
      io.emit('walkie:rooms_list', roomList);
    };

    // Helper: auto-leave any current walkie room for this socket
    const leaveWalkieRoom = (sid: string) => {
      const currentRoomId = socketToWalkieRoom.get(sid);
      if (!currentRoomId) return;

      const room = walkieRooms.get(currentRoomId);
      if (room) {
        room.members = room.members.filter((m) => m.socketId !== sid);
        // If talking user disconnected, clear talking state
        if (room.talkingSocketId === sid) {
          room.talkingSocketId = undefined;
        }
        if (room.members.length === 0) {
          // Delete empty room
          walkieRooms.delete(currentRoomId);
          console.log(`[Walkie] Room "${room.name}" destroyed (empty).`);
        } else {
          // Notify remaining members
          io.to(`walkie:${currentRoomId}`).emit('walkie:room_state', room);
          console.log(`[Walkie] Socket ${sid} left room "${room.name}".`);
        }
        broadcastRoomsList();
      }
      socketToWalkieRoom.delete(sid);
      socket.leave(`walkie:${currentRoomId}`);
    };

    // walkie:get_rooms — client requests fresh room list
    socket.on('walkie:get_rooms', () => {
      broadcastRoomsList();
    });

    // walkie:create_room — client creates a new voice room
    socket.on('walkie:create_room', (data: {
      name: string;
      username: string;
      password?: string;
      maxUsers?: number;
      meta?: { ip: string; city: string; country: string; countryCode: string; lat: number; lng: number };
    }) => {
      const { name, username, password, maxUsers, meta } = data;
      if (!name?.trim() || !username?.trim()) return;

      // Leave any existing walkie room first
      leaveWalkieRoom(socket.id);

      const roomId = `walkie-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const rawIp = (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || socket.handshake.address
        || '127.0.0.1';

      const member: WalkieMember = {
        socketId: socket.id,
        username,
        ip: rawIp,
        city: meta?.city || 'Local',
        country: meta?.country || 'Network',
        countryCode: meta?.countryCode || 'LO',
        lat: meta?.lat || 0,
        lng: meta?.lng || 0,
        joinedAt: new Date().toISOString(),
        isTalking: false,
      };

      const room: WalkieRoom = {
        id: roomId,
        name: name.trim(),
        creatorId: socket.id,
        creatorName: username,
        password,
        maxUsers: maxUsers || 10,
        members: [member],
        createdAt: new Date().toISOString(),
      };

      walkieRooms.set(roomId, room);
      socketToWalkieRoom.set(socket.id, roomId);
      socket.join(`walkie:${roomId}`);
      socket.emit('walkie:room_state', room);
      broadcastRoomsList();
      console.log(`[Walkie] Room "${name}" created by ${username}`);
    });

    // walkie:join_room — client joins an existing room
    socket.on('walkie:join_room', (data: {
      roomId: string;
      username: string;
      password?: string;
      meta?: { ip: string; city: string; country: string; countryCode: string; lat: number; lng: number };
    }) => {
      const { roomId, username, password, meta } = data;
      const room = walkieRooms.get(roomId);
      if (!room) {
        socket.emit('walkie:error', { message: 'Room not found.' });
        return;
      }
      if (room.password && room.password !== password) {
        socket.emit('walkie:error', { message: 'Incorrect room password.' });
        return;
      }
      if (room.members.length >= room.maxUsers) {
        socket.emit('walkie:error', { message: 'Room is full.' });
        return;
      }

      // Leave any existing walkie room first
      leaveWalkieRoom(socket.id);

      const rawIp = (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || socket.handshake.address
        || '127.0.0.1';

      const member: WalkieMember = {
        socketId: socket.id,
        username,
        ip: rawIp,
        city: meta?.city || 'Local',
        country: meta?.country || 'Network',
        countryCode: meta?.countryCode || 'LO',
        lat: meta?.lat || 0,
        lng: meta?.lng || 0,
        joinedAt: new Date().toISOString(),
        isTalking: false,
      };

      room.members.push(member);
      socketToWalkieRoom.set(socket.id, roomId);
      socket.join(`walkie:${roomId}`);

      // Notify all in room of new member
      io.to(`walkie:${roomId}`).emit('walkie:room_state', room);

      // Tell joining peer about all existing peers so it can initiate WebRTC offers
      const existingPeers = room.members
        .filter((m) => m.socketId !== socket.id)
        .map((m) => m.socketId);
      socket.emit('walkie:existing_peers', existingPeers);

      broadcastRoomsList();
      console.log(`[Walkie] ${username} joined room "${room.name}"`);
    });

    // walkie:leave_room — explicit leave
    socket.on('walkie:leave_room', () => {
      leaveWalkieRoom(socket.id);
    });

    // walkie:chat_message — broadcast text message to voice channel room participants
    socket.on('walkie:chat_message', (data: { roomId: string; username: string; text: string }) => {
      console.log(`[WalkieChat:Backend] Received message payload on socket ${socket.id}:`, data);
      const { roomId, username, text } = data;
      if (!roomId || !username || !text?.trim()) {
        console.warn('[WalkieChat:Backend] Invalid chat payload. Ignoring.');
        return;
      }

      const message = {
        user: username,
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      console.log(`[WalkieChat:Backend] Broadcasting chat message to room walkie:${roomId}`);
      io.to(`walkie:${roomId}`).emit('walkie:chat_message', message);
    });

    // walkie:offer — forward WebRTC offer to target peer
    socket.on('walkie:offer', (data: { to: string; offer: RTCSessionDescriptionInit }) => {
      io.to(data.to).emit('walkie:offer', { from: socket.id, offer: data.offer });
    });

    // walkie:answer — forward WebRTC answer to target peer
    socket.on('walkie:answer', (data: { to: string; answer: RTCSessionDescriptionInit }) => {
      io.to(data.to).emit('walkie:answer', { from: socket.id, answer: data.answer });
    });

    // walkie:ice — forward ICE candidate to target peer
    socket.on('walkie:ice', (data: { to: string; candidate: RTCIceCandidateInit }) => {
      io.to(data.to).emit('walkie:ice', { from: socket.id, candidate: data.candidate });
    });

    // walkie:talking_start — user pressed PTT button
    socket.on('walkie:talking_start', () => {
      const roomId = socketToWalkieRoom.get(socket.id);
      if (!roomId) return;
      const room = walkieRooms.get(roomId);
      if (!room) return;

      // Only one person can talk at a time (walkie-talkie style)
      if (room.talkingSocketId && room.talkingSocketId !== socket.id) return;

      room.talkingSocketId = socket.id;
      room.members.forEach((m) => {
        m.isTalking = m.socketId === socket.id;
      });

      io.to(`walkie:${roomId}`).emit('walkie:talking_changed', {
        socketId: socket.id,
        isTalking: true,
        room,
      });
    });

    // walkie:talking_stop — user released PTT button
    socket.on('walkie:talking_stop', () => {
      const roomId = socketToWalkieRoom.get(socket.id);
      if (!roomId) return;
      const room = walkieRooms.get(roomId);
      if (!room) return;

      if (room.talkingSocketId === socket.id) {
        room.talkingSocketId = undefined;
        room.members.forEach((m) => { m.isTalking = false; });
        io.to(`walkie:${roomId}`).emit('walkie:talking_changed', {
          socketId: socket.id,
          isTalking: false,
          room,
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      
      const username = onlineUsers.get(socket.id);
      if (username) {
        // Clear mapping references
        onlineUsers.delete(socket.id);
        
        // Broadcast updated list
        const members = Array.from(new Set(onlineUsers.values()));
        io.to('chat:global').emit('chat:online_users', members);

        // System notice exit log
        const exitMessage = {
          id: `sys-${Date.now()}`,
          username: 'System',
          text: `${username} left the chat room.`,
          timestamp: new Date().toISOString(),
          readBy: [],
          isSystem: true
        };
        chatHistory.push(exitMessage);
        if (chatHistory.length > 50) chatHistory.shift();
        io.to('chat:global').emit('chat:message', exitMessage);
      }

      // Auto-cleanup walkie room membership on disconnect
      leaveWalkieRoom(socket.id);
    });
  });


  // ==========================================================================
  // STREAM RELAYS: KAFKA -> GATEWAY -> CLIENT SOCKET ROOMS
  // ==========================================================================
  // This forward callback subscribes the API Gateway directly to the Event Bus.
  // When an event is published on a Kafka topic, the gateway relays it to the
  // corresponding WebSocket rooms.

  const forwardEvent = (topic: string, envelope: any) => {
    // 1. Relay all transactions to the System operations monitor for the event logs scroll
    io.to('system:events').emit('system:kafka_event', envelope);

    // 2. Direct-Targeting Room Relays:
    const payload = envelope.payload;
    
    // Relay ride-specific notifications
    if (topic === KAFKA_TOPICS.RIDE) {
      if (payload.id) {
        io.to(`ride:${payload.id}`).emit('ride:status_updated', payload);
      }
      if (payload.passengerId) {
        io.to(`user:${payload.passengerId}`).emit('ride:status_updated', payload);
      }
      if (payload.driverId) {
        io.to(`driver:${payload.driverId}`).emit('ride:dispatch_offer', payload);
        io.to(`driver:${payload.driverId}`).emit('ride:status_updated', payload);
      }
    } 
    // Relay driver-specific geospatial telemetry
    else if (topic === KAFKA_TOPICS.DRIVER) {
      io.to('system:events').emit('driver:location_changed', payload);
      if (payload.currentRideId) {
        io.to(`ride:${payload.currentRideId}`).emit('driver:location_changed', payload);
      }
    } 
    // Relay push notification structures
    else if (topic === KAFKA_TOPICS.NOTIFICATION) {
      io.to(`user:${payload.userId}`).emit('notification:received', payload);
    }
  };

  // Bind Kafka subscriptions at Gateway level
  Object.values(KAFKA_TOPICS).forEach((topic) => {
    EventBus.subscribe(topic, (envelope) => forwardEvent(topic, envelope));
  });

  // Bind Cache updates (Redis activity) to System console logs
  EventBus.registerSystemLogListener((logItem) => {
    io.to('system:events').emit('system:log', logItem);
  });

  // ==========================================================================
  // REAL-TIME GPS VECTOR ROUTE SIMULATOR (Ticking at 1000ms intervals)
  // ==========================================================================
  // If a driver is assigned to a trip, they must navigate Manhattan streets.
  // Instead of static state skips, this tick calculates real-time step movements
  // towards pickup and dropoff points, publishing coordinates every 1000ms.

  setInterval(() => {
    const rides = RideService.getActiveRides();

    rides.forEach((ride) => {
      // Ignore rides without active driver assignments
      if (!ride.driverId) return;
      const driver = AuthService.getDriver(ride.driverId);
      if (!driver) return;

      let target: Location;
      let stepSpeed = 0.001; // Step vector in Lat/Lng degrees (approx 100 meters per step)

      // Sub-State: Driver is traveling to Passenger's pickup pin
      if (ride.status === 'DRIVER_ASSIGNED') {
        target = ride.pickup;
        const dist = getCoordinateDistance(driver.location, target);

        // Check if vehicle has reached pickup coordinates (close margin)
        if (dist < 0.0008) {
          // Trigger arrival state transition inside state machine
          RideService.arriveAtPickup(ride.id);
          
          // Wait 3 seconds at the curb to let the passenger enter the vehicle
          setTimeout(() => {
            RideService.startRide(ride.id);
          }, 3000);
        } else {
          // Incrementally calculate next coordinates step (Linear Interpolation vector)
          const nextLocation = lerpLocation(driver.location, target, stepSpeed);
          DriverService.updateLocation(driver.id, nextLocation);
          
          // Synchronize ride data coordinate states
          ride.driverLocation = nextLocation;
          io.to(`ride:${ride.id}`).emit('ride:status_updated', ride);
        }
      } 
      // Sub-State: Passenger is inside, driving to final dropoff Destination
      else if (ride.status === 'STARTED') {
        target = ride.destination;
        const dist = getCoordinateDistance(driver.location, target);

        // Check if vehicle has reached dropoff coordinates
        if (dist < 0.0008) {
          // Trigger complete trip lifecycle transitions (payments + driver release)
          RideService.completeRide(ride.id);
        } else {
          // Move vehicle vector closer to dropoff coordinates
          const nextLocation = lerpLocation(driver.location, target, stepSpeed);
          DriverService.updateLocation(driver.id, nextLocation);
          
          ride.driverLocation = nextLocation;
          io.to(`ride:${ride.id}`).emit('ride:status_updated', ride);
        }
      }
    });

    // Simulated Auto-Dispatch loop for non-manual driver simulation:
    // When a passenger posts a RIDE_REQUESTED state, find the nearest online driver,
    // wait 2 seconds, and auto-assign them to demonstrate a working system immediately.
    rides.forEach((ride) => {
      if (ride.status === 'REQUESTED') {
        const nearby = DriverService.findNearbyDrivers(ride.pickup, 10.0);
        if (nearby.length > 0) {
          const matchedDriver = nearby[0].driver;
          
          // Lock state to SEARCHING_DRIVER to prevent matching duplicate triggers
          ride.status = 'SEARCHING_DRIVER';
          
          // Dispatch assignment offer in 2000ms
          setTimeout(() => {
            RideService.assignDriver(ride.id, matchedDriver.id);
          }, 2000);
        }
      }
    });
  }, 1000);

  // Helper: Linear Interpolation (Lerp) coordinate steps vector calculation
  function lerpLocation(current: Location, target: Location, step: number): Location {
    const dLat = target.lat - current.lat;
    const dLng = target.lng - current.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);

    // If remaining distance is less than step size, jump directly to target
    if (dist <= step) return target;

    // Calculate normalized direction vectors and step forward
    return {
      lat: current.lat + (dLat / dist) * step,
      lng: current.lng + (dLng / dist) * step,
    };
  }

  // Helper: Euclidean distance vector calculation in coordinate space
  function getCoordinateDistance(loc1: Location, loc2: Location): number {
    const dLat = loc1.lat - loc2.lat;
    const dLng = loc1.lng - loc2.lng;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  // Bind HTTP server to listen on port
  httpServer.listen(port, () => {
    console.log(`[Gateway] Express & Socket.io server running on port ${port}`);
  });
}
