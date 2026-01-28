import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/card'
import { ArrowLeft, Settings, RefreshCw, Check, Users, Eye, TrendingUp } from 'lucide-react'
import { type Channel, API_URL, getHeaders } from '@/lib/api'
import { useTelegram } from '@/providers/TelegramProvider'

export function ChannelViewPage() {
    const navigate = useNavigate()
    const { id } = useParams()
    const { user } = useTelegram()
    const [channel, setChannel] = useState<Channel | null>(null)
    const [loading, setLoading] = useState(true)
    const [isOwner, setIsOwner] = useState(false)

    useEffect(() => {
        if (id) loadChannel()
    }, [id])

    const loadChannel = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_URL}/channels/${id}`, { headers: getHeaders() })
            if (!res.ok) throw new Error('Channel not found')
            const data = await res.json()
            setChannel(data)

            // Check if current user is an owner or PR manager of this channel
            if (user?.telegramId) {
                try {
                    const adminRes = await fetch(`${API_URL}/channels/${id}/admins`, { headers: getHeaders() })
                    if (adminRes.ok) {
                        const adminData = await adminRes.json()
                        // Check if user is the owner
                        const userIsOwner = adminData.owner?.telegram_id === user.telegramId
                        // Check if user is a PR manager
                        const userIsPRManager = (adminData.pr_managers || []).some(
                            (pm: any) => pm.telegram_id === user.telegramId
                        )
                        // Owner OR PR Manager can access settings
                        setIsOwner(userIsOwner || userIsPRManager)
                    }
                } catch {
                    setIsOwner(false)
                }
            } else {
                setIsOwner(false)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleSync = async () => {
        try {
            await fetch(`${API_URL}/channels/${id}/sync_stats`, {
                method: 'POST',
                headers: getHeaders()
            })
            await loadChannel()
        } catch (e) {
            console.error(e)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (!channel) {
        return (
            <div className="p-4 text-center">
                <p className="text-muted-foreground">Channel not found</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
                    Go Back
                </Button>
            </div>
        )
    }

    const subscribers = channel.verifiedStats?.subscribers || 0
    const avgViews = channel.avgViews || 0
    const engagement = subscribers > 0 ? ((avgViews / subscribers) * 100).toFixed(1) : '0'

    return (
        <div className="pb-20 max-w-lg mx-auto p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Channel Details</h1>
                </div>
                {isOwner && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/channels/${id}/settings`)}
                    >
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                    </Button>
                )}
            </div>

            {/* Channel Header Card */}
            <GlassCard className="p-6 text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                    {channel.title?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div className="flex items-center justify-center gap-2 mb-1">
                    <h2 className="text-xl font-bold">{channel.title}</h2>
                    {channel.isActive && (
                        <span className="bg-green-500/20 text-green-500 text-xs px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3 inline mr-1" />
                            Verified
                        </span>
                    )}
                </div>
                <p className="text-muted-foreground">@{channel.username}</p>

                {channel.description && (
                    <p className="text-sm text-muted-foreground mt-4 border-t border-white/10 pt-4">
                        {channel.description}
                    </p>
                )}
            </GlassCard>

            {/* Stats Grid */}
            <GlassCard className="p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Analytics</h3>
                    {isOwner && (
                        <Button variant="ghost" size="sm" onClick={handleSync} className="text-xs text-primary">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Sync
                        </Button>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <Users className="w-5 h-5 mx-auto mb-1 text-primary/60" />
                        <p className="text-xl font-bold">{subscribers.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Subscribers</p>
                    </div>
                    <div>
                        <Eye className="w-5 h-5 mx-auto mb-1 text-primary/60" />
                        <p className="text-xl font-bold">{avgViews.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Avg Views</p>
                    </div>
                    <div>
                        <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary/60" />
                        <p className="text-xl font-bold">{engagement}%</p>
                        <p className="text-xs text-muted-foreground">Engagement</p>
                    </div>
                </div>
            </GlassCard>

            {/* Service Packages */}
            <GlassCard className="p-4 mb-6">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
                    Available Packages
                </h3>
                <div className="space-y-3">
                    {channel.rateCard && channel.rateCard.length > 0 ? (
                        channel.rateCard.map((pkg: any, idx: number) => (
                            <div key={idx} className="bg-white/5 p-4 rounded-xl flex justify-between items-center border border-white/5">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">{pkg.title}</span>
                                        <span className="text-[10px] uppercase bg-primary/20 text-primary px-1.5 py-0.5 rounded tracking-wider">
                                            {pkg.type}
                                        </span>
                                    </div>
                                    {pkg.description && (
                                        <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
                                    )}
                                </div>
                                <span className="font-bold text-lg text-primary">${pkg.price}</span>
                            </div>
                        ))
                    ) : (
                        <div className="bg-white/5 p-4 rounded-xl flex justify-between items-center border border-white/5">
                            <div>
                                <span className="font-bold">Standard Post</span>
                                <p className="text-xs text-muted-foreground">Starting price</p>
                            </div>
                            <span className="font-bold text-lg text-primary">${channel.basePriceAmount || 100}</span>
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Category & Tags */}
            {(channel.category || (channel.tags && channel.tags.length > 0)) && (
                <GlassCard className="p-4 mb-6">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
                        Details
                    </h3>
                    {channel.category && (
                        <div className="mb-3">
                            <span className="text-xs text-muted-foreground">Category: </span>
                            <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded">{channel.category}</span>
                        </div>
                    )}
                    {channel.tags && channel.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {channel.tags.map((tag, idx) => (
                                <span key={idx} className="bg-white/10 text-xs px-2 py-1 rounded">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </GlassCard>
            )}

            {/* Action Button (for non-owners / advertisers) */}
            {!isOwner && (
                <Button className="w-full h-12 text-lg" onClick={() => navigate(`/deals/new?channel=${id}`)}>
                    Start a Deal
                </Button>
            )}
        </div>
    )
}
