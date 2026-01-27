"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const SupabaseDealRepository_1 = require("../repositories/supabase/SupabaseDealRepository");
const DealService_1 = require("../services/DealService");
const app = new hono_1.Hono();
// Dependency Injection
const dealRepo = new SupabaseDealRepository_1.SupabaseDealRepository();
const dealService = new DealService_1.DealService(dealRepo);
// GET /deals - List all deals
app.get('/', async (c) => {
    try {
        const deals = await dealService.listDeals();
        return c.json(deals);
    }
    catch (e) {
        return c.json({ error: e.message }, 500);
    }
});
// GET /deals/channel/:channelId
app.get('/channel/:channelId', async (c) => {
    try {
        const channelId = c.req.param('channelId');
        const deals = await dealService.getDealsForChannel(channelId);
        return c.json(deals);
    }
    catch (e) {
        return c.json({ error: e.message }, 500);
    }
});
// POST /deals - Create a campaign
app.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const { advertiser_id, advertiserId, channel_id, channelId, brief_text, briefText, price_amount, priceAmount, creative_content, creativeContent } = body;
        const result = await dealService.createCampaign(advertiserId || advertiser_id, channelId || channel_id, briefText || brief_text, priceAmount || price_amount, creativeContent || creative_content);
        return c.json(result, 201);
    }
    catch (e) {
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
    }
    catch (e) {
        return c.json({ error: e.message }, 400);
    }
});
exports.default = app;
