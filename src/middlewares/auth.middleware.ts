import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { BaseResponse } from '../core/utils/response';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_news_api_key_2026';

export interface AuthRequest extends Request {
    user?: { id: string; role: string };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const response: BaseResponse = { success: false, error: 'Unauthorized' };
        return res.status(401).json(response);
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
        req.user = payload;
        next();
    } catch (error) {
        const response: BaseResponse = { success: false, error: 'Invalid token' };
        return res.status(401).json(response);
    }
};
