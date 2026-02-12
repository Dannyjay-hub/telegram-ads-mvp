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
                bg-[rgba(116,116,128,0.16)] backdrop-blur-sm
                flex items-center justify-center gap-1
                rounded-[30px] px-2.5 py-[5px]
                transition-all duration-200
                active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed
            "
        >
            <div className="text-foreground">
                <Wallet className="w-4 h-4" />
            </div>
            <span className="text-primary text-[15px] font-semibold">
                {getButtonText()}
            </span>
        </button>
    );
}

