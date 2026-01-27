import { Hono } from 'hono';
import { SupabaseDealRepository } from '../repositories/supabase/SupabaseDealRepository';
import { SupabaseUserRepository } from '../repositories/supabase/SupabaseUserRepository';
import { DealService } from '../services/DealService';

const app = new Hono();

// Dependency Injection
const dealRepo = new SupabaseDealRepository();
const userRepo = new SupabaseUserRepository();
const dealService = new DealService(dealRepo);

// GET /deals - List all deals
app.get('/', async (c) => {
    try {
        const deals = await dealService.listDeals();
        return c.json(deals);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /deals/channel/:channelId
app.get('/channel/:channelId', async (c) => {
    try {
        const channelId = c.req.param('channelId');
        const deals = await dealService.getDealsForChannel(channelId);
        return c.json(deals);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /deals - Create a campaign
app.post('/', async (c) => {
    try {
        const body = await c.req.json();
        let {
            advertiser_id, advertiserId,
            channel_id, channelId,
            brief_text, briefText,
            price_amount, priceAmount,
            creative_content, creativeContent
        } = body;

        // AUTHENTICATION: Use header if body is missing ID
        const telegramIdHeader = c.req.header('X-Telegram-ID');
        if (!advertiserId && !advertiser_id && telegramIdHeader) {
            const tid = parseInt(telegramIdHeader);
            let user = await userRepo.findByTelegramId(tid);

            if (!user) {
                // Auto-create user for MVP (so we don't block deal creation)
                console.log(`Auto-creating user for Telegram ID ${tid}`);
                user = await userRepo.create({
                    telegramId: tid,
                    firstName: `User ${tid}`,
                    username: 'auto_created'
                });
            }

            if (user) {
                advertiserId = user.id;
            }
        }

        const result = await dealService.createCampaign(
            advertiserId || advertiser_id,
            channelId || channel_id,
            briefText || brief_text,
            priceAmount || price_amount,
            creativeContent || creative_content
        );
        return c.json(result, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

// POST /deals/:id/approve
app.post('/:id/approve', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const { approver_id, is_advertiser, reject } = body;

        const result = await dealService.approveCampaign(id, approver_id, is_advertiser, reject);
        return c.json(result);
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

export default app;
