import { PrismaClient } from '@prisma/client';
import { env } from '../core/config/env.js';

const prismaClientSingleton = () => {
    return new (PrismaClient as any)({
        datasources: {
            db: {
                url: env.DATABASE_URL,
            },
        },
    });
};

type PrismaClientSingleton = any;

const globalForPrisma = globalThis as unknown as {
    prisma: any;
};

export const prisma: any = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
