import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    adminId?: number;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.adminId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
