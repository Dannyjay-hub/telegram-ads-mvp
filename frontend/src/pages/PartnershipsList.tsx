
import { useState, useEffect, useCallback } from 'react'
import { GlassCard, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Handshake, Copy, Check, Clock, Eye, Calendar, CheckCircle, AlertTriangle, XCircle, Loader2, HelpCircle } from 'lucide-react'
import { API_URL, getHeaders, apiFetch, proposePostTime, acceptPostTime, getSchedulingStatus } from '@/api'
import { haptic } from '@/utils/haptic'
import { openTelegramLink, getBotDeepLinkUrl, showAlert } from '@/lib/telegram'
import { displayTime, formatCountdown } from '@/utils/time'
import { TimePickerModal } from '@/components/TimePickerModal'

// Deal with channel data
interface DealWithChannel {
    id: string
    status: string
    priceAmount: number
    priceCurrency: string
    paymentMemo?: string
    briefText?: string
    contentItems?: Array<{ title: string; quantity: number }>
    campaignTitle?: string
    campaignId?: string
    createdAt: string
    channel?: {
        id: string
        title: string
        username?: string
        photoUrl?: string
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
    draft: { label: 'Draft', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
    pending: { label: 'Pending Approval', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    funded: { label: 'Payment Received', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    draft_pending: { label: 'Creating Draft', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    draft_submitted: { label: 'Review Draft', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    changes_requested: { label: 'Revising', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    approved: { label: 'Set Schedule', color: 'text-green-400', bgColor: 'bg-green-500/20' },
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
    disputed: { label: 'Disputed', color: 'text-orange-400', bgColor: 'bg-orange-500/20' }
}

function StatusBadge({ status }: { status: string }) {
    const config = statusConfig[status] || statusConfig.draft
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}>
            {config.label}
        </span>
    )
}

function CopyMemo({ memo }: { memo: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation()
        await navigator.clipboard.writeText(memo)
        haptic.light()
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
            <span>Deal ID</span>
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
    )
}

export function PartnershipsList() {
    const [deals, setDeals] = useState<DealWithChannel[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'completed'>('pending')

    const [processingId, setProcessingId] = useState<string | null>(null)
    const [processingAction, setProcessingAction] = useState<'accept' | 'reject' | null>(null)
    const [timePickerDealId, setTimePickerDealId] = useState<string | null>(null)
    const [schedulingProposal, setSchedulingProposal] = useState<{
        proposedTime: string;
        proposedBy: 'advertiser' | 'channel_owner';
    } | null>(null)

    const loadDeals = useCallback(async () => {
        try {
            const response = await apiFetch(`${API_URL}/deals/my`, {
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
        const activeTransitionStates = ['draft_pending', 'scheduling', 'draft_submitted', 'changes_requested']
        const hasActiveDeals = deals.some(d => activeTransitionStates.includes(d.status))

        if (hasActiveDeals) {
            const interval = setInterval(loadDeals, 3000)
            return () => clearInterval(interval)
        }
    }, [deals, loadDeals])

    // Auto-navigate to the correct tab when coming from a deep link
    useEffect(() => {
        if (deals.length === 0) return
        const params = new URLSearchParams(window.location.search)
        const dealId = params.get('deal')
        if (!dealId) return

        const deal = deals.find(d => d.id === dealId)
        if (!deal) return

        const pendingStatuses = ['pending', 'funded']
        const activeStatuses = ['draft_pending', 'draft_submitted', 'changes_requested', 'approved', 'scheduling', 'scheduled', 'posted', 'monitoring', 'disputed', 'in_progress']

        if (pendingStatuses.includes(deal.status)) {
            setActiveTab('pending')
        } else if (activeStatuses.includes(deal.status)) {
            setActiveTab('active')
        } else {
            setActiveTab('completed')
        }

        // Clear query param after handling
        window.history.replaceState({}, '', window.location.pathname)
    }, [deals])


    // Deep link to bot for specific actions
    const openBotDeepLink = (path: string) => {
        haptic.light()
        openTelegramLink(getBotDeepLinkUrl(path))
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
        await proposePostTime(timePickerDealId, time, 'advertiser')
        await loadDeals()
    }

    // Handle time acceptance
    const handleAcceptTime = async () => {
        if (!timePickerDealId) return
        await acceptPostTime(timePickerDealId)
        await loadDeals()
    }

    // Filter out drafts entirely - they're unpaid and shouldn't appear anywhere
    const visibleDeals = deals.filter(d => d.status !== 'draft')

    // Pending: ONLY accept/reject decisions
    const pendingStatuses = ['pending', 'funded']
    // Active: all working deals (drafting, reviewing, scheduling, posting, monitoring)
    const activeStatuses = ['draft_pending', 'draft_submitted', 'changes_requested', 'approved', 'scheduling', 'scheduled', 'posted', 'monitoring', 'disputed', 'in_progress']
    // Completed: finished states
    const completedStatuses = ['released', 'cancelled', 'refunded', 'pending_refund', 'completed', 'rejected']

    const pendingDeals = visibleDeals.filter(d => pendingStatuses.includes(d.status))
    const activeDeals = visibleDeals.filter(d => activeStatuses.includes(d.status))
    const completedDeals = visibleDeals.filter(d => completedStatuses.includes(d.status))

    const displayDeals = activeTab === 'pending' ? pendingDeals : activeTab === 'active' ? activeDeals : completedDeals

    // Accept/Reject handler for pending deals (closed campaign applications)
    const handlePendingAction = async (dealId: string, action: 'accept' | 'reject') => {
        setProcessingId(dealId)
        setProcessingAction(action)
        haptic.light()

        try {
            const response = await apiFetch(`${API_URL}/deals/${dealId}/approve`, {
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    is_advertiser: true,
                    reject: action === 'reject'
                })
            })

            if (response.ok) {
                haptic.success()
                await loadDeals()
            } else {
                const err = await response.json().catch(() => ({}))
                console.error('Action failed:', err)
                haptic.error()
            }
        } catch (error) {
            console.error('Failed to process:', error)
            haptic.error()
        } finally {
            setProcessingId(null)
            setProcessingAction(null)
        }
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <GlassCard className="animate-pulse h-24" />
                <GlassCard className="animate-pulse h-24" />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[calc(100dvh-56px-32px)]">
            {/* Pinned Tabs */}
            <div className="flex-shrink-0 pb-3">
                <div className="flex gap-2">
                    <Button
                        variant={activeTab === 'pending' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => { haptic.light(); setActiveTab('pending') }}
                        className="flex-1 text-xs px-2"
                    >
                        Pending ({pendingDeals.length})
                    </Button>
                    <Button
                        variant={activeTab === 'active' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => { haptic.light(); setActiveTab('active') }}
                        className="flex-1 text-xs px-2"
                    >
                        Active ({activeDeals.length})
                    </Button>
                    <Button
                        variant={activeTab === 'completed' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => { haptic.light(); setActiveTab('completed') }}
                        className="flex-1 text-xs px-2"
                    >
                        Completed ({completedDeals.length})
                    </Button>
                </div>
            </div>

            {/* Scrollable Deal List */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                {displayDeals.length === 0 ? (
                    <GlassCard>
                        <CardContent className="text-center py-10">
                            <Handshake className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                            <p className="text-muted-foreground">
                                {activeTab === 'pending'
                                    ? 'No pending approvals'
                                    : activeTab === 'active'
                                        ? 'No active partnerships yet'
                                        : 'No completed partnerships yet'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                {activeTab === 'pending' ? 'Deals awaiting approval will appear here' : 'Browse channels or campaigns in the Marketplace'}
                            </p>
                        </CardContent>
                    </GlassCard>
                ) : (
                    <div className="space-y-3">
                        {displayDeals.map(deal => (
                            <GlassCard key={deal.id} className="p-4">
                                <div className="flex flex-col gap-3">
                                    {/* Header */}
                                    <div className="flex items-start gap-3">
                                        {/* Channel Avatar */}
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                                            {deal.channel?.photoUrl ? (
                                                <img src={deal.channel.photoUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                deal.channel?.title?.charAt(0) || '?'
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="font-semibold truncate">
                                                    {deal.channel?.title || 'Unknown Channel'}
                                                </h3>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <StatusBadge status={deal.status} />
                                                </div>
                                            </div>

                                            {deal.channel?.username && (
                                                <p className="text-xs text-muted-foreground">@{deal.channel.username}</p>
                                            )}

                                            {/* Campaign / Service Title */}
                                            {(deal.campaignTitle || deal.briefText) && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {deal.campaignTitle || deal.briefText}
                                                </p>
                                            )}

                                            {/* Price and Deal ID */}
                                            <div className="flex items-center justify-between mt-2 text-sm">
                                                <span className="text-green-400 font-semibold">
                                                    {deal.priceAmount} {deal.priceCurrency}
                                                </span>
                                                <CopyMemo memo={deal.paymentMemo || deal.id} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status-specific UI */}
                                    {/* Pending: Accept/Reject (closed campaign applications) */}
                                    {deal.status === 'pending' && (
                                        <div className="flex gap-2 pt-2 border-t border-border">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="flex-1 bg-green-600 hover:bg-green-700"
                                                onClick={() => handlePendingAction(deal.id, 'accept')}
                                                disabled={processingId === deal.id}
                                            >
                                                {processingId === deal.id && processingAction === 'accept' ? (
                                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                ) : (
                                                    <CheckCircle className="w-4 h-4 mr-1" />
                                                )}
                                                Accept
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                                                onClick={() => handlePendingAction(deal.id, 'reject')}
                                                disabled={processingId === deal.id}
                                            >
                                                {processingId === deal.id && processingAction === 'reject' ? (
                                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                ) : (
                                                    <XCircle className="w-4 h-4 mr-1" />
                                                )}
                                                Reject
                                            </Button>
                                        </div>
                                    )}

                                    {deal.status === 'funded' && (
                                        <p className="text-xs text-blue-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Waiting for channel owner approval
                                        </p>
                                    )}

                                    {deal.status === 'draft_pending' && (
                                        <p className="text-xs text-blue-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Channel owner is creating draft
                                        </p>
                                    )}

                                    {deal.status === 'changes_requested' && (
                                        <p className="text-xs text-orange-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Channel owner is revising draft
                                        </p>
                                    )}

                                    {/* Draft Submitted: Review button */}
                                    {deal.status === 'draft_submitted' && (
                                        <div className="pt-2 border-t border-border">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="w-full bg-purple-600 hover:bg-purple-700"
                                                onClick={() => openBotDeepLink(`review_${deal.id}`)}
                                            >
                                                <Eye className="w-4 h-4 mr-1" />
                                                Review Draft
                                            </Button>
                                        </div>
                                    )}

                                    {/* Approved: Propose time button */}
                                    {deal.status === 'approved' && (
                                        <div className="pt-2 border-t border-border">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="w-full bg-green-600 hover:bg-green-700"
                                                onClick={() => openTimePicker(deal.id)}
                                            >
                                                <Calendar className="w-4 h-4 mr-1" />
                                                Propose Post Time
                                            </Button>
                                        </div>
                                    )}

                                    {/* Scheduling: Accept or Counter */}
                                    {deal.status === 'scheduling' && (
                                        <div className="pt-2 border-t border-border space-y-2">
                                            {!deal.proposedPostTime ? (
                                                /* No time proposed yet - show propose button */
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    className="w-full bg-green-600 hover:bg-green-700"
                                                    onClick={() => openTimePicker(deal.id)}
                                                >
                                                    <Calendar className="w-4 h-4 mr-1" />
                                                    Propose Post Time
                                                </Button>
                                            ) : deal.timeProposedBy !== 'advertiser' ? (
                                                <>
                                                    <div className="text-sm text-cyan-400">
                                                        Channel owner proposed: {displayTime(deal.proposedPostTime)}
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
                                                    Waiting for channel owner to accept your time
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


                                    {/* Monitoring: Info message */}
                                    {deal.status === 'monitoring' && (
                                        <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-sm">
                                            <p className="text-cyan-400 flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                Being monitored for 24h
                                            </p>
                                            {deal.monitoringEndAt && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Funds release: {displayTime(deal.monitoringEndAt)}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Failed to Post */}
                                    {deal.status === 'failed_to_post' && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            Post failed - contact support
                                        </div>
                                    )}

                                    {/* Disputed warning */}
                                    {deal.status === 'disputed' && (
                                        <div className="flex items-center gap-2 text-orange-400 bg-orange-500/10 rounded p-2 text-sm">
                                            <AlertTriangle className="w-4 h-4" />
                                            <span>This deal is disputed</span>
                                        </div>
                                    )}

                                    {/* Footer: Date + Support */}
                                    <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                                        <span>{new Date(deal.createdAt).toLocaleDateString()}</span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => { haptic.light(); showAlert('Support is coming soon') }}
                                            className="text-blue-400 h-6 px-2"
                                        >
                                            <HelpCircle className="w-3 h-3 mr-1" />
                                            Support
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
                    userRole="advertiser"
                    onPropose={handleProposeTime}
                    onAccept={handleAcceptTime}
                />
            </div>
        </div >
    )
}
