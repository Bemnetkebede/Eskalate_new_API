import { PrismaClient } from '@prisma/client';
import { env } from '../core/config/env.js';

const prismaClientSingleton = () => {
    return new PrismaClient({
        datasourceUrl: env.DATABASE_URL,
    });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
