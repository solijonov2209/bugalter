import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verifyToken } from './auth.js';

let io: Server | undefined;

export function initRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: true } });
  io.use((socket, next) => {
    try {
      socket.data.user = verifyToken(String(socket.handshake.auth.token ?? ''));
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    const u = socket.data.user;
    if (u.role === 'employee' && u.employeeId) socket.join(`employee:${u.employeeId}`);
    else socket.join(`org:${u.orgId}`);
  });
}

/**
 * Xodimlarning ma'lumotlari o'zgarganini xabar qiladi: buxgalteriya paneli va
 * har bir tegishli xodimning kabineti o'z ma'lumotini qayta yuklaydi.
 */
export function notifyPayroll(orgId: number, employeeIds: number[], period: string) {
  if (!io) return;
  io.to(`org:${orgId}`).emit('payroll:changed', { period, employeeIds });
  for (const id of employeeIds) io.to(`employee:${id}`).emit('payroll:changed', { period });
}
