/**
 * TON Network Configuration
 * Single source of truth for all network-specific URLs and addresses.
 * Controlled by TON_NETWORK env var (default: 'mainnet')
 */

const isTestnet = process.env.TON_NETWORK === 'testnet';

export const TON_CONFIG = {
    network: isTestnet ? 'testnet' : 'mainnet',
    isTestnet,

    // TonCenter API (used for sending payments)
    toncenterApi: isTestnet
        ? 'https://testnet.toncenter.com/api/v2'
        : 'https://toncenter.com/api/v2',

    toncenterJsonRpc: isTestnet
        ? 'https://testnet.toncenter.com/api/v2/jsonRPC'
        : 'https://toncenter.com/api/v2/jsonRPC',

    // TonAPI (used for webhooks, transaction lookups, balance checks)
    tonapiUrl: isTestnet
        ? 'https://testnet.tonapi.io/v2'
        : 'https://tonapi.io/v2',

    // TonAPI Webhook endpoint (same for both networks)
    tonapiWebhookUrl: 'https://rt.tonapi.io/webhooks',

    // USDT Jetton Master Address
    usdtMasterAddress: isTestnet
        ? 'kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy'   // Testnet USDT
        : 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',  // Mainnet USDT

    // Platform wallet (reads from env based on network)
    masterWalletAddress: isTestnet
        ? (process.env.TESTNET_MASTER_WALLET_ADDRESS || process.env.MASTER_WALLET_ADDRESS || '')
        : (process.env.MASTER_WALLET_ADDRESS || ''),

    // Bot token (reads from env based on network)
    botToken: isTestnet
        ? (process.env.TESTNET_BOT_TOKEN || process.env.BOT_TOKEN || '')
        : (process.env.BOT_TOKEN || ''),

    // Wallet mnemonic (same for both, fallback chain)
    hotWalletMnemonic: process.env.TESTNET_HOT_WALLET_MNEMONIC || process.env.HOT_WALLET_MNEMONIC || '',
};

console.log(`[TON Config] Network: ${TON_CONFIG.network}, Wallet: ${TON_CONFIG.masterWalletAddress.substring(0, 10)}...`);
