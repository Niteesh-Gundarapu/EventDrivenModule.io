import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:5000';

export function useSocket(role: 'PASSENGER' | 'DRIVER' | 'SYSTEM', id?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket gateway
    const socket = io(GATEWAY_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log(`[Socket] Connected to gateway. Registering as ${role}...`);
      
      // Register role with Gateway so we are joined to relevant rooms
      socket.emit('register', { role, id });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket] Disconnected from gateway');
    });

    return () => {
      socket.disconnect();
    };
  }, [role, id]);

  const emit = (event: string, data: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  };

  const on = (event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
    // Return cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  };

  return {
    socket: socketRef.current,
    isConnected,
    emit,
    on,
  };
}
export default useSocket;
