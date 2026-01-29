"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const db_1 = require("../db");
class WalletService {
    // Get or Create Wallet for User
    async getWallet(userId) {
        const { data, error } = await db_1.supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error && error.code === 'PGRST116') {
            // Not found, create one (Mock logic: Start with 0. Deposit needed)
            const { data: newWallet, error: createError } = await db_1.supabase
                .from('wallets')
                .insert({ user_id: userId, balance: 0, currency: 'USD' })
                .select()
                .single();
            if (createError)
                throw new Error(createError.message);
            return newWallet;
        }
        if (error)
            throw new Error(error.message);
        return data;
    }
    async depositMockFunds(userId, amount) {
        const wallet = await this.getWallet(userId);
        // 1. Transaction Record
        const { error: txError } = await db_1.supabase
            .from('transactions')
            .insert({
            wallet_id: wallet.id,
            amount: amount,
            type: 'deposit',
            description: 'Mock Deposit'
        });
        if (txError)
            throw new Error(txError.message);
        // 2. Update Balance
        const { data, error: updateError } = await db_1.supabase
            .from('wallets')
            .update({ balance: wallet.balance + amount })
            .eq('id', wallet.id)
            .select()
            .single();
        if (updateError)
            throw new Error(updateError.message);
        return data;
    }
    async escrowFunds(userId, amount, referenceId, description) {
        const wallet = await this.getWallet(userId);
        if (wallet.balance < amount) {
            throw new Error(`Insufficient funds. Balance: ${wallet.balance}, Required: ${amount}`);
        }
        // 1. Deduct from Balance
        const { data, error: updateError } = await db_1.supabase
            .from('wallets')
            .update({ balance: wallet.balance - amount })
            .eq('id', wallet.id)
            .select()
            .single();
        if (updateError)
            throw new Error(updateError.message);
        // 2. Record Transaction
        await db_1.supabase.from('transactions').insert({
            wallet_id: wallet.id,
            amount: -amount,
            type: 'escrow',
            reference_id: referenceId,
            description: description
        });
        return data;
    }
    async releaseFunds(toUserId, amount, referenceId, description) {
        const wallet = await this.getWallet(toUserId);
        // 1. Add to Balance
        const { data, error: updateError } = await db_1.supabase
            .from('wallets')
            .update({ balance: wallet.balance + amount })
            .eq('id', wallet.id)
            .select()
            .single();
        if (updateError)
            throw new Error(updateError.message);
        // 2. Record Transaction
        await db_1.supabase.from('transactions').insert({
            wallet_id: wallet.id,
            amount: amount,
            type: 'payout',
            reference_id: referenceId,
            description: description
        });
        return data;
    }
}
exports.WalletService = WalletService;
