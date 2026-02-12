
import { useNavigate } from 'react-router-dom'
import { Megaphone, Briefcase, Handshake, MessageCircle, ExternalLink } from 'lucide-react'
import { GlassCard, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { openTelegramLink } from '@/lib/telegram'
import { getBotUrl } from '@/lib/telegram'

export function ChannelOwnerCard() {
    const navigate = useNavigate()

    const openBot = () => {
        openTelegramLink(getBotUrl())
    }

    const actions = [
        {
            label: "List Channel",
            icon: <Megaphone className="w-5 h-5 text-yellow-400" />,
            onClick: () => navigate('/channels/new'),
            desc: "Monetize your Telegram channel"
        },
        {
            label: "Advertiser Campaigns",
            icon: <Briefcase className="w-5 h-5 text-cyan-400" />,
            onClick: () => navigate('/marketplace/requests'),
            desc: "Browse open offers"
        },
        {
            label: "Partnerships",
            icon: <Handshake className="w-5 h-5 text-orange-400" />,
            onClick: () => navigate('/channels/partnerships'),
            desc: "View direct deals"
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
        <GlassCard className="h-full flex flex-col hover:border-yellow-500/30 transition-all duration-300">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    <span className="bg-yellow-500/20 p-2 rounded-lg">📺</span>
                    Channel Owner
                </CardTitle>
                <p className="text-sm text-muted-foreground">Monetize your audience and find deals.</p>
            </CardHeader>
            <CardContent className="space-y-3 flex-1">
                {actions.map((action, idx) => (
                    <Button
                        key={idx}
                        variant="ghost"
                        onClick={action.onClick}
                        className="w-full justify-start h-auto py-3 px-4 bg-secondary hover:bg-accent border border-border hover:border-yellow-500/20 group"
                    >
                        <div className="flex items-center w-full gap-3">
                            <div className="p-2 rounded-full bg-background/50 group-hover:bg-yellow-500/20 transition-colors">
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
