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

// GET /deals/my - Get deals for current user (advertiser)
app.get('/my', async (c) => {
    try {
        const telegramIdHeader = c.req.header('X-Telegram-ID');
        if (!telegramIdHeader) {
            return c.json({ error: 'Not authenticated' }, 401);
        }

        const user = await userRepo.findByTelegramId(parseInt(telegramIdHeader));
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }
        // Use method with channel data for partnerships display
        const deals = await dealService.getDealsForAdvertiserWithChannel(user.id);
        return c.json(deals);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /deals/channel-owner - Get deals for channels owned by current user
app.get('/channel-owner', async (c) => {
    try {
        const telegramIdHeader = c.req.header('X-Telegram-ID');
        if (!telegramIdHeader) {
            return c.json({ error: 'Not authenticated' }, 401);
        }

        const telegramId = parseInt(telegramIdHeader);
        console.log(`[channel-owner] Fetching deals for telegram_id: ${telegramId}`);

        const deals = await dealService.getDealsForChannelOwner(telegramId);
        console.log(`[channel-owner] Found ${deals.length} deals`);

        return c.json(deals);
    } catch (e: any) {
        console.error(`[channel-owner] Error:`, e.message);
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

// GET /deals/:id/payment-instructions
app.get('/:id/payment-instructions', async (c) => {
    try {
        const id = c.req.param('id');
        const instructions = await dealService.getPaymentInstructions(id);
        return c.json(instructions);
    } catch (e: any) {
        return c.json({ error: e.message }, 404);
    }
});

// GET /deals/:id/status - Poll deal status for payment verification
app.get('/:id/status', async (c) => {
    try {
        const id = c.req.param('id');
        const deal = await dealRepo.findById(id);
        if (!deal) {
            return c.json({ error: 'Deal not found' }, 404);
        }
        return c.json({
            id: deal.id,
            status: deal.status,
            paymentTxHash: deal.paymentTxHash
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /deals/create-with-items - Create deal with content items (escrow flow)
app.post('/create-with-items', async (c) => {
    try {
        const body = await c.req.json();
        const { channelId, contentItems, walletAddress, brief, currency } = body;

        // Get advertiser from header
        const telegramIdHeader = c.req.header('X-Telegram-ID');
        if (!telegramIdHeader) {
            return c.json({ error: 'Not authenticated' }, 401);
        }

        let user = await userRepo.findByTelegramId(parseInt(telegramIdHeader));
        if (!user) {
            // Auto-create user
            user = await userRepo.create({
                telegramId: parseInt(telegramIdHeader),
                firstName: `User ${telegramIdHeader}`,
                username: 'auto_created'
            });
        }

        const result = await dealService.createDealWithItems(
            user.id,
            channelId,
            contentItems,
            walletAddress,
            brief,
            currency || 'TON' // Pass the payment currency, default to TON
        );

        return c.json(result, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

// POST /deals/:id/confirm-payment - Confirm payment (called by payment monitor)
app.post('/:id/confirm-payment', async (c) => {
    try {
        const body = await c.req.json();
        const { paymentMemo, txHash } = body;

        const deal = await dealService.confirmPayment(paymentMemo, txHash);
        return c.json(deal);
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

// POST /deals - Create a campaign (legacy)
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
