/**
 * Dashboard - Telegram Design System
 * Role selection screen following official Telegram mini app styling:
 * - Solid colors (no gradients)
 * - Section card backgrounds
 * - iOS Human Interface Guidelines
 */

import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/providers/TelegramProvider'
import { Briefcase, Tv } from 'lucide-react'
import { haptic } from '@/utils/haptic'

// Get user name instantly from WebApp (no async wait)
const getInstantUserName = (): string => {
    try {
        const webApp = (window as any)?.Telegram?.WebApp;
        const firstName = webApp?.initDataUnsafe?.user?.first_name;
        return firstName || 'Creator';
    } catch {
        return 'Creator';
    }
};

export function Dashboard() {
    const { user } = useTelegram()
    const navigate = useNavigate()

    // Use instant name, fallback to provider's user if available
    const displayName = user?.firstName || getInstantUserName();

    return (
        <div className="min-h-[80vh] flex flex-col justify-center space-y-8">
            {/* Header - Solid Telegram blue, no gradients */}
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-primary">
                    Welcome, {displayName}!
                </h2>
                <p className="text-muted-foreground">Select your role to get started</p>
            </div>

            {/* Role Cards - Telegram section style */}
            <div className="space-y-3">
                {/* Advertiser Card */}
                <button
                    onClick={() => { haptic.light(); navigate('/advertiser'); }}
                    className="w-full bg-card rounded-[14px] p-5 flex items-center gap-4 transition-all duration-200 active:scale-[0.98] active:bg-card/80 border border-border/50"
                >
                    <div className="h-14 w-14 rounded-[12px] bg-primary/10 flex items-center justify-center">
                        <Briefcase className="w-7 h-7 text-primary" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-semibold">Advertiser</h3>
                        <p className="text-sm text-muted-foreground">Promote your products and manage campaigns.</p>
                    </div>
                </button>

                {/* Channel Owner Card */}
                <button
                    onClick={() => { haptic.light(); navigate('/channel-owner'); }}
                    className="w-full bg-card rounded-[14px] p-5 flex items-center gap-4 transition-all duration-200 active:scale-[0.98] active:bg-card/80 border border-border/50"
                >
                    <div className="h-14 w-14 rounded-[12px] bg-[#FF9500]/10 flex items-center justify-center">
                        <Tv className="w-7 h-7 text-[#FF9500]" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-semibold">Channel Owner</h3>
                        <p className="text-sm text-muted-foreground">Monetize your audience and list channels.</p>
                    </div>
                </button>
            </div>
        </div>
    )
}
