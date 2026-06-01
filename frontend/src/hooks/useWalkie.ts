// ============================================================================
// useWalkie — WebRTC + Socket.io Walkie-Talkie Hook
// ============================================================================
// Manages:
//   • WebRTC PeerConnection mesh (one per remote peer in the room)
//   • Local microphone MediaStream
//   • AudioAnalyserNode for per-frame volume level readouts
//   • PTT (Push-to-Talk) state machine
//   • Geo-location fetch on first use
//   • All Socket.io walkie:* event bindings
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';

// ---- Types ----
export interface WalkieMember {
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

export interface WalkieRoom {
  id: string;
  name: string;
  creatorId: string;
  creatorName: string;
  isLocked?: boolean;
  maxUsers: number;
  members: WalkieMember[];
  createdAt: string;
  talkingSocketId?: string;
  memberCount?: number;
}

export interface GeoMeta {
  ip: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWalkie(socket: Socket | null, username: string) {
  // --- State ---
  const [rooms, setRooms] = useState<WalkieRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<WalkieRoom | null>(null);
  const [isTalking, setIsTalking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micGranted, setMicGranted] = useState(false);
  const [geoMeta, setGeoMeta] = useState<GeoMeta | null>(null);
  const [volumeLevels, setVolumeLevels] = useState<Record<string, number>>({}); // socketId -> 0-1

  // --- Refs (not re-render-triggering) ---
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserFrameRef = useRef<number>(0);
  const pttActiveRef = useRef(false);

  // ---- Geo + IP Resolution ----
  useEffect(() => {
    const fetchGeo = async () => {
      try {
        const res = await fetch('https://ip-api.com/json/?fields=status,country,countryCode,city,lat,lon,query');
        const data = await res.json();
        if (data.status === 'success') {
          setGeoMeta({
            ip: data.query,
            city: data.city,
            country: data.country,
            countryCode: data.countryCode,
            lat: data.lat,
            lng: data.lon,
          });
        } else {
          setGeoMeta({ ip: '127.0.0.1', city: 'Local', country: 'Network', countryCode: 'LO', lat: 0, lng: 0 });
        }
      } catch {
        setGeoMeta({ ip: '127.0.0.1', city: 'Local', country: 'Network', countryCode: 'LO', lat: 0, lng: 0 });
      }
    };
    fetchGeo();
  }, []);

  // ---- Mic Access ----
  const requestMic = useCallback(async (): Promise<boolean> => {
    if (localStreamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;

      // Set up AudioContext + Analyser for local volume
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Mute all tracks by default (PTT model — only unmute when transmitting)
      stream.getAudioTracks().forEach((t) => { t.enabled = false; });

      setMicGranted(true);
      return true;
    } catch {
      setError('Microphone access denied. Please allow microphone access to use Voice Hub.');
      return false;
    }
  }, []);

  // ---- Volume Analysis Loop ----
  useEffect(() => {
    const tick = () => {
      if (analyserRef.current) {
        const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        const normalized = Math.min(avg / 128, 1);
        if (pttActiveRef.current) {
          setVolumeLevels((prev) => ({ ...prev, local: normalized }));
        }
      }
      analyserFrameRef.current = requestAnimationFrame(tick);
    };
    analyserFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(analyserFrameRef.current);
  }, []);

  // ---- WebRTC Peer Creation ----
  const createPeer = useCallback((remoteSocketId: string, initiator: boolean): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_CONFIG);

    // Add local audio tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // ICE candidate relay
    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('walkie:ice', { to: remoteSocketId, candidate: e.candidate.toJSON() });
      }
    };

