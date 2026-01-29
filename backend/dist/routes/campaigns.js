"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const CampaignService_1 = require("../services/CampaignService");
const app = new hono_1.Hono();
const campaignService = new CampaignService_1.CampaignService();
// POST /campaigns - Create a new campaign
app.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const headerId = c.req.header('X-Telegram-ID');
        // In real app, resolve user ID from headerId
        // For Phase 1 MVP, we assume client sends 'advertiser_id' OR we resolve it here.
        // Let's rely on body.advertiser_id for now or resolve mock.
        if (!body.advertiser_id) {
            return c.json({ error: 'advertiser_id is required' }, 400);
        }
        const campaign = await campaignService.createCampaign(body);
        return c.json(campaign, 201);
    }
    catch (e) {
        return c.json({ error: e.message }, 400);
    }
});
// GET /campaigns/open - List open campaigns for Channels
app.get('/open', async (c) => {
    try {
        const minBudget = c.req.query('minBudget');
        const campaigns = await campaignService.listOpenCampaigns({
            minBudget: minBudget ? Number(minBudget) : undefined
        });
        return c.json(campaigns);
    }
    catch (e) {
        return c.json({ error: e.message }, 500);
    }
});
// GET /campaigns/my - List Advertiser's campaigns
app.get('/my', async (c) => {
    try {
        const advertiserId = c.req.query('advertiserId');
        if (!advertiserId)
            return c.json({ error: 'advertiserId required' }, 400);
        const campaigns = await campaignService.listAdvertiserCampaigns(advertiserId);
        return c.json(campaigns);
    }
    catch (e) {
        return c.json({ error: e.message }, 500);
    }
});
// GET /campaigns/:id - Get details
app.get('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const campaign = await campaignService.getCampaign(id);
        if (!campaign)
            return c.json({ error: 'Not found' }, 404);
        return c.json(campaign);
    }
    catch (e) {
        return c.json({ error: e.message }, 500);
    }
});
exports.default = app;
