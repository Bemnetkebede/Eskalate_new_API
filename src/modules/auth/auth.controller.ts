import { Request, Response } from 'express';
import { authService } from './auth.service';
import { signupSchema, loginSchema } from './auth.validation';
import { BaseResponse } from '../../core/utils/response';
import { ZodError } from 'zod';

export const signup = async (req: Request, res: Response) => {
    try {
        const data = signupSchema.parse(req.body);
        const result = await authService.signup(data);
        const response: BaseResponse<typeof result> = {
            success: true,
            message: 'Signup successful',
            data: result,
        };
        res.status(201).json(response);
    } catch (error: any) {
        let message = error.message;
        if (error instanceof ZodError) {
            message = error.errors.map(e => e.message).join(', ');
        }
        const response: BaseResponse = { success: false, error: message };
        res.status(400).json(response);
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const data = loginSchema.parse(req.body);
        const result = await authService.login(data);
        const response: BaseResponse<typeof result> = {
            success: true,
            message: 'Login successful',
            data: result,
        };
        res.status(200).json(response);
    } catch (error: any) {
        let message = error.message;
        if (error instanceof ZodError) {
            message = error.errors.map(e => e.message).join(', ');
        }
        const response: BaseResponse = { success: false, error: message };
        res.status(400).json(response);
    }
};