    // Remote audio track received
    pc.ontrack = (e) => {
      let audioEl = remoteAudiosRef.current.get(remoteSocketId);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        remoteAudiosRef.current.set(remoteSocketId, audioEl);
      }
      audioEl.srcObject = e.streams[0];
    };

    // If initiator, create and send offer
    if (initiator) {
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        socket?.emit('walkie:offer', { to: remoteSocketId, offer });
      });
    }

    peersRef.current.set(remoteSocketId, pc);
    return pc;
  }, [socket]);

  // ---- Cleanup All Peers ----
  const cleanupPeers = useCallback(() => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    remoteAudiosRef.current.forEach((el) => { el.srcObject = null; });
    remoteAudiosRef.current.clear();
  }, []);

  // ---- PTT Controls ----
  const startTalking = useCallback(() => {
    if (!localStreamRef.current || isMuted) return;
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = true; });
    pttActiveRef.current = true;
    setIsTalking(true);
    socket?.emit('walkie:talking_start');
  }, [socket, isMuted]);

  const stopTalking = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
    pttActiveRef.current = false;
    setIsTalking(false);
    socket?.emit('walkie:talking_stop');
  }, [socket]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      if (!prev && isTalking) stopTalking();
      return !prev;
    });
  }, [isTalking, stopTalking]);

  // ---- Room Actions ----
  const fetchRooms = useCallback(() => {
    socket?.emit('walkie:get_rooms');
  }, [socket]);

  const createRoom = useCallback(async (name: string, password?: string, maxUsers?: number) => {
    const ok = await requestMic();
    if (!ok) return;
    socket?.emit('walkie:create_room', {
      name,
      username,
      password,
      maxUsers,
      meta: geoMeta,
    });
  }, [socket, username, geoMeta, requestMic]);

  const joinRoom = useCallback(async (roomId: string, password?: string) => {
    const ok = await requestMic();
    if (!ok) return;
    socket?.emit('walkie:join_room', {
      roomId,
      username,
      password,
      meta: geoMeta,
    });
  }, [socket, username, geoMeta, requestMic]);

  const leaveRoom = useCallback(() => {
    cleanupPeers();
    stopTalking();
    socket?.emit('walkie:leave_room');
    setActiveRoom(null);
    setVolumeLevels({});
  }, [socket, cleanupPeers, stopTalking]);

  // ---- Socket Event Listeners ----
  useEffect(() => {
    if (!socket) return;

    const onRoomsList = (list: WalkieRoom[]) => setRooms(list);

    const onRoomState = (room: WalkieRoom) => {
      setActiveRoom({ ...room });
    };

    const onTalkingChanged = (data: { socketId: string; isTalking: boolean; room: WalkieRoom }) => {
      setActiveRoom({ ...data.room });
      if (!data.isTalking) {
        setVolumeLevels((prev) => {
          const next = { ...prev };
          delete next[data.socketId];
          return next;
        });
      }
    };

    const onExistingPeers = (peerIds: string[]) => {
      // New joiner initiates an offer to every existing peer
      peerIds.forEach((peerId) => {
        if (!peersRef.current.has(peerId)) {
          createPeer(peerId, true);
        }
      });
    };

    const onOffer = async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      let pc = peersRef.current.get(data.from);
      if (!pc) {
        pc = createPeer(data.from, false);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('walkie:answer', { to: data.from, answer });
    };

    const onAnswer = async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peersRef.current.get(data.from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    const onIce = async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peersRef.current.get(data.from);
      if (pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch { /* ignore stale candidates */ }
      }
    };

    const onError = (data: { message: string }) => setError(data.message);

    socket.on('walkie:rooms_list', onRoomsList);
    socket.on('walkie:room_state', onRoomState);
    socket.on('walkie:talking_changed', onTalkingChanged);
    socket.on('walkie:existing_peers', onExistingPeers);
    socket.on('walkie:offer', onOffer);
    socket.on('walkie:answer', onAnswer);
    socket.on('walkie:ice', onIce);
    socket.on('walkie:error', onError);

    // Kick off initial room list fetch
    socket.emit('walkie:get_rooms');

    return () => {
      socket.off('walkie:rooms_list', onRoomsList);
      socket.off('walkie:room_state', onRoomState);
      socket.off('walkie:talking_changed', onTalkingChanged);
      socket.off('walkie:existing_peers', onExistingPeers);
      socket.off('walkie:offer', onOffer);
      socket.off('walkie:answer', onAnswer);
      socket.off('walkie:ice', onIce);
      socket.off('walkie:error', onError);
    };
  }, [socket, createPeer]);

  // ---- Spacebar PTT Keybinding ----
  useEffect(() => {
    if (!activeRoom) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !pttActiveRef.current) {
        e.preventDefault();
        startTalking();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        stopTalking();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activeRoom, startTalking, stopTalking]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      cleanupPeers();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, [cleanupPeers]);

  return {
    rooms,
    activeRoom,
    isTalking,
    isMuted,
    micGranted,
    error,
    geoMeta,
    volumeLevels,
    fetchRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    startTalking,
    stopTalking,
    toggleMute,
    clearError: () => setError(null),
  };
}
