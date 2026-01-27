import { Hono } from 'hono';
import { SupabaseBriefRepository } from '../repositories/supabase/SupabaseBriefRepository';
import { BriefService } from '../services/BriefService';
import { SupabaseDealRepository } from '../repositories/supabase/SupabaseDealRepository';
import { DealService } from '../services/DealService';

const app = new Hono();

// Dependency Injection
const briefRepo = new SupabaseBriefRepository();
const briefService = new BriefService(briefRepo);

// Needed for Apply flow
const dealRepo = new SupabaseDealRepository();
const dealService = new DealService(dealRepo);

// GET /briefs - Feed of open requests
app.get('/', async (c) => {
    try {
        const minBudget = c.req.query('minBudget');
        const tag = c.req.query('tag');

        const briefList = await briefService.listOpenBriefs({
            minBudget: minBudget ? Number(minBudget) : undefined,
            tag: tag || undefined
        });
        return c.json(briefList);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /briefs - Advertiser creates a brief
app.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const {
            advertiserId, title, content,
            budgetMin, budgetMax, tags
        } = body;

        // Mock advertiser ID if missing (for MVP)
        const advId = advertiserId || '00000000-0000-0000-0000-000000000000'; // Replace with real or from token

        const brief = await briefService.createBrief(
            advId, title, content,
            Number(budgetMin) || 0,
            Number(budgetMax) || 0,
            tags || []
        );
        return c.json(brief, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

// POST /briefs/:id/apply - Channel Owner applies to a brief (Bidding)
app.post('/:id/apply', async (c) => {
    try {
        const briefId = c.req.param('id');
        const body = await c.req.json();
        const { channelId, priceAmount } = body; // The Bid

        const brief = await briefService.getBrief(briefId);
        if (!brief) {
            return c.json({ error: 'Brief not found' }, 404);
        }

        // Create a Deal linked to this brief
        // Status defaults to 'negotiating' or 'submitted'
        // Logic: Application = Deal in 'negotiating' status implies Channel proposes terms.

        const deal = await dealRepo.create({
            advertiserId: brief.advertiserId,
            channelId: channelId,
            briefText: `Application to: ${brief.title}`,
            creativeContent: {},  // Empty for now
            priceAmount: Number(priceAmount),
            priceCurrency: brief.currency,
            status: 'negotiating' // Important: It's a negotiation start
        }, briefId);

        return c.json(deal, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

export default app;
