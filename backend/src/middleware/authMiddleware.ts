import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';

/**
 * Auth middleware that validates JWT tokens on protected routes.
 * 
 * Extracts the verified telegramId from the JWT payload and sets it
 * on the Hono context via c.set('telegramId', ...).
 * 
 * Routes can then use c.get('telegramId') to get the authenticated user's
 * Telegram ID — guaranteed to be real (not spoofable via headers).
 */
export async function authMiddleware(c: Context, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.slice(7); // Remove "Bearer "

    try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
        const payload = await verify(token, jwtSecret, 'HS256');

        if (!payload.tg_id) {
            return c.json({ error: 'Invalid token: missing user identity' }, 401);
        }

        // Set the verified Telegram ID on the context
        c.set('telegramId', Number(payload.tg_id));
        c.set('userId', payload.sub as string); // Internal UUID

        await next();
    } catch (error: any) {
        console.error('[Auth Middleware] JWT verification failed:', error.message);
        return c.json({ error: 'Invalid or expired token' }, 401);
    }
}
