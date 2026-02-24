import type { Request, Response, RequestHandler } from 'express';
import { authService } from './auth.service.js';
import { signupSchema, loginSchema } from './auth.validation.js';
import { ResponseProvider } from '../../core/utils/response.js';
import { ZodError } from 'zod';
import type { BaseResponse } from '../../core/utils/response.js';

export class AuthController {
    public signup: RequestHandler = async (req: Request, res: Response): Promise<any> => {
        try {
            const validatedData = signupSchema.parse(req.body);
            const result = await authService.signup(validatedData);
            const response: BaseResponse = ResponseProvider.success(result, 'User registered successfully');
            return res.status(201).json(response);
        } catch (error: any) {
            if (error instanceof ZodError) {
                return res.status(400).json(ResponseProvider.error(error.issues, 'Validation error'));
            }
            return res.status(400).json(ResponseProvider.error(null, error.message));
        }
    };

    public login: RequestHandler = async (req: Request, res: Response): Promise<any> => {
        try {
            const validatedData = loginSchema.parse(req.body);
            const result = await authService.login(validatedData);
            const response: BaseResponse = ResponseProvider.success(result, 'Login successful');
            return res.status(200).json(response);
        } catch (error: any) {
            if (error instanceof ZodError) {
                return res.status(400).json(ResponseProvider.error(error.issues, 'Validation error'));
            }
            return res.status(401).json(ResponseProvider.error(null, error.message));
        }
    };
}

export const authController = new AuthController();
