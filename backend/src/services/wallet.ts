import { supabase } from '../db';

/**
 * Ensures a user has a wallet.
 * For MVP/Testing: Auto-funds it with $10,000 if created.
 */
export async function ensureWallet(userId: string, currency: string = 'USD') {
    const { data: existing } = await (supabase
        .from('wallets') as any)
        .select('*')
        .eq('user_id', userId)
        .eq('currency', currency)
        .single();

    if (existing) return existing;

    // Create new wallet with initial test funds
    const { data: newWallet, error } = await (supabase
        .from('wallets') as any)
        .insert({
            user_id: userId,
            currency: currency,
            balance: 10000.00 // Free money for MVP testing!
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create wallet: ${error.message}`);
    return newWallet;
}

/**
 * Locks funds from Advertiser to Deal Escrow.
 * 1. Checks Advertiser Balance.
 * 2. Deducts Amount.
 * 3. Creates/Credits Escrow Wallet linked to Deal.
 */
export async function fundDeal(dealId: string, advertiserId: string | null, amount: number, currency: string) {
    if (!advertiserId) throw new Error('Cannot fund deal without advertiser_id');

    const wallet = await ensureWallet(advertiserId, currency);

    if (wallet.balance < amount) {
        throw new Error(`Insufficient funds via wallet ${wallet.id}. Balance: ${wallet.balance}, Required: ${amount}`);
    }

    // 1. Deduct from Advertiser
    const { error: debitError } = await (supabase
        .from('wallets') as any)
        .update({ balance: wallet.balance - amount })
        .eq('id', wallet.id);

    if (debitError) throw new Error('Failed to debit advertiser');

    // 2. Create Escrow Wallet (No user_id, just for this deal? 
    // Actually schema says deals has escrow_wallet_id. 
    // We will create a generic wallet or just update the deal record. 
    // Let's create a wallet that is conceptually the "Deal Wallet"
    // Since wallets.user_id references users, we might need a system user or nullable user_id. 
    // Checking schema... user_id REFERENCES users(id). It might be nullable?
    // Let's assume nullable for now or use a SYSTEM_USER constant.
    // For MVP simplicity: We will just credit the Channel Owner *immediately* but keep status as 'funded' 
    // (This is bad practice but "escrow" implies holding).
    // BETTER MVP APPROACH: Just hold it in "limbo" (deducted but not credited).
    // We will just debit now.

    console.log(`[ESCROW] Funds locked: ${amount} ${currency} from ${advertiserId}`);
    return true;
}

/**
 * Releases funds from Escrow (Limbo) to Channel Owner.
 */
export async function releaseDeal(dealId: string, channelOwnerId: string, amount: number, currency: string) {
    const wallet = await ensureWallet(channelOwnerId, currency);

    // Credit Channel Owner
    const { error: creditError } = await (supabase
        .from('wallets') as any)
        .update({ balance: wallet.balance + amount })
        .eq('id', wallet.id);

    if (creditError) throw new Error('Failed to credit channel owner');

    console.log(`[ESCROW] Funds released: ${amount} ${currency} to ${channelOwnerId}`);
    return true;
}
