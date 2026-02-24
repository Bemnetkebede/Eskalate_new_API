import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../core/config/env.js';
import { ResponseProvider } from '../core/utils/response.js';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
    };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json(ResponseProvider.error(null, 'Authentication required'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json(ResponseProvider.error(null, 'Authentication required'));
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string };
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json(ResponseProvider.error(null, 'Invalid or expired token'));
    }
};
