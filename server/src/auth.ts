import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { get } from './db.js';

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-ozgartiring';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET muhit o\'zgaruvchisi production rejimida majburiy');
}

export type Role = 'admin' | 'accountant' | 'employee';
export interface AuthUser {
  id: number;
  orgId: number;
  role: Role;
  employeeId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
    }
  }
}

export const signToken = (u: AuthUser) => jwt.sign(u, SECRET, { expiresIn: '7d' });
export const verifyToken = (token: string) => {
  const { id, orgId, role, employeeId } = jwt.verify(token, SECRET) as AuthUser;
  return { id, orgId, role, employeeId };
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
  let claims: AuthUser;
  try {
    claims = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Token yaroqsiz yoki muddati o\'tgan' });
  }
  // Baza qayta yaratilgan bo'lsa (masalan, bepul serverda qayta ishga tushganda) token egasi yo'q bo'lishi mumkin
  const u = await get('SELECT id, org_id, role, employee_id FROM users WHERE id = ?', claims.id);
  if (!u || u.org_id !== claims.orgId) return res.status(401).json({ error: 'Foydalanuvchi topilmadi, qayta kiring' });
  req.user = { id: u.id, orgId: u.org_id, role: u.role, employeeId: u.employee_id };
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) =>
    roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Ruxsat yo\'q' });

/** Buxgalteriya xodimlari: admin va buxgalter */
export const staffOnly = requireRole('admin', 'accountant');
