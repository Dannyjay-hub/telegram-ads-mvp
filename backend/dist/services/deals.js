"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create_campaign = create_campaign;
exports.approve_campaign = approve_campaign;
const db_1 = require("../db");
const notifications_1 = require("./notifications");
const posting_1 = require("./posting");
const wallet_1 = require("./wallet");
/**
 * Creates a new campaign (deal).
 * Wraps the logic to ensure data integrity.
 * Since we are using Supabase REST, single table inserts are atomic.
 */
async function create_campaign(dealData) {
    // FIXME: Hardcoded test user for MVP demo
    const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    // Auto-fill advertiser_id for testing if missing
    if (!dealData.advertiser_id) {
        dealData.advertiser_id = TEST_USER_ID;
    }
    if (!dealData.advertiser_id || !dealData.channel_id || !dealData.price_amount) {
        throw new Error('Missing required fields: advertiser_id, channel_id, price_amount');
    }
    // prevent partial updates by strictly defining the object
    const deal = {
        ...dealData,
        status: 'submitted', // Auto-submit for MVP (skip draft state)
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    // Casting to any to bypass Typescript inference issues with supabase-js locally
    const { data, error } = await db_1.supabase
        .from('deals')
        .insert(deal)
        .select()
        .single();
    if (error) {
        console.error('SUPABASE INSERT ERROR:', error);
        throw new Error(error.message);
    }
    console.log('Deal created successfully:', data?.id);
    // Notify the Channel Owner
    if (data && deal.channel_id && deal.brief_text) {
        // Run in background (don't await) to not block response
        (0, notifications_1.notifyChannelOwner)(deal.channel_id, data.id, deal.brief_text).catch(console.error);
    }
    return data;
}
/**
 * Approves a campaign.
 * Handles state transitions:
 * - submitted -> funded (Channel accepts)
 * - funded -> approved (Advertiser accepts creative)
 */
async function approve_campaign(dealId, approverId, isAdvertiser = false, reject = false) {
    // 1. Fetch current deal status
    const { data, error: fetchError } = await db_1.supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();
    if (fetchError || !data) {
        throw new Error('Deal not found');
    }
    const deal = data;
    let newStatus = null;
    const updates = { updated_at: new Date().toISOString() };
    // Logic based on current status and who is approving
    if (reject) {
        // Handle Rejection
        if (deal.status === 'submitted' && !isAdvertiser) {
            newStatus = 'cancelled'; // Channel rejected brief
            console.log(`[DEAL] Channel rejected deal ${dealId}.`);
        }
        else if (deal.status === 'funded' && isAdvertiser) {
            newStatus = 'cancelled'; // Advertiser rejected creative (or we could have a 'revision_requested' status)
            // Ideally we should refund here!
            console.log(`[DEAL] Advertiser rejected creative for ${dealId}. cancelling for MVP.`);
        }
        else {
            throw new Error(`Invalid rejection for status ${deal.status}`);
        }
    }
    else if (deal.status === 'submitted' && !isAdvertiser) {
        // Channel Owner accepting the brief -> Lock Funds
        console.log(`[DEAL] Channel accepting deal ${dealId}. Attempting to lock funds...`);
        // Attempt to fund the deal. If this fails, it throws and stops the status update.
        await (0, wallet_1.fundDeal)(dealId, deal.advertiser_id, Number(deal.price_amount), deal.price_currency || 'USD');
        newStatus = 'funded';
    }
    else if (deal.status === 'funded' && isAdvertiser) {
        // Advertiser approving the creative
        newStatus = 'approved';
    }
    else {
        throw new Error(`Invalid transition for status ${deal.status} by ${isAdvertiser ? 'Advertiser' : 'Channel'}`);
    }
    if (newStatus) {
        updates.status = newStatus;
        const { data: updatedDeal, error: updateError } = await db_1.supabase
            .from('deals')
            .update(updates)
            .eq('id', dealId)
            .select()
            .single();
        if (updateError)
            throw new Error(updateError.message);
        // --- NOTIFICATIONS ---
        if (newStatus === 'funded' && updatedDeal) {
            // Channel accepted -> Notify Advertiser
            // "Your deal with [Channel] is accepted. Funds locked."
            (0, notifications_1.notifyUser)(updatedDeal.advertiser_id, `✅ Deal Accepted!\n\nChannel ${updatedDeal.channel_id} has accepted your brief. Funds have been locked in escrow.`).catch(console.error);
        }
        else if (newStatus === 'approved' && updatedDeal) {
            // Advertiser approved creative -> Notify Channel Owner
            // "Creative approved! Post scheduled."
            console.log('Advertiser approved deal. Scheduling post...');
            (0, posting_1.schedulePost)(updatedDeal.id, updatedDeal.channel_id || '', updatedDeal.creative_content).catch(console.error);
            (0, notifications_1.notifyChannelOwner)(updatedDeal.channel_id, updatedDeal.id, `🚀 Creative Approved!\n\nThe advertiser approved your post. It will be auto-posted at the scheduled time.`).catch(console.error);
        }
        return updatedDeal;
    }
    return deal;
}
