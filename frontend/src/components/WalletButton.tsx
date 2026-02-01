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
                rounded-[30px]
                transition-all duration-200
                text-[15px] font-semibold
                active:scale-[0.98]
                ${!connectionRestored
                    ? 'bg-[rgba(116,116,128,0.16)] text-muted-foreground cursor-wait'
                    : userFriendlyAddress
                        ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                        : 'bg-primary/10 text-primary hover:bg-primary/20'
                }
            `}
        >
            <Wallet className="w-4 h-4" />
            <span>{getButtonText()}</span>
        </button>
    );
}
