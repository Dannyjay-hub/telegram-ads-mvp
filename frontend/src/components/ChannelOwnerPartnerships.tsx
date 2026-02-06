import { useState, useEffect, useCallback } from 'react'
import { GlassCard, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Handshake, MessageCircle, Clock, DollarSign, AlertTriangle, CheckCircle, XCircle, User, Loader2, Send, Calendar, Eye } from 'lucide-react'
import { API_URL, getHeaders, proposePostTime, acceptPostTime, getSchedulingStatus } from '@/lib/api'
import { haptic } from '@/utils/haptic'
import { openTelegramLink } from '@/lib/telegram'
import { displayTime, formatCountdown, formatRelativeTime } from '@/utils/time'
import { TimePickerModal } from './TimePickerModal'

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
    // Post-escrow fields
    draftText?: string
    draftMediaFileId?: string
    proposedPostTime?: string
    timeProposedBy?: 'advertiser' | 'channel_owner'
    agreedPostTime?: string
    monitoringEndAt?: string
}

// Status badge config
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    pending: { label: 'Awaiting Payment', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    funded: { label: 'Pending Approval', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    draft_pending: { label: 'Create Draft', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    draft_submitted: { label: 'Under Review', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    changes_requested: { label: 'Changes Needed', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    approved: { label: 'Approved', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    scheduling: { label: 'Setting Time', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    scheduled: { label: 'Scheduled', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
    rejected: { label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    in_progress: { label: 'In Progress', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    posted: { label: 'Ad is Live', color: 'text-teal-400', bgColor: 'bg-teal-500/20' },
    failed_to_post: { label: 'Post Failed', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    monitoring: { label: 'Monitoring (24h)', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    released: { label: 'Completed', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    cancelled: { label: 'Cancelled', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    refunded: { label: 'Refunded', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    pending_refund: { label: 'Refund Pending', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
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
    const [processingAction, setProcessingAction] = useState<'accept' | 'reject' | null>(null)
    const [lastFetchedAt, setLastFetchedAt] = useState<Date>(new Date())
    const [timePickerDealId, setTimePickerDealId] = useState<string | null>(null)
    const [schedulingProposal, setSchedulingProposal] = useState<{
        proposedTime: string;
        proposedBy: 'advertiser' | 'channel_owner';
    } | null>(null)

    const loadDeals = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/deals/channel-owner`, {
                headers: getHeaders()
            })
            if (response.ok) {
                const data = await response.json()
                setDeals(data)
                setLastFetchedAt(new Date())
            }
        } catch (error) {
            console.error('Failed to load deals:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    // Initial load
    useEffect(() => {
        loadDeals()
    }, [loadDeals])

    // Focus-based refetch (when user returns from bot)
    useEffect(() => {
        const handleFocus = () => loadDeals()
        window.addEventListener('focus', handleFocus)
        // Telegram WebApp viewport changes (covers mini app reactivation)
        const tg = (window as any).Telegram?.WebApp
        if (tg?.onEvent) {
            tg.onEvent('viewportChanged', handleFocus)
        }
        return () => {
            window.removeEventListener('focus', handleFocus)
            if (tg?.offEvent) {
                tg.offEvent('viewportChanged', handleFocus)
            }
        }
    }, [loadDeals])

    // Polling for active transition states
    useEffect(() => {
        const activeTransitionStates = ['draft_pending', 'scheduling', 'draft_submitted']
        const hasActiveDeals = deals.some(d => activeTransitionStates.includes(d.status))

        if (hasActiveDeals) {
            const interval = setInterval(loadDeals, 3000)
            return () => clearInterval(interval)
        }
    }, [deals, loadDeals])

    const handleApprove = async (dealId: string, reject: boolean) => {
        setProcessingId(dealId)
        setProcessingAction(reject ? 'reject' : 'accept')
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
            setProcessingAction(null)
        }
    }

    const openBot = () => {
        haptic.light()
        openTelegramLink('https://t.me/DanielAdsMVP_bot')
    }

    // Deep link to bot for specific actions
    const openBotDeepLink = (path: string) => {
        haptic.light()
        openTelegramLink(`https://t.me/DanielAdsMVP_bot?start=${path}`)
    }

    // Open time picker with existing proposal if any
    const openTimePicker = async (dealId: string) => {
        try {
            const status = await getSchedulingStatus(dealId)
            setSchedulingProposal(status.proposal)
            setTimePickerDealId(dealId)
        } catch (error) {
            console.error('Failed to get scheduling status:', error)
            setTimePickerDealId(dealId)
        }
    }

    // Handle time proposal
    const handleProposeTime = async (time: Date) => {
        if (!timePickerDealId) return
        await proposePostTime(timePickerDealId, time)
        await loadDeals()
    }

    // Handle time acceptance
    const handleAcceptTime = async () => {
        if (!timePickerDealId) return
        await acceptPostTime(timePickerDealId)
        await loadDeals()
    }

    // Open support for failed posts
    const openSupport = () => {
        haptic.light()
        openTelegramLink('https://t.me/DanielAdsMVP_bot')
    }

    // Categorize deals - including new post-escrow statuses
    const pendingStatuses = ['funded', 'draft_pending', 'changes_requested'] // Needs action from channel owner
    const activeStatuses = ['draft_submitted', 'approved', 'scheduling', 'scheduled', 'posted', 'monitoring', 'disputed', 'in_progress'] // In progress

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

                                {/* Actions based on status */}
                                {/* Funded: Accept/Reject */}
                                {deal.status === 'funded' && (
                                    <div className="flex gap-2 pt-2 border-t border-white/10">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                            onClick={() => handleApprove(deal.id, false)}
                                            disabled={processingId === deal.id}
                                        >
                                            {processingId === deal.id && processingAction === 'accept' ? (
                                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                            ) : (
                                                <CheckCircle className="w-4 h-4 mr-1" />
                                            )}
                                            {processingId === deal.id && processingAction === 'accept' ? 'Processing...' : 'Accept'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                                            onClick={() => handleApprove(deal.id, true)}
                                            disabled={processingId === deal.id}
                                        >
                                            {processingId === deal.id && processingAction === 'reject' ? (
                                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                            ) : (
                                                <XCircle className="w-4 h-4 mr-1" />
                                            )}
                                            {processingId === deal.id && processingAction === 'reject' ? 'Processing...' : 'Reject'}
                                        </Button>
                                    </div>
                                )}

                                {/* Draft Pending: Create Draft button */}
                                {(deal.status === 'draft_pending' || deal.status === 'changes_requested') && (
                                    <div className="flex gap-2 pt-2 border-t border-white/10">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                                            onClick={() => openBotDeepLink(`draft_${deal.id}`)}
                                        >
                                            <Send className="w-4 h-4 mr-1" />
                                            {deal.status === 'changes_requested' ? 'Edit Draft' : 'Create Draft'}
                                        </Button>
                                    </div>
                                )}


                                {/* Draft Submitted: Waiting message */}
                                {deal.status === 'draft_submitted' && (
                                    <div className="flex items-center gap-2 pt-2 border-t border-white/10 text-purple-400 text-sm">
                                        <Eye className="w-4 h-4" />
                                        <span>Waiting for advertiser review</span>
                                    </div>
                                )}

                                {/* Scheduling: Channel owner waits for advertiser to propose first */}
                                {deal.status === 'scheduling' && (
                                    <div className="pt-2 border-t border-white/10 space-y-2">
                                        {!deal.proposedPostTime ? (
                                            /* No time proposed yet - waiting for advertiser */
                                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                Waiting for advertiser to propose a time
                                            </div>
                                        ) : deal.timeProposedBy !== 'channel_owner' ? (
                                            <>
                                                <div className="text-sm text-cyan-400">
                                                    Advertiser proposed: {displayTime(deal.proposedPostTime)}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                                        onClick={() => openTimePicker(deal.id)}
                                                    >
                                                        <CheckCircle className="w-4 h-4 mr-1" />
                                                        Accept
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1"
                                                        onClick={() => openTimePicker(deal.id)}
                                                    >
                                                        <Calendar className="w-4 h-4 mr-1" />
                                                        Counter
                                                    </Button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                Waiting for advertiser to accept your counter
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Scheduled: Show countdown */}
                                {deal.status === 'scheduled' && deal.agreedPostTime && (
                                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-sm">
                                        <p className="text-indigo-400 flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            Scheduled for {displayTime(deal.agreedPostTime)}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Posting {formatCountdown(deal.agreedPostTime)}
                                        </p>
                                    </div>
                                )}

                                {/* Monitoring: Warning message */}
                                {deal.status === 'monitoring' && (
                                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
                                        <p className="text-yellow-400 flex items-center gap-1">
                                            <AlertTriangle className="w-4 h-4" />
                                            Post is LIVE - Don't delete for 24h
                                        </p>
                                        {deal.monitoringEndAt && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Ends: {displayTime(deal.monitoringEndAt)}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Failed to Post: Report issue */}
                                {deal.status === 'failed_to_post' && (
                                    <div className="pt-2 border-t border-white/10 space-y-2">
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            Post failed - contact support
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full border-red-500/50 text-red-400"
                                            onClick={openSupport}
                                        >
                                            Report Issue
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

                                {/* Posted: Shows ad is live */}
                                {deal.status === 'posted' && (
                                    <div className="flex items-center gap-1 text-teal-400 text-sm pt-2 border-t border-white/10">
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Ad is live on channel</span>
                                    </div>
                                )}

                                {/* Last updated indicator */}
                                <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                                    <span>Updated {formatRelativeTime(lastFetchedAt)}</span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={openBot}
                                        className="text-blue-400 h-6 px-2"
                                    >
                                        <MessageCircle className="w-3 h-3 mr-1" />
                                        Chat
                                    </Button>
                                </div>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}

            {/* Time Picker Modal */}
            <TimePickerModal
                open={timePickerDealId !== null}
                onClose={() => setTimePickerDealId(null)}
                dealId={timePickerDealId || ''}
                existingProposal={schedulingProposal}
                userRole="channel_owner"
                onPropose={handleProposeTime}
                onAccept={handleAcceptTime}
            />
        </div>
    )
}
