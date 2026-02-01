/**
 * ConnectWalletButton - Giveaway-style wallet connect/disconnect button
 * Matches the exact design from the Telegram Giveaway mini app
 * Pill-shaped button with wallet icon, placed in header area
 */

import { Wallet } from 'lucide-react';
import {
    useIsConnectionRestored,
    useTonAddress,
    useTonConnectUI,
} from '@tonconnect/ui-react';
import { haptic } from '@/utils/haptic';

export function WalletButton() {
    const [tonConnectUI] = useTonConnectUI();
    const userFriendlyAddress = useTonAddress();
    const connectionRestored = useIsConnectionRestored();

    const handleClick = async () => {
        haptic.light();
        if (!connectionRestored || !userFriendlyAddress) {
            // Connect wallet
            tonConnectUI.openModal();
        } else {
            // Disconnect wallet
            tonConnectUI.disconnect();
        }
    };


    // Get button text based on state
    const getButtonText = () => {
        if (!connectionRestored) {
            return 'Connecting...';
        }
        if (userFriendlyAddress) {
            return 'Disconnect';
        }
        return 'Connect Wallet';
    };

    return (
        <button
            onClick={handleClick}
            disabled={!connectionRestored}
            className={`
                flex items-center justify-center gap-2
                px-4 py-2
                rounded-full
                backdrop-blur-sm
                transition-all duration-200
                text-sm font-semibold
                ${!connectionRestored
                    ? 'bg-white/10 text-white/50 cursor-wait'
                    : userFriendlyAddress
                        ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                }
            `}
        >
            <Wallet className="w-4 h-4" />
            <span>{getButtonText()}</span>
        </button>
    );
}
