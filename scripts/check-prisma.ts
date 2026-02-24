import { prisma } from '../src/lib/prisma.js';

async function main() {
    try {
        const result = await prisma.$queryRaw`SELECT current_user, current_database(), version()`;
        console.log('--- Prisma Connection Successful ---');
        console.log(result);
    } catch (e: any) {
        console.error('--- Prisma Connection Failed ---');
        console.error(e.message);
    } finally {
        await (prisma as any).$disconnect();
    }
}

main();
