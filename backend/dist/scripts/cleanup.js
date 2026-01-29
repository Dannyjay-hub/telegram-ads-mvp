"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
async function cleanup() {
    const channelId = '93057d7b-fc8a-485b-805a-dafc7c632fc5';
    console.log(`Cleaning up channel: ${channelId}...`);
    // 1. Delete Deals
    const { error: dealError } = await db_1.supabase
        .from('deals')
        .delete()
        .eq('channel_id', channelId);
    if (dealError) {
        console.error('Error deleting deals:', dealError);
        process.exit(1);
    }
    console.log('Deals deleted.');
    // 2. Delete Channel
    const { error: channelError } = await db_1.supabase
        .from('channels')
        .delete()
        .eq('id', channelId);
    if (channelError) {
        console.error('Error deleting channel:', channelError);
        process.exit(1);
    }
    console.log('Channel deleted.');
}
cleanup();
