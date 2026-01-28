
import { useEffect, useState } from 'react'
import { getMyChannels, type Channel } from '@/lib/api'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Settings, Loader2, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/providers/TelegramProvider'
import { ChannelAnalyticsCard } from './ChannelAnalyticsCard'

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
            const data = await getMyChannels(user?.telegramId?.toString() || '704124192')
            setChannels(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="pb-20 space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/channels/dashboard')} className="mr-1">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1 flex justify-between items-center">
                    <h1 className="text-2xl font-bold">My Channels</h1>
                    <Button onClick={() => navigate('/channels/new')} size="sm" className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20">
                        <Plus className="w-4 h-4 mr-2" /> Add New
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
            ) : channels.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-xl">
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
                                    <a
                                        href={`https://t.me/${channel.username}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline"
                                    >
                                        @{channel.username}
                                    </a>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className={`px-2 py-1 rounded text-xs font-bold ${channel.isActive ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                        {channel.isActive ? 'Active' : 'Pending'}
                                    </div>
                                    <div className="text-sm font-semibold text-muted-foreground flex flex-col items-end">
                                        <span className="text-[10px] uppercase tracking-wider opacity-70">Base Price</span>
                                        <span>${channel.basePriceAmount}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mb-4">
                                {!channel.isActive ? (
                                    <Button
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                        onClick={() => navigate(`/channels/edit/${channel.id}`)}
                                    >
                                        Complete Draft
                                    </Button>
                                ) : (
                                    <>
                                        <Button variant="secondary" size="sm" className="flex-1 text-xs" onClick={() => navigate(`/channels/${channel.id}/view`)}>
                                            View
                                        </Button>
                                        <Button variant="secondary" size="sm" className="flex-1 text-xs" onClick={() => navigate(`/channels/edit/${channel.id}`)}>
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
    )
}
