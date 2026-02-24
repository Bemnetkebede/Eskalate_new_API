import { prisma } from '../../lib/prisma';
import { SignupInput, LoginInput } from './auth.validation';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_news_api_key_2026';

export class AuthService {
    async signup(data: SignupInput) {
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });
        if (existingUser) {
            throw new Error('Email already exists');
        }

        const hashedPassword = await argon2.hash(data.password);
        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                password: hashedPassword,
                role: data.role || 'USER',
            },
        });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        const { password, ...userWithoutPassword } = user;
        return { user: userWithoutPassword, token };
    }

    async login(data: LoginInput) {
        const user = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValid = await argon2.verify(user.password, data.password);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        const { password, ...userWithoutPassword } = user;
        return { user: userWithoutPassword, token };
    }
}

export const authService = new AuthService();
