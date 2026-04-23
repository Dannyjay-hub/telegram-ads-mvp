import { useNavigate } from 'react-router-dom'
import { Megaphone, Store, Handshake, Tv, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/card'
import { haptic } from '@/utils/haptic'
import { getBotDeepLinkUrl } from '@/lib/telegram'

export function ChannelOwnerDashboard() {
    const navigate = useNavigate()

    const openSupport = () => {
        haptic.light();
        // Open support bot conversation
        const url = getBotDeepLinkUrl('support');
        if ((window as any).Telegram?.WebApp?.openTelegramLink) {
            (window as any).Telegram.WebApp.openTelegramLink(url);
        } else {
            window.open(url, '_blank');
        }
    }

    // Aligned to match Advertiser layout:
    // Row 1: List Channel | My Channels
    // Row 2: Campaign Marketplace | Partnerships
    const actions = [
        {
            label: "List Channel",
            icon: <Megaphone className="w-8 h-8 text-yellow-400 mb-2" />,
            onClick: () => { haptic.light(); navigate('/channels/add'); },
            desc: "Monetize your Telegram channel"
        },
        {
            label: "My Channels",
            icon: <Tv className="w-8 h-8 text-cyan-400 mb-2" />,
            onClick: () => { haptic.light(); navigate('/channels/my'); },
            desc: "Manage existing channels"
        },
        {
            label: "Campaign Marketplace",
            icon: <Store className="w-8 h-8 text-green-400 mb-2" />,
            onClick: () => { haptic.light(); navigate('/marketplace?tab=campaigns', { state: { from: '/channel-owner' } }); },
            desc: "Browse advertiser offers"
        },
        {
            label: "Partnerships",
            icon: <Handshake className="w-8 h-8 text-orange-400 mb-2" />,
            onClick: () => { haptic.light(); navigate('/channels/partnerships'); },
            desc: "Manage deals with advertisers"
        }
    ]

    return (
        <div className="pb-20 space-y-6">
            {/* Header - No title, just Support button on right */}
            <div className="flex justify-end">
                <Button
                    onClick={openSupport}
                    size="sm"
                    variant="ghost"
                    className="text-[--tg-theme-hint-color] hover:text-[--tg-theme-text-color]"
                >
                    <HelpCircle className="w-4 h-4 mr-1.5" />
                    Support
                </Button>
            </div>

            {/* Grid - Same layout as Advertiser */}
            <div className="grid grid-cols-2 gap-4">
                {actions.map((action, idx) => (
                    <GlassCard
                        key={idx}
                        onClick={action.onClick}
                        className="p-6 flex flex-col items-center text-center cursor-pointer hover:bg-secondary hover:scale-[1.02] transition-all duration-300 group"
                    >
                        <div className="p-3 rounded-full bg-secondary group-hover:bg-accent mb-3 transition-colors">
                            {action.icon}
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base mb-1">{action.label}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed opacity-80">
                            {action.desc}
                        </p>
                    </GlassCard>
                ))}
            </div>
        </div>
    )
}
