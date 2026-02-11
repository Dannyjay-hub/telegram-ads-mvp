
import { useNavigate } from 'react-router-dom'
import { Rocket, ListChecks, Store, Handshake, MessageCircle, ExternalLink } from 'lucide-react'
import { GlassCard, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { openTelegramLink } from '@/lib/telegram'
import { getBotUrl } from '@/lib/telegram'

export function AdvertiserCard() {
    const navigate = useNavigate()

    const openBot = () => {
        openTelegramLink(getBotUrl())
    }

    const actions = [
        {
            label: "Launch Campaign",
            icon: <Rocket className="w-5 h-5 text-purple-400" />,
            onClick: () => navigate('/create'),
            desc: "Promote product on multiple channels"
        },
        {
            label: "View Campaigns",
            icon: <ListChecks className="w-5 h-5 text-blue-400" />,
            onClick: () => navigate('/campaigns'),
            desc: "Track active and ended campaigns"
        },
        {
            label: "Channel Marketplace",
            icon: <Store className="w-5 h-5 text-green-400" />,
            onClick: () => navigate('/marketplace'),
            desc: "Find specific channels for ads"
        },
        {
            label: "Active Partnerships",
            icon: <Handshake className="w-5 h-5 text-orange-400" />,
            onClick: () => navigate('/partnerships'),
            desc: "View direct deals with owners"
        },
        {
            label: "Ad Manager",
            icon: <MessageCircle className="w-5 h-5 text-pink-400" />,
            onClick: openBot,
            desc: "Chat via Telegram Bot",
            isExternal: true
        }
    ]

    return (
        <GlassCard className="h-full flex flex-col hover:border-purple-500/30 transition-all duration-300">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    <span className="bg-purple-500/20 p-2 rounded-lg">📢</span>
                    Advertiser
                </CardTitle>
                <p className="text-sm text-muted-foreground">Promote your products and manage campaigns.</p>
            </CardHeader>
            <CardContent className="space-y-3 flex-1">
                {actions.map((action, idx) => (
                    <Button
                        key={idx}
                        variant="ghost"
                        onClick={action.onClick}
                        className="w-full justify-start h-auto py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-purple-500/20 group"
                    >
                        <div className="flex items-center w-full gap-3">
                            <div className="p-2 rounded-full bg-background/50 group-hover:bg-purple-500/20 transition-colors">
                                {action.icon}
                            </div>
                            <div className="flex flex-col items-start gap-0.5 flex-1">
                                <span className="font-semibold text-sm flex items-center gap-2">
                                    {action.label}
                                    {action.isExternal && <ExternalLink className="w-3 h-3 opacity-50" />}
                                </span>
                                <span className="text-xs text-muted-foreground font-normal text-left line-clamp-1">
                                    {action.desc}
                                </span>
                            </div>
                        </div>
                    </Button>
                ))}
            </CardContent>
        </GlassCard>
    )
}
