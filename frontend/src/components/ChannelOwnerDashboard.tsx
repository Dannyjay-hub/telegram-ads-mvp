import { useNavigate } from 'react-router-dom'
import { Megaphone, Briefcase, Handshake, MessageCircle, ArrowLeft, Tv } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/card'

export function ChannelOwnerDashboard() {
    const navigate = useNavigate()

    const openBot = () => {
        window.open('https://t.me/DanielAdsMVP_bot', '_blank')
    }

    const actions = [
        {
            label: "List Channel",
            icon: <Megaphone className="w-8 h-8 text-yellow-400 mb-2" />,
            onClick: () => navigate('/channels/new'),
            desc: "Monetize your Telegram channel"
        },
        {
            label: "Advertiser Campaigns",
            icon: <Briefcase className="w-8 h-8 text-cyan-400 mb-2" />,
            onClick: () => navigate('/marketplace?tab=campaigns', { state: { from: '/channel-owner' } }),
            desc: "Browse open offers"
        },
        {
            label: "Partnerships",
            icon: <Handshake className="w-8 h-8 text-orange-400 mb-2" />,
            onClick: () => navigate('/channels/partnerships'),
            desc: "View direct deals"
        },
        {
            label: "My Channels",
            icon: <Tv className="w-8 h-8 text-pink-400 mb-2" />,
            onClick: () => navigate('/channels/my'), // New route for the list view
            desc: "Manage existing channels"
        }
    ]

    return (
        <div className="pb-20 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="mr-1">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-red-600">
                            Channel Owner
                        </h1>
                        <p className="text-xs text-muted-foreground">Monetize your audience</p>
                    </div>
                </div>

                <Button
                    onClick={openBot}
                    className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 gap-2"
                >
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Ad Manager</span>
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
