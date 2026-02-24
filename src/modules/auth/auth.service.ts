import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../core/config/env.js';
import type { SignupInput, LoginInput } from './auth.validation.js';

export class AuthService {
    async signup(data: SignupInput) {
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            throw new Error('Email already registered');
        }

        const hashedPassword = await argon2.hash(data.password);

        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                password: hashedPassword,
                role: data.role || Role.READER,
            },
        });

        const token = this.generateToken(user.id, user.role);

        const { password: _, ...userWithoutPassword } = user;
        return { user: userWithoutPassword, token };
    }

    async login(data: LoginInput) {
        const user = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (!user) {
            throw new Error('Invalid email or password');
        }

        const isValid = await argon2.verify(user.password, data.password);
        if (!isValid) {
            throw new Error('Invalid email or password');
        }

        const token = this.generateToken(user.id, user.role);

        const { password: _, ...userWithoutPassword } = user;
        return { user: userWithoutPassword, token };
    }

    private generateToken(id: string, role: string) {
        // Explicitly cast payload to object to satisfy jwt.sign types
        const payload = { id, role };
        return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '24h' });
    }
}

export const authService = new AuthService();
