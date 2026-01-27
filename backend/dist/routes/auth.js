"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const SupabaseUserRepository_1 = require("../repositories/supabase/SupabaseUserRepository");
const UserService_1 = require("../services/UserService");
const auth = new hono_1.Hono();
// Dependency Injection
const userRepo = new SupabaseUserRepository_1.SupabaseUserRepository();
const userService = new UserService_1.UserService(userRepo);
auth.post('/telegram', async (c) => {
    try {
        const body = await c.req.json();
        const { initData } = body;
        if (!initData) {
            return c.json({ error: 'Missing initData' }, 400);
        }
        const result = await userService.authenticateTelegramUser(initData);
        return c.json(result);
    }
    catch (error) {
        console.error('Auth error:', error.message);
        const status = error.message === 'Invalid authentication data' ? 401 : 500;
        return c.json({ error: error.message }, status);
    }
});
exports.default = auth;
