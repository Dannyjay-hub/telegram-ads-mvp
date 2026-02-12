import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'
import { useTelegram } from '@/providers/TelegramProvider'
import { API_URL, getHeaders, apiFetch } from '@/lib/api'

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
    const { user } = useTelegram()
    const [campaign, setCampaign] = useState<Campaign | null>(null)
    const [applications, setApplications] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

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

            {/* Extend Campaign (expired within 24h grace period) */}
            {campaign.status === 'expired' && campaign.expiresAt && (() => {
                const expiredAt = new Date(campaign.expiresAt).getTime()
                const graceEnd = expiredAt + 24 * 60 * 60 * 1000
                const isInGrace = Date.now() < graceEnd
                const slotsLeft = campaign.slots - campaign.slotsFilled
                const hoursLeft = Math.max(0, Math.round((graceEnd - Date.now()) / (1000 * 60 * 60)))

                if (!isInGrace || slotsLeft <= 0) return null

                return (
                    <GlassCard className="p-4 space-y-3 border-amber-500/30">
                        <h3 className="font-semibold">Extend Campaign</h3>
                        <p className="text-sm text-muted-foreground">
                            Your campaign expired but you have {hoursLeft}h left to extend it by 7 more days.
                            {slotsLeft < campaign.slots && (
                                <span className="text-amber-400 block mt-1">
                                    ⚠️ {slotsLeft} of {campaign.slots} slots remaining.
                                </span>
                            )}
                        </p>
                        <Button
                            className="w-full"
                            onClick={async () => {
                                setActionLoading('extend')
                                try {
                                    const res = await apiFetch(`${API_URL}/campaigns/${campaign.id}/extend`, {
                                        method: 'POST',
                                        headers: getHeaders()
                                    })
                                    if (res.ok) {
                                        // Refresh campaign data
                                        fetchCampaign()
                                    }
                                } catch (e) {
                                    console.error('Extension failed:', e)
                                } finally {
                                    setActionLoading(null)
                                }
                            }}
                            disabled={actionLoading === 'extend'}
                        >
                            {actionLoading === 'extend' ? 'Extending...' : 'Extend 7 Days'}
                        </Button>
                    </GlassCard>
                )
            })()}

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
