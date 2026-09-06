import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:4000';

let socket: Socket | null = null;

/** Connects once and joins the venue's room — every station, Packing & Pass,
 * and the Customer Display all react to the same events (FS Section 5/6). */
export function connectSocket(venueId: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, { transports: ['websocket'] });
  socket.on('connect', () => {
    socket?.emit('join-venue', venueId);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
