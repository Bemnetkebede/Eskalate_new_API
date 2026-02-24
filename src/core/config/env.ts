import { z } from 'zod';

const envSchema = z.object({
    DATABASE_URL: z.string().url("Must be a valid PostgreSQL URL"),
    JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters long"),
    PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error("❌ Invalid environment variables:", _env.error.format());
    process.exit(1);
}

export const env = _env.data;
