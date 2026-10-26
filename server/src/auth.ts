import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Token yaroqsiz yoki muddati o\'tgan' });
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) =>
    roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Ruxsat yo\'q' });

/** Buxgalteriya xodimlari: admin va buxgalter */
export const staffOnly = requireRole('admin', 'accountant');
