
import { useEffect, useState } from 'react'
import { getMyChannels, type Channel } from '@/api'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Settings, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/providers/TelegramProvider'
import { ChannelAnalyticsCard } from '@/components/ChannelAnalyticsCard'

export function MyChannelsPage() {
    const { user } = useTelegram();
    const [channels, setChannels] = useState<Channel[]>([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        if (user) {
            loadChannels()
        }
    }, [user])

    const loadChannels = async () => {
        try {
            const data = await getMyChannels()
            setChannels(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-[calc(100dvh-56px-32px)]">
            {/* Pinned Header */}
            <div className="flex-shrink-0 pb-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">My Channels</h1>
                    <Button onClick={() => navigate('/channels/new')} size="sm" className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20">
                        <Plus className="w-4 h-4 mr-2" /> Add New
                    </Button>
                </div>
            </div>

            {/* Scrollable Channel List */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
                ) : channels.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                        <p className="mb-4">You haven't listed any channels yet.</p>
                        <Button onClick={() => navigate('/channels/new')}>List Your First Channel</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {channels.map(channel => (
                            <GlassCard key={channel.id} className="p-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg">{channel.title}</h3>
                                        <button
                                            onClick={() => {
                                                const url = `https://t.me/${channel.username}`;
                                                if ((window as any).Telegram?.WebApp?.openTelegramLink) {
                                                    (window as any).Telegram.WebApp.openTelegramLink(url);
                                                } else {
                                                    window.open(url, '_blank');
                                                }
                                            }}
                                            className="text-sm text-primary hover:underline text-left"
                                        >
                                            @{channel.username}
                                        </button>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className={`px-2 py-1 rounded text-xs font-bold ${channel.isActive ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                            {channel.isActive ? 'Active' : 'Pending'}
                                        </div>
                                        <div className="text-sm font-semibold text-muted-foreground flex flex-col items-end">
                                            <span className="text-[10px] uppercase tracking-wider opacity-70">Packages</span>
                                            <span>{channel.rateCard?.length || 0}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 mb-4">
                                    {!channel.isActive ? (
                                        <Button
                                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                                            onClick={() => navigate(`/channels/edit/${channel.id}`, { state: { from: '/channels/my' } })}
                                        >
                                            Complete Draft
                                        </Button>
                                    ) : (
                                        <>
                                            <Button variant="secondary" size="sm" className="flex-1 text-xs" onClick={() => navigate(`/channels/${channel.id}/view`, { state: { from: '/channels/my' } })}>
                                                View
                                            </Button>
                                            <Button variant="secondary" size="sm" className="flex-1 text-xs" onClick={() => navigate(`/channels/edit/${channel.id}`, { state: { from: '/channels/my' } })}>
                                                <Settings className="w-3 h-3 mr-1" /> Settings
                                            </Button>
                                        </>
                                    )}
                                </div>

                                {/* Analytics Section */}
                                <ChannelAnalyticsCard channel={channel} onSync={loadChannels} />
                            </GlassCard>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
