/**
 * TON Network Configuration (Frontend)
 * Uses VITE_TON_NETWORK env var (default: 'mainnet' for production safety)
 */

const isTestnet = import.meta.env.VITE_TON_NETWORK === 'testnet'; // default mainnet

export const TON_FRONTEND_CONFIG = {
    network: isTestnet ? 'testnet' : 'mainnet',
    isTestnet,

    // TonAPI URL for balance lookups
    tonapiUrl: isTestnet
        ? 'https://testnet.tonapi.io/v2'
        : 'https://tonapi.io/v2',

    // USDT Jetton Master Address
    usdtMasterAddress: isTestnet
        ? 'kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy'   // Testnet USDT
        : 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',  // Mainnet USDT

    // Expected chain ID for wallet validation
    expectedChainId: isTestnet ? '-3' : '-239',
};
