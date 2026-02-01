/**
 * Jetton (Token) Definitions for TON Blockchain
 * Supported stablecoins: USDT, USDC (USDC pending confirmation)
 */

export interface JettonToken {
    id: string;
    name: string;
    symbol: string;
    masterAddress: string; // Jetton master contract address
    decimals: number;
    icon?: string;
}

// Native TON (not a Jetton, but included for unified API)
export const TON_TOKEN: JettonToken = {
    id: 'ton',
    name: 'Toncoin',
    symbol: 'TON',
    masterAddress: '', // Native coin, no master address
    decimals: 9,
    icon: '💎'
};

// USDT on TON (Tether USD - verified mainnet address)
export const USDT_TOKEN: JettonToken = {
    id: 'usdt',
    name: 'Tether USD',
    symbol: 'USDT',
    masterAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    decimals: 6,
    icon: '💵'
};

// USDC on TON (Circle USD - pending confirmed address)
// Note: Using placeholder - verify before production
export const USDC_TOKEN: JettonToken = {
    id: 'usdc',
    name: 'USD Coin',
    symbol: 'USDC',
    masterAddress: 'EQB-MPwrd1G6WKNkLz_VnV6WCQfDuTT-QBoXquJhmI_8lHE-', // To verify
    decimals: 6,
    icon: '🔵'
};

// All supported payment tokens
export const SUPPORTED_TOKENS: JettonToken[] = [
    TON_TOKEN,
    USDT_TOKEN,
    // USDC_TOKEN, // Uncomment when address confirmed
];

// Get token by ID
export function getTokenById(id: string): JettonToken | undefined {
    return SUPPORTED_TOKENS.find(t => t.id === id);
}

// Check if token is native TON
export function isNativeToken(token: JettonToken): boolean {
    return token.id === 'ton';
}

// Format amount with correct decimals for display
export function formatTokenAmount(amount: number, token: JettonToken): string {
    return amount.toFixed(token.decimals === 9 ? 4 : 2);
}

// Convert to smallest unit (nano for TON, micro for USDT)
export function toSmallestUnit(amount: number, token: JettonToken): bigint {
    return BigInt(Math.floor(amount * Math.pow(10, token.decimals)));
}

// Convert from smallest unit to decimal
export function fromSmallestUnit(amount: bigint, token: JettonToken): number {
    return Number(amount) / Math.pow(10, token.decimals);
}
