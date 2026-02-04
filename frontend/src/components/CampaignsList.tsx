import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Clock, CheckCircle, XCircle, Loader2, ChevronRight, Zap, ChevronLeft } from 'lucide-react'
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
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/5 rounded-lg">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold">Your Campaigns</h1>
                        <p className="text-sm text-muted-foreground">
                            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
                        </p>
                    </div>
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
                <GlassCard className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                    <h3 className="font-semibold mb-2">No campaigns yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Create your first campaign to reach channel owners
                    </p>
                    <Button onClick={() => navigate('/campaign/create')}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Campaign
                    </Button>
                </GlassCard>
            ) : (
                <div className="space-y-3">
                    {campaigns.map(campaign => {
                        const statusConfig = STATUS_CONFIG[campaign.status]
                        const timeLeft = getTimeLeft(campaign.expiresAt)

                        return (
                            <GlassCard
                                key={campaign.id}
                                className="cursor-pointer hover:bg-white/5 transition-all"
                                onClick={() => navigate(`/campaigns/${campaign.id}`)}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold truncate">{campaign.title}</h3>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                                {statusConfig.label}
                                            </span>
                                        </div>

                                        <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                                            {campaign.brief}
                                        </p>

                                        <div className="flex items-center gap-4 text-xs">
                                            <span className="font-mono font-bold text-primary">
                                                {campaign.totalBudget} {campaign.currency}
                                            </span>
                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                <Users className="w-3 h-3" />
                                                {campaign.slotsFilled}/{campaign.slots}
                                            </span>
                                            <span className={`capitalize px-1.5 py-0.5 rounded text-xs ${campaign.campaignType === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                                                }`}>
                                                {campaign.campaignType}
                                            </span>
                                            {timeLeft && campaign.status === 'active' && (
                                                <span className="flex items-center gap-1 text-amber-400">
                                                    <Clock className="w-3 h-3" />
                                                    {timeLeft}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                </div>
                            </GlassCard>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
