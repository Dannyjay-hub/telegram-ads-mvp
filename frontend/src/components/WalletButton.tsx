/**
 * WalletButton - Telegram Design System
 * Pill-shaped button matching official Telegram mini apps (Giveaway, Access, Contest)
 * Uses TON Connect UI directly for wallet operations
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

    // Get button text based on state (matches giveaway-tool)
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

