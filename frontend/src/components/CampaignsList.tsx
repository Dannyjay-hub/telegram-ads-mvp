import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Clock, CheckCircle, XCircle, Loader2, ChevronRight, Zap } from 'lucide-react'
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
    campaignType: 'open' | 'closed'
    status: 'draft' | 'active' | 'filled' | 'expired' | 'ended'
    expiresAt?: string
    createdAt: string
}

const STATUS_CONFIG = {
    draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: Clock },
    active: { label: 'Active', color: 'bg-green-500/20 text-green-400', icon: Zap },
    filled: { label: 'Full', color: 'bg-blue-500/20 text-blue-400', icon: CheckCircle },
    expired: { label: 'Expired', color: 'bg-amber-500/20 text-amber-400', icon: XCircle },
    ended: { label: 'Ended', color: 'bg-muted text-muted-foreground', icon: CheckCircle }
}

export function CampaignsList() {
    const navigate = useNavigate()
    const { user, isLoading: isAuthLoading } = useTelegram()
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isAuthLoading) {
            if (user?.telegramId) {
                fetchCampaigns()
            } else {
                setLoading(false)
            }
        }
    }, [user?.telegramId, isAuthLoading])

    const fetchCampaigns = async () => {
        if (!user?.telegramId) return

        try {
            const response = await fetch(`${API_URL}/campaigns`, {
                headers: {
                    'X-Telegram-Id': String(user.telegramId)
                }
            })

            if (!response.ok) throw new Error('Failed to fetch campaigns')

            const data = await response.json()
            setCampaigns(data.campaigns || [])
        } catch (e: any) {
            console.error('Error fetching campaigns:', e)
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const getTimeLeft = (expiresAt?: string) => {
        if (!expiresAt) return null
        const diff = new Date(expiresAt).getTime() - Date.now()
        if (diff <= 0) return 'Expired'
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        if (days > 0) return `${days}d ${hours}h left`
        return `${hours}h left`
    }

    if (loading || isAuthLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold">Your Campaigns</h1>
                    <p className="text-sm text-muted-foreground">
                        {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <Button onClick={() => navigate('/campaign/create')} size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    New
                </Button>
            </div>

            {error && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                </div>
            )}

            {campaigns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-xl">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                    <h3 className="font-bold text-lg mb-2">No campaigns yet</h3>
                    <p className="mb-4 text-sm max-w-xs mx-auto">
                        Create your first campaign to start promoting your product to channel owners.
                    </p>
                    <Button onClick={() => navigate('/campaign/create')}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Campaign
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {campaigns.map(campaign => {
                        const statusConfig = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft
                        const timeLeft = getTimeLeft(campaign.expiresAt)

                        return (
                            <GlassCard
                                key={campaign.id}
                                className="cursor-pointer hover:bg-white/5 transition-all p-4"
                                onClick={() => navigate(`/campaigns/${campaign.id}`)}
                            >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-lg truncate">{campaign.title || 'Untitled Campaign'}</h3>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusConfig.color} flex items-center gap-1`}>
                                                <statusConfig.icon className="w-3 h-3" />
                                                {statusConfig.label}
                                            </span>
                                        </div>

                                        <p className="text-sm text-muted-foreground line-clamp-1">
                                            {campaign.brief}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                    <div className="bg-white/5 rounded p-2 flex flex-col">
                                        <span className="text-muted-foreground mb-0.5">Budget</span>
                                        <span className="font-mono font-bold text-primary">
                                            {campaign.totalBudget} {campaign.currency}
                                        </span>
                                    </div>
                                    <div className="bg-white/5 rounded p-2 flex flex-col">
                                        <span className="text-muted-foreground mb-0.5">Slots</span>
                                        <span className="font-medium">
                                            {campaign.slotsFilled} / {campaign.slots}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                                    <span className={`capitalize px-2 py-0.5 rounded-full ${campaign.campaignType === 'open' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                                        }`}>
                                        {campaign.campaignType} Campaign
                                    </span>
                                    {timeLeft && campaign.status === 'active' && (
                                        <span className="flex items-center gap-1 text-amber-400">
                                            <Clock className="w-3 h-3" />
                                            {timeLeft}
                                        </span>
                                    )}
                                </div>
                            </GlassCard>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
