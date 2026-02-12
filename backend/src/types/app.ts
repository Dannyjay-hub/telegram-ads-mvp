import { Hono } from 'hono';

/**
 * Shared type definition for Hono context variables
 * set by the auth middleware.
 */
export type AppVariables = {
    telegramId: number;
    userId: string;
};

/**
 * Pre-typed Hono app factory for route files.
 * Use this instead of `new Hono()` to get type-safe access
 * to `c.get('telegramId')` and `c.get('userId')`.
 */
export type AppType = Hono<{ Variables: AppVariables }>;

export function createRouter(): AppType {
    return new Hono<{ Variables: AppVariables }>();
}
