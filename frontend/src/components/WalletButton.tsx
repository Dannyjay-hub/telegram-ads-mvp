/**
 * WalletButton - Telegram Design System
 * Pill-shaped button matching official Telegram mini apps (Giveaway, Access, Contest)
 * Uses useTonWallet hook which auto-syncs wallet address to backend for payouts
 */

import { Wallet } from 'lucide-react';
import { useTonWallet } from '@/hooks/useTonWallet';
import { haptic } from '@/utils/haptic';

export function WalletButton() {
    const { isConnected, isLoading, connectWallet, disconnectWallet } = useTonWallet();

    const handleClick = async () => {
        haptic.light();
        if (!isConnected) {
            connectWallet();
        } else {
            disconnectWallet();
        }
    };

    const getButtonText = () => {
        if (isLoading) return 'Connecting...';
        if (isConnected) return 'Disconnect';
        return 'Connect Wallet';
    };

    return (
        <button
            onClick={handleClick}
            disabled={isLoading}
            className="
                flex items-center justify-center gap-1
                px-2.5 py-[5px]
                rounded-[30px]
                bg-[rgba(116,116,128,0.32)]
                backdrop-blur-sm
                text-white text-[15px] font-semibold
                transition-all duration-200
                active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed
            "
        >
            <Wallet className="w-4 h-4" />
            <span>{getButtonText()}</span>
        </button>
    );
}

