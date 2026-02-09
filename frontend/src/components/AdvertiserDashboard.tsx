import { useNavigate } from 'react-router-dom'
import { Rocket, ListChecks, Store, Handshake, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/card'
import { haptic } from '@/utils/haptic'

export function AdvertiserDashboard() {
    const navigate = useNavigate()

    const openSupport = () => {
        haptic.light();
        // Open support bot conversation
        const url = 'https://t.me/DanielAdsMVP_bot?start=support';
        if ((window as any).Telegram?.WebApp?.openTelegramLink) {
            (window as any).Telegram.WebApp.openTelegramLink(url);
        } else {
            window.open(url, '_blank');
        }
    }

    const actions = [
        {
            label: "Launch Campaign",
            icon: <Rocket className="w-8 h-8 text-purple-400 mb-2" />,
            onClick: () => { haptic.light(); navigate('/create'); },
            desc: "Promote product on multiple channels"
        },
        {
            label: "View Campaigns",
            icon: <ListChecks className="w-8 h-8 text-blue-400 mb-2" />,
            onClick: () => { haptic.light(); navigate('/campaigns'); },
            desc: "Track active and ended campaigns"
        },
        {
            label: "Channel Marketplace",
            icon: <Store className="w-8 h-8 text-green-400 mb-2" />,
            onClick: () => { haptic.light(); navigate('/marketplace?tab=channels', { state: { from: '/advertiser' } }); },
            desc: "Find specific channels for ads"
        },
        {
            label: "Partnerships",
            icon: <Handshake className="w-8 h-8 text-orange-400 mb-2" />,
            onClick: () => { haptic.light(); navigate('/partnerships'); },
            desc: "Manage deals with channel owners"
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

            {/* Grid */}
            <div className="grid grid-cols-2 gap-4">
                {actions.map((action, idx) => (
                    <GlassCard
                        key={idx}
                        onClick={action.onClick}
                        className="p-6 flex flex-col items-center text-center cursor-pointer hover:bg-white/5 hover:scale-[1.02] transition-all duration-300 group"
                    >
                        <div className="p-3 rounded-full bg-white/5 group-hover:bg-white/10 mb-3 transition-colors">
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
