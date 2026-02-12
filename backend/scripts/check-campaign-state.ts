import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const campaignId = 'b71fb8b8-4a17-4f56-ab15-f7618dee4585';
    const channelId = 'fae23cf0-2e22-4e4a-9770-3edc3f7d0c98';

    // Check applications for this campaign
    const { data: apps } = await supabase
        .from('campaign_applications')
        .select('*')
        .eq('campaign_id', campaignId);
    console.log('Applications for campaign:', JSON.stringify(apps, null, 2));

    // Check applications for this channel
    const { data: channelApps } = await supabase
        .from('campaign_applications')
        .select('*')
        .eq('channel_id', channelId);
    console.log('Applications for channel:', JSON.stringify(channelApps, null, 2));

    // Check deals for this campaign 
    const { data: deals } = await supabase
        .from('deals')
        .select('id, status, channel_id, campaign_id')
        .eq('campaign_id', campaignId);
    console.log('Deals for campaign:', JSON.stringify(deals, null, 2));

    // Total applications
    const { data: allApps, count } = await supabase
        .from('campaign_applications')
        .select('*', { count: 'exact' });
    console.log('Total applications in DB:', allApps?.length);
}
check();
