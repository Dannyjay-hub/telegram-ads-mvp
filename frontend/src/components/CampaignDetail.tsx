import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, CheckCircle, Loader2, Check, X } from 'lucide-react'
import { useTelegram } from '@/providers/TelegramProvider'
import { API_URL } from '@/lib/api'

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
    const { user } = useTelegram()
    const [campaign, setCampaign] = useState<Campaign | null>(null)
    const [applications, setApplications] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Toast notification for undo
    const [toast, setToast] = useState<{ message: string; undoAction?: () => void } | null>(null)

    useEffect(() => {
        if (id) fetchCampaign()
    }, [id])

    const fetchCampaign = async () => {
        try {
            const [campaignRes, appsRes] = await Promise.all([
                fetch(`${API_URL}/campaigns/${id}`, {
                    headers: { 'X-Telegram-Id': String(user?.telegramId || '') }
                }),
                fetch(`${API_URL}/campaigns/${id}/applications`, {
                    headers: { 'X-Telegram-Id': String(user?.telegramId || '') }
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

    const handleApprove = async (applicationId: string) => {
        const app = applications.find(a => a.id === applicationId)
        if (!app) return

        // Optimistic update - immediately show approved
        setApplications(prev => prev.map(a =>
            a.id === applicationId ? { ...a, status: 'approved' as const } : a
        ))

        // Show toast with undo
        const undoAction = () => {
            setApplications(prev => prev.map(a =>
                a.id === applicationId ? { ...a, status: 'pending' as const } : a
            ))
            setToast(null)
        }
        setToast({ message: `Approved ${app.channel?.title || 'channel'}. Funds allocated!`, undoAction })

        // Clear toast after 5 seconds
        setTimeout(() => setToast(null), 5000)

        // Actually make the API call
        try {
            const response = await fetch(`${API_URL}/campaigns/applications/${applicationId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Id': String(user?.telegramId || '')
                }
            })

            if (!response.ok) {
                // Revert on error
                undoAction()
                setToast({ message: 'Failed to approve. Please try again.' })
            }
        } catch (e) {
            console.error('Error approving:', e)
            undoAction()
        }
    }

    const handleReject = async (applicationId: string) => {
        const app = applications.find(a => a.id === applicationId)
        if (!app) return

        // Optimistic update - immediately hide
        setApplications(prev => prev.filter(a => a.id !== applicationId))

        // Show toast with undo
        const undoAction = () => {
            setApplications(prev => [...prev, app])
            setToast(null)
        }
        setToast({ message: `Rejected ${app.channel?.title || 'channel'}.`, undoAction })

        // Clear toast after 5 seconds
        setTimeout(() => setToast(null), 5000)

        // Actually make the API call
        try {
            const response = await fetch(`${API_URL}/campaigns/applications/${applicationId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Id': String(user?.telegramId || '')
                }
            })

            if (!response.ok) {
                // Revert on error
                undoAction()
                setToast({ message: 'Failed to reject. Please try again.' })
            }
        } catch (e) {
            console.error('Error rejecting:', e)
            undoAction()
        }
    }

    const publishCampaign = async () => {
        setActionLoading('publish')
        try {
            const response = await fetch(`${API_URL}/campaigns/${id}/publish`, {
                method: 'POST',
                headers: { 'X-Telegram-Id': String(user?.telegramId || '') }
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

    const pendingApps = applications.filter(a => a.status === 'pending')
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

            {/* Pending Applications (Closed campaigns) */}
            {campaign.campaignType === 'closed' && pendingApps.length > 0 && (
                <GlassCard className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400" />
                        Pending Applications ({pendingApps.length})
                    </h3>
                    <div className="space-y-2">
                        {pendingApps.map(app => (
                            <div key={app.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <div>
                                    <div className="font-medium">{app.channel?.title || 'Channel'}</div>
                                    {app.channel?.username && (
                                        <div className="text-xs text-muted-foreground">@{app.channel.username}</div>
                                    )}
                                    {app.channel?.verifiedStats?.subscribers && (
                                        <div className="text-xs text-muted-foreground">
                                            {app.channel.verifiedStats.subscribers.toLocaleString()} subscribers
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleReject(app.id)}
                                        disabled={actionLoading === app.id}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleApprove(app.id)}
                                        disabled={actionLoading === app.id}
                                    >
                                        <Check className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

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

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom fade-in duration-200">
                    <div className="bg-card border border-border shadow-lg rounded-lg p-4 flex items-center justify-between gap-3">
                        <span className="text-sm">{toast.message}</span>
                        {toast.undoAction && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0"
                                onClick={toast.undoAction}
                            >
                                Undo
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
