import { Hono } from 'hono';
import { SupabaseUserRepository } from '../repositories/supabase/SupabaseUserRepository';
import { UserService } from '../services/UserService';

const auth = new Hono();

// Dependency Injection
const userRepo = new SupabaseUserRepository();
const userService = new UserService(userRepo);

auth.post('/telegram', async (c) => {
    try {
        const body = await c.req.json();
        const { initData } = body;

        if (!initData) {
            return c.json({ error: 'Missing initData' }, 400);
        }

        const result = await userService.authenticateTelegramUser(initData);
        return c.json(result);

    } catch (error: any) {
        console.error('Auth error:', error.message);
        const status = error.message === 'Invalid authentication data' ? 401 : 500;
        return c.json({ error: error.message }, status);
    }
});

export default auth;
