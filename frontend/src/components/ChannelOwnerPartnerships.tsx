import { useState, useEffect } from 'react'
import { GlassCard, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Handshake, MessageCircle, Clock, DollarSign, AlertTriangle, CheckCircle, XCircle, User, Loader2 } from 'lucide-react'
import { API_URL, getHeaders } from '@/lib/api'
import { haptic } from '@/utils/haptic'

// Deal with advertiser data
interface DealWithDetails {
    id: string
    status: string
    priceAmount: number
    priceCurrency: string
    briefText?: string
    createdAt: string
    channel?: {
        id: string
        title: string
        username?: string
        photoUrl?: string
    }
    advertiser?: {
        id: string
        telegramId: number
        firstName?: string
        username?: string
    }
}

// Status badge config
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    pending: { label: 'Awaiting Payment', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    funded: { label: 'Pending Approval', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    approved: { label: 'Approved', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    in_progress: { label: 'In Progress', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    posted: { label: 'Posted', color: 'text-teal-400', bgColor: 'bg-teal-500/20' },
    monitoring: { label: 'Monitoring', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    released: { label: 'Completed', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    cancelled: { label: 'Cancelled', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    refunded: { label: 'Refunded', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    disputed: { label: 'Disputed', color: 'text-red-400', bgColor: 'bg-red-500/20' }
}

type TabType = 'pending' | 'active' | 'ended'

function StatusBadge({ status }: { status: string }) {
    const config = statusConfig[status] || { label: status, color: 'text-gray-400', bgColor: 'bg-gray-500/20' }
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}>
            {config.label}
        </span>
    )
}

export function ChannelOwnerPartnerships() {
    const [deals, setDeals] = useState<DealWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<TabType>('pending')
    const [processingId, setProcessingId] = useState<string | null>(null)

    useEffect(() => {
        loadDeals()
    }, [])

    const loadDeals = async () => {
        try {
            const response = await fetch(`${API_URL}/deals/channel-owner`, {
                headers: getHeaders()
            })
            if (response.ok) {
                const data = await response.json()
                setDeals(data)
            }
        } catch (error) {
            console.error('Failed to load deals:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (dealId: string, reject: boolean) => {
        setProcessingId(dealId)
        haptic.light()

        try {
            const response = await fetch(`${API_URL}/deals/${dealId}/approve`, {
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    is_advertiser: false,
                    reject
                })
            })

            if (response.ok) {
                haptic.success()
                // Refresh deals after action
                await loadDeals()
            } else {
                const err = await response.json().catch(() => ({}))
                console.error('Approve/Reject failed:', err)
                haptic.error()
            }
        } catch (error) {
            console.error('Failed to process deal:', error)
            haptic.error()
        } finally {
            setProcessingId(null)
        }
    }

    const openBot = () => {
        haptic.light()
        const url = 'https://t.me/DanielAdsMVP_bot'
        if ((window as any).Telegram?.WebApp?.openTelegramLink) {
            (window as any).Telegram.WebApp.openTelegramLink(url)
        } else {
            window.open(url, '_blank')
        }
    }

    // Categorize deals
    const pendingStatuses = ['funded'] // Needs approval
    const activeStatuses = ['approved', 'in_progress', 'posted', 'monitoring', 'disputed'] // In progress + disputes

    const pendingDeals = deals.filter(d => pendingStatuses.includes(d.status))
    const activeDeals = deals.filter(d => activeStatuses.includes(d.status))
    const endedDeals = deals.filter(d => !pendingStatuses.includes(d.status) && !activeStatuses.includes(d.status))

    const displayDeals = activeTab === 'pending' ? pendingDeals
        : activeTab === 'active' ? activeDeals
            : endedDeals

    const getAdvertiserName = (deal: DealWithDetails) => {
        if (deal.advertiser?.firstName) return deal.advertiser.firstName
        if (deal.advertiser?.username) return `@${deal.advertiser.username}`
        return 'Unknown Advertiser'
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <GlassCard className="animate-pulse h-32" />
                <GlassCard className="animate-pulse h-32" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                <Button
                    variant={activeTab === 'pending' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => { haptic.light(); setActiveTab('pending') }}
                    className={`flex-1 ${activeTab === 'pending' ? '' : 'text-muted-foreground'}`}
                >
                    Pending {pendingDeals.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs">{pendingDeals.length}</span>}
                </Button>
                <Button
                    variant={activeTab === 'active' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => { haptic.light(); setActiveTab('active') }}
                    className={`flex-1 ${activeTab === 'active' ? '' : 'text-muted-foreground'}`}
                >
                    Active ({activeDeals.length})
                </Button>
                <Button
                    variant={activeTab === 'ended' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => { haptic.light(); setActiveTab('ended') }}
                    className={`flex-1 ${activeTab === 'ended' ? '' : 'text-muted-foreground'}`}
                >
                    Ended ({endedDeals.length})
                </Button>
            </div>

            {displayDeals.length === 0 ? (
                <GlassCard>
                    <CardContent className="text-center py-10">
                        <Handshake className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                        <p className="text-muted-foreground">
                            {activeTab === 'pending' && 'No pending requests'}
                            {activeTab === 'active' && 'No active partnerships'}
                            {activeTab === 'ended' && 'No ended partnerships'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            Advertisers will send requests here
                        </p>
                    </CardContent>
                </GlassCard>
            ) : (
                <div className="space-y-3">
                    {displayDeals.map(deal => (
                        <GlassCard key={deal.id} className="p-4">
                            <div className="flex flex-col gap-3">
                                {/* Header: Advertiser + Status */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{getAdvertiserName(deal)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                for {deal.channel?.title || 'your channel'}
                                            </p>
                                        </div>
                                    </div>
                                    <StatusBadge status={deal.status} />
                                </div>

                                {/* Brief */}
                                {deal.briefText && (
                                    <p className="text-sm text-muted-foreground bg-white/5 rounded p-2 line-clamp-2">
                                        {deal.briefText}
                                    </p>
                                )}

                                {/* Price */}
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="flex items-center gap-1 text-green-400 font-semibold">
                                        <DollarSign className="w-4 h-4" />
                                        {deal.priceAmount} {deal.priceCurrency}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(deal.createdAt).toLocaleDateString()}
                                    </span>
                                </div>

                                {/* Actions based on tab */}
                                {activeTab === 'pending' && (
                                    <div className="flex gap-2 pt-2 border-t border-white/10">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                            onClick={() => handleApprove(deal.id, false)}
                                            disabled={processingId === deal.id}
                                        >
                                            {processingId === deal.id ? (
                                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                            ) : (
                                                <CheckCircle className="w-4 h-4 mr-1" />
                                            )}
                                            {processingId === deal.id ? 'Processing...' : 'Accept'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                                            onClick={() => handleApprove(deal.id, true)}
                                            disabled={processingId === deal.id}
                                        >
                                            {processingId === deal.id ? (
                                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                            ) : (
                                                <XCircle className="w-4 h-4 mr-1" />
                                            )}
                                            {processingId === deal.id ? 'Processing...' : 'Reject'}
                                        </Button>
                                    </div>
                                )}

                                {/* Disputed warning */}
                                {deal.status === 'disputed' && (
                                    <div className="flex items-center gap-2 text-red-400 bg-red-500/10 rounded p-2 text-sm">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span>This deal is disputed - action required</span>
                                    </div>
                                )}

                                {/* Active deals get bot button */}
                                {activeTab === 'active' && (
                                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="w-3 h-3" />
                                            {deal.status === 'approved' && 'Waiting for post'}
                                            {deal.status === 'in_progress' && 'Creating content'}
                                            {deal.status === 'posted' && 'Ad is live'}
                                            {deal.status === 'monitoring' && 'Being monitored'}
                                            {deal.status === 'disputed' && 'Needs attention'}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={openBot}
                                            className="text-blue-400"
                                        >
                                            <MessageCircle className="w-4 h-4 mr-1" />
                                            Message
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    )
}
