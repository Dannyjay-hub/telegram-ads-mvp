import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2, AlertTriangle, Clock, XCircle } from 'lucide-react'

import { API_URL, getHeaders, apiFetch } from '@/api'

interface Campaign {
    id: string
    title: string
    brief: string
    totalBudget: number
    currency: string
    slots: number
    slotsFilled: number
    perChannelBudget: number
    campaignType: 'open' | 'closed'
    status: 'draft' | 'active' | 'filled' | 'expired' | 'ended'
    minSubscribers?: number
    maxSubscribers?: number
    requiredLanguages?: string[]
    requiredCategories?: string[]
    expiresAt?: string
    createdAt: string
    refundAmount?: number
    endedAt?: string
}

interface Application {
    id: string
    campaignId: string
    channelId: string
    status: 'pending' | 'approved' | 'rejected'
    appliedAt: string
    channel?: {
        id: string
        title: string
        username?: string
        verifiedStats?: { subscribers?: number }
    }
}

export function CampaignDetail() {
    const { id } = useParams()
    const navigate = useNavigate()

    const [campaign, setCampaign] = useState<Campaign | null>(null)
    const [applications, setApplications] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [showEndConfirm, setShowEndConfirm] = useState(false)
    const [showDurationEdit, setShowDurationEdit] = useState(false)
    const [durationDays, setDurationDays] = useState(7)

    // Handle Telegram back button - go to advertiser dashboard
    useEffect(() => {
        const WebApp = (window as any).Telegram?.WebApp
        if (!WebApp) return

        WebApp.BackButton.show()

        const handleBack = () => navigate('/advertiser')
        WebApp.BackButton.onClick(handleBack)

        return () => WebApp.BackButton.offClick(handleBack)
    }, [navigate])

    useEffect(() => {
        if (id) fetchCampaign()
    }, [id])

    const fetchCampaign = async () => {
        try {
            const [campaignRes, appsRes] = await Promise.all([
                fetch(`${API_URL}/campaigns/${id}`, {
                    headers: getHeaders()
                }),
                fetch(`${API_URL}/campaigns/${id}/applications`, {
                    headers: getHeaders()
                })
            ])

            if (campaignRes.ok) {
                const data = await campaignRes.json()
                setCampaign(data.campaign)
            }

            if (appsRes.ok) {
                const data = await appsRes.json()
                setApplications(data.applications || [])
            }
        } catch (e) {
            console.error('Error fetching campaign:', e)
        } finally {
            setLoading(false)
        }
    }


    const publishCampaign = async () => {
        setActionLoading('publish')
        try {
            const response = await apiFetch(`${API_URL}/campaigns/${id}/publish`, {
                method: 'POST',
                headers: getHeaders()
            })

            if (response.ok) {
                await fetchCampaign()
            }
        } catch (e) {
            console.error('Error publishing:', e)
        } finally {
            setActionLoading(null)
        }
    }

    const endCampaign = async () => {
        setActionLoading('end')
        try {
            const res = await apiFetch(`${API_URL}/campaigns/${campaign!.id}/end`, {
                method: 'POST',
                headers: getHeaders()
            })
            if (res.ok) {
                setShowEndConfirm(false)
                await fetchCampaign()
            }
        } catch (e) {
            console.error('End campaign failed:', e)
        } finally {
            setActionLoading(null)
        }
    }

    const extendCampaign = async () => {
        setActionLoading('extend')
        try {
            const res = await apiFetch(`${API_URL}/campaigns/${campaign!.id}/extend`, {
                method: 'POST',
                headers: getHeaders()
            })
            if (res.ok) {
                await fetchCampaign()
            }
        } catch (e) {
            console.error('Extension failed:', e)
        } finally {
            setActionLoading(null)
        }
    }

    const updateDuration = async () => {
        setActionLoading('duration')
        try {
            const newExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
            const res = await apiFetch(`${API_URL}/campaigns/${campaign!.id}/duration`, {
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ expiresAt: newExpiresAt.toISOString() })
            })
            if (res.ok) {
                setShowDurationEdit(false)
                await fetchCampaign()
            }
        } catch (e) {
            console.error('Duration update failed:', e)
        } finally {
            setActionLoading(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!campaign) {
        return (
            <div className="text-center py-20">
                <p className="text-muted-foreground">Campaign not found</p>
            </div>
        )
    }

    const approvedApps = applications.filter(a => a.status === 'approved')
    const slotsLeft = campaign.slots - campaign.slotsFilled
    const refundPreview = slotsLeft * campaign.perChannelBudget

    // Grace period calculation for expired campaigns
    const isExpired = campaign.status === 'expired'
    const isEnded = campaign.status === 'ended'
    const graceEnd = campaign.expiresAt
        ? new Date(new Date(campaign.expiresAt).getTime() + 24 * 60 * 60 * 1000)
        : null
    const isInGrace = isExpired && graceEnd && Date.now() < graceEnd.getTime()
    const hoursLeft = graceEnd ? Math.max(0, Math.round((graceEnd.getTime() - Date.now()) / (1000 * 60 * 60))) : 0

    // Days until expiry (for active campaigns)
    const daysUntilExpiry = campaign.expiresAt
        ? Math.max(0, Math.ceil((new Date(campaign.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold">{campaign.title}</h1>
                <p className="text-xs text-muted-foreground capitalize">{campaign.status}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <GlassCard className="text-center p-4">
                    <div className="text-2xl font-bold text-primary">{campaign.totalBudget}</div>
                    <div className="text-xs text-muted-foreground">{campaign.currency}</div>
                </GlassCard>
                <GlassCard className="text-center p-4">
                    <div className="text-2xl font-bold">{campaign.slotsFilled}/{campaign.slots}</div>
                    <div className="text-xs text-muted-foreground">Slots</div>
                </GlassCard>
                <GlassCard className="text-center p-4">
                    <div className="text-2xl font-bold">{campaign.perChannelBudget}</div>
                    <div className="text-xs text-muted-foreground">Per Channel</div>
                </GlassCard>
            </div>

            {/* Brief */}
            <GlassCard className="p-4">
                <h3 className="font-semibold mb-2">Brief</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{campaign.brief}</p>
            </GlassCard>

            {/* Draft Actions */}
            {campaign.status === 'draft' && (
                <GlassCard className="p-4 space-y-3">
                    <h3 className="font-semibold">Ready to Launch?</h3>
                    <p className="text-sm text-muted-foreground">
                        {campaign.campaignType === 'open'
                            ? 'Publishing will make your campaign visible. Channels will be auto-approved.'
                            : 'Publishing will make your campaign visible. You\'ll review each application.'}
                    </p>
                    <Button
                        className="w-full"
                        onClick={publishCampaign}
                        disabled={actionLoading === 'publish'}
                    >
                        {actionLoading === 'publish' ? 'Publishing...' : 'Publish Campaign'}
                    </Button>
                </GlassCard>
            )}

            {/* Active Campaign: Duration + End options */}
            {campaign.status === 'active' && (
                <>
                    {/* Duration info */}
                    {daysUntilExpiry !== null && (
                        <GlassCard className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    <h3 className="font-semibold">Campaign Duration</h3>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''} left
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Expires {new Date(campaign.expiresAt!).toLocaleDateString()}
                            </p>

                            {showDurationEdit ? (
                                <div className="space-y-3 pt-2 border-t border-border/50">
                                    <p className="text-sm text-muted-foreground">Set new duration from today:</p>
                                    <div className="flex gap-2">
                                        {[3, 7, 14, 30].map(d => (
                                            <button
                                                key={d}
                                                onClick={() => setDurationDays(d)}
                                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${durationDays === d
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                                    }`}
                                            >
                                                {d}d
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => setShowDurationEdit(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            className="flex-1"
                                            onClick={updateDuration}
                                            disabled={actionLoading === 'duration'}
                                        >
                                            {actionLoading === 'duration' ? 'Updating...' : 'Update'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setShowDurationEdit(true)}
                                >
                                    Edit Duration
                                </Button>
                            )}
                        </GlassCard>
                    )}

                    {/* End Campaign (available on active) */}
                    <GlassCard className="p-4 space-y-3">
                        <h3 className="font-semibold text-sm text-muted-foreground">End Campaign Early</h3>
                        <p className="text-xs text-muted-foreground">
                            Stop accepting new channels. Active deals will continue.
                            {slotsLeft > 0 && (
                                <span className="block mt-1">
                                    {refundPreview} {campaign.currency} will be refunded for {slotsLeft} unfilled slot{slotsLeft > 1 ? 's' : ''}.
                                </span>
                            )}
                        </p>

                        {showEndConfirm ? (
                            <div className="space-y-2 pt-2 border-t border-border/50">
                                <p className="text-sm font-medium text-amber-400">
                                    ⚠️ Are you sure? This cannot be undone.
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => setShowEndConfirm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="flex-1"
                                        onClick={endCampaign}
                                        disabled={actionLoading === 'end'}
                                    >
                                        {actionLoading === 'end' ? 'Ending...' : 'End Campaign'}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                className="w-full text-red-400 border-red-500/30 hover:bg-red-500/10"
                                onClick={() => setShowEndConfirm(true)}
                            >
                                End Campaign
                            </Button>
                        )}
                    </GlassCard>
                </>
            )}


            {/* Note: Applications for closed campaigns are managed in Partnerships → Pending */}

            {/* Approved Channels */}
            {approvedApps.length > 0 && (
                <GlassCard className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        Active Channels ({approvedApps.length})
                    </h3>
                    <div className="space-y-2">
                        {approvedApps.map(app => (
                            <div key={app.id} className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                                <div>
                                    <div className="font-medium">{app.channel?.title || 'Channel'}</div>
                                    {app.channel?.username && (
                                        <div className="text-xs text-muted-foreground">@{app.channel.username}</div>
                                    )}
                                </div>
                                <CheckCircle className="w-5 h-5 text-green-400" />
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            {/* Requirements */}
            {(campaign.minSubscribers || campaign.requiredLanguages?.length || campaign.requiredCategories?.length) && (
                <GlassCard className="p-4">
                    <h3 className="font-semibold mb-3">Requirements</h3>
                    <div className="space-y-2 text-sm">
                        {campaign.minSubscribers && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Min subscribers</span>
                                <span>{campaign.minSubscribers.toLocaleString()}</span>
                            </div>
                        )}
                        {campaign.maxSubscribers && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Max subscribers</span>
                                <span>{campaign.maxSubscribers.toLocaleString()}</span>
                            </div>
                        )}
                        {campaign.requiredLanguages && campaign.requiredLanguages.length > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Languages</span>
                                <span>{campaign.requiredLanguages.join(', ')}</span>
                            </div>
                        )}
                        {campaign.requiredCategories && campaign.requiredCategories.length > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Categories</span>
                                <span>{campaign.requiredCategories.join(', ')}</span>
                            </div>
                        )}
                    </div>
                </GlassCard>
            )}

            {/* Expired Campaign — Grace Period: Extend or End */}
            {isExpired && isInGrace && slotsLeft > 0 && (
                <GlassCard className="p-4 space-y-3 border-amber-500/30">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <h3 className="font-semibold">Campaign Expired</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        You have <span className="text-amber-400 font-medium">{hoursLeft}h</span> to extend or end this campaign.
                        {slotsLeft < campaign.slots && (
                            <span className="block mt-1 text-xs">
                                {campaign.slotsFilled} slot{campaign.slotsFilled > 1 ? 's' : ''} filled, {slotsLeft} remaining.
                            </span>
                        )}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            className="flex-1"
                            onClick={extendCampaign}
                            disabled={actionLoading === 'extend'}
                        >
                            {actionLoading === 'extend' ? 'Extending...' : 'Extend 7 Days'}
                        </Button>
                        {showEndConfirm ? (
                            <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={endCampaign}
                                disabled={actionLoading === 'end'}
                            >
                                {actionLoading === 'end' ? 'Ending...' : 'Confirm End'}
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                className="flex-1 text-red-400 border-red-500/30"
                                onClick={() => setShowEndConfirm(true)}
                            >
                                End Campaign
                            </Button>
                        )}
                    </div>
                    {showEndConfirm && (
                        <p className="text-xs text-amber-400">
                            ⚠️ This will end the campaign and refund {refundPreview} {campaign.currency} for {slotsLeft} unfilled slot{slotsLeft > 1 ? 's' : ''}.
                        </p>
                    )}
                </GlassCard>
            )}

            {/* Expired — Grace period over, no slots left, or past grace */}
            {isExpired && (!isInGrace || slotsLeft <= 0) && (
                <GlassCard className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                        <h3 className="font-semibold">Campaign Expired</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {slotsLeft <= 0
                            ? 'All slots are filled. The campaign will end automatically once all deals complete.'
                            : 'The 24-hour grace period has passed. This campaign will be auto-ended and remaining funds refunded.'}
                    </p>
                </GlassCard>
            )}

            {/* Campaign Ended */}
            {isEnded && (
                <GlassCard className="p-4 space-y-3 border-green-500/20">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <h3 className="font-semibold">Campaign Ended</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Slots used</span>
                            <span>{campaign.slotsFilled} / {campaign.slots}</span>
                        </div>
                        {(campaign.refundAmount !== undefined && campaign.refundAmount > 0) && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Refund</span>
                                <span className="text-green-400 font-medium">
                                    {campaign.refundAmount} {campaign.currency}
                                </span>
                            </div>
                        )}
                        {campaign.refundAmount === 0 && (
                            <p className="text-xs text-muted-foreground">
                                All slots were used — no refund needed.
                            </p>
                        )}
                    </div>
                </GlassCard>
            )}

            {/* Duplicate Campaign (for ended/expired campaigns) */}
            {(campaign.status === 'ended' || campaign.status === 'expired') && (
                <GlassCard className="p-4 space-y-3">
                    <h3 className="font-semibold">Run Again?</h3>
                    <p className="text-sm text-muted-foreground">
                        Create a new campaign with the same details. A fresh escrow deposit will be required.
                    </p>
                    <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => navigate('/campaigns/create', {
                            state: {
                                duplicateFrom: {
                                    title: campaign.title,
                                    brief: campaign.brief,
                                    perChannelBudget: campaign.perChannelBudget,
                                    currency: campaign.currency,
                                    slots: campaign.slots,
                                    campaignType: campaign.campaignType,
                                    minSubscribers: campaign.minSubscribers,
                                    maxSubscribers: campaign.maxSubscribers,
                                    requiredLanguages: campaign.requiredLanguages,
                                    requiredCategories: campaign.requiredCategories,
                                }
                            }
                        })}
                    >
                        Duplicate Campaign
                    </Button>
                </GlassCard>
            )}


        </div>
    )
}
