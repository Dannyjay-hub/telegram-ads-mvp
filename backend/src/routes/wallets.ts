import { Hono } from 'hono';
import { WalletService } from '../services/WalletService';

const app = new Hono();
const walletService = new WalletService();

// GET /wallets/me - Get my wallet
app.get('/me', async (c) => {
    try {
        const userId = c.req.query('userId'); // In future, use Auth Middleware
        if (!userId) return c.json({ error: 'userId required' }, 400);

        const wallet = await walletService.getWallet(userId);
        return c.json(wallet);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /wallets/deposit - Mock Deposit
app.post('/deposit', async (c) => {
    try {
        const body = await c.req.json();
        const { userId, amount } = body;

        if (!userId || !amount) return c.json({ error: 'userId and amount required' }, 400);

        const wallet = await walletService.depositMockFunds(userId, Number(amount));
        return c.json(wallet);
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

export default app;
