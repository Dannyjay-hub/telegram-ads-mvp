import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, Users, Clock, Zap, Loader2 } from 'lucide-react'
import { useTelegram } from '@/providers/TelegramProvider'
import { API_URL } from '@/lib/api'

interface MarketplaceCampaign {
    id: string
    title: string
    brief: string
    totalBudget: number
    perChannelBudget: number
    currency: string
    slots: number
    slotsFilled: number
    campaignType: 'open' | 'closed'
    minSubscribers?: number
    requiredCategories?: string[]
    requiredLanguages?: string[]
    expiresAt?: string
    advertiser?: {
        firstName?: string
    }
    hasApplied?: boolean
}

export function CampaignMarketplace() {
    const navigate = useNavigate()
    const { user } = useTelegram()
    const [campaigns, setCampaigns] = useState<MarketplaceCampaign[]>([])
    const [loading, setLoading] = useState(true)
    const [applying, setApplying] = useState<string | null>(null)
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
    const [userChannels, setUserChannels] = useState<any[]>([])

    useEffect(() => {
        fetchMarketplace()
        fetchUserChannels()
    }, [user?.telegramId])

    const fetchMarketplace = async () => {
        try {
            const response = await fetch(`${API_URL}/campaigns/marketplace`, {
                headers: { 'X-Telegram-Id': String(user?.telegramId || '') }
            })

            if (response.ok) {
                const data = await response.json()
                console.log('[CampaignMarketplace] Campaigns API:', data.campaigns?.map((c: any) => ({
                    id: c.id,
                    title: c.title,
                    requiredLanguages: c.requiredLanguages
                })))
                setCampaigns(data.campaigns || [])
            }
        } catch (e) {
            console.error('Error fetching marketplace:', e)
        } finally {
            setLoading(false)
        }
    }

    const fetchUserChannels = async () => {
        if (!user?.telegramId) return
        try {
            const response = await fetch(`${API_URL}/channels/my`, {
                headers: { 'X-Telegram-Id': String(user.telegramId) }
            })
            if (response.ok) {
                const data = await response.json()
                console.log('[CampaignMarketplace] Channels API raw:', data)
                // API returns array directly, not { channels: [...] }
                const channels = Array.isArray(data) ? data : (data.channels || [])
                console.log('[CampaignMarketplace] Parsed channels:', channels.map((ch: any) => ({
                    id: ch.id,
                    title: ch.title,
                    language: ch.language,
                    category: ch.category
                })))
                setUserChannels(channels)
                if (channels.length > 0) {
                    setSelectedChannel(channels[0].id)
                }
            }
        } catch (e) {
            console.error('Error fetching channels:', e)
        }
    }

    const applyToCampaign = async (campaignId: string) => {
        if (!selectedChannel) {
            alert('Please select a channel first')
            return
        }

        setApplying(campaignId)
        try {
            const response = await fetch(`${API_URL}/campaigns/${campaignId}/apply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Id': String(user?.telegramId || '')
                },
                body: JSON.stringify({ channelId: selectedChannel })
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    // Refresh to update hasApplied status
                    await fetchMarketplace()
                }
            } else {
                const err = await response.json()
                alert(err.error || 'Failed to apply')
            }
        } catch (e) {
            console.error('Error applying:', e)
        } finally {
            setApplying(null)
        }
    }

    const getTimeLeft = (expiresAt?: string) => {
        if (!expiresAt) return null
        const diff = new Date(expiresAt).getTime() - Date.now()
        if (diff <= 0) return 'Ending soon'
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        if (days > 0) return `${days}d left`
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        return `${hours}h left`
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-24">

            {/* Channel Selector */}
            {userChannels.length > 0 && (
                <GlassCard className="p-3">
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Apply as:</label>
                    <select
                        className="w-full bg-transparent border border-input rounded-md px-3 py-2 text-sm"
                        value={selectedChannel || ''}
                        onChange={e => setSelectedChannel(e.target.value)}
                    >
                        {userChannels.map(ch => (
                            <option key={ch.id} value={ch.id}>
                                {ch.title} {ch.username ? `(@${ch.username})` : ''}
                            </option>
                        ))}
                    </select>
                </GlassCard>
            )}

            {userChannels.length === 0 && (
                <GlassCard className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                        You need to add a channel to apply for campaigns
                    </p>
                    <Button onClick={() => navigate('/channels/add')} variant="outline" size="sm">
                        Add Channel
                    </Button>
                </GlassCard>
            )}

            {/* Campaign List */}
            {campaigns.length === 0 ? (
                <GlassCard className="text-center py-12">
                    <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                    <h3 className="font-semibold mb-2">No campaigns available</h3>
                    <p className="text-sm text-muted-foreground">
                        Check back later for new opportunities
                    </p>
                </GlassCard>
            ) : (
                <div className="space-y-3">
                    {campaigns.map(campaign => {
                        const slotsLeft = campaign.slots - campaign.slotsFilled
                        const timeLeft = getTimeLeft(campaign.expiresAt)

                        // Check if selected channel meets requirements
                        const selectedChannelData = userChannels.find(ch => ch.id === selectedChannel)
                        // Subscriber count can be in verifiedStats.subscribers or directly on channel
                        const channelSubscribers = selectedChannelData?.verifiedStats?.subscribers ||
                            selectedChannelData?.subscriberCount ||
                            selectedChannelData?.subscribers || 0
                        const channelCategory = selectedChannelData?.category || ''
                        const channelLanguage = selectedChannelData?.language || ''

                        // Normalize language for comparison (handles 'en' vs 'English' etc)
                        const normalizeLanguage = (lang: string): string => {
                            const lower = lang.toLowerCase().trim()
                            const map: Record<string, string> = {
                                'en': 'english', 'eng': 'english',
                                'ru': 'russian', 'rus': 'russian',
                                'es': 'spanish', 'spa': 'spanish',
                                'pt': 'portuguese', 'por': 'portuguese',
                                'zh': 'chinese', 'chi': 'chinese', 'cn': 'chinese',
                                'ar': 'arabic', 'ara': 'arabic',
                                'hi': 'hindi', 'hin': 'hindi',
                                'fr': 'french', 'fra': 'french',
                                'de': 'german', 'deu': 'german', 'ger': 'german',
                                'ja': 'japanese', 'jpn': 'japanese', 'jp': 'japanese',
                                'ko': 'korean', 'kor': 'korean', 'kr': 'korean',
                                'id': 'indonesian', 'ind': 'indonesian',
                                'tr': 'turkish', 'tur': 'turkish',
                                'it': 'italian', 'ita': 'italian'
                            }
                            return map[lower] || lower
                        }

                        // Eligibility checks
                        const meetsMinSubscribers = !campaign.minSubscribers || channelSubscribers >= campaign.minSubscribers
                        const meetsCategory = !campaign.requiredCategories?.length ||
                            campaign.requiredCategories.some(cat =>
                                cat.toLowerCase() === channelCategory.toLowerCase()
                            )
                        const meetsLanguage = !campaign.requiredLanguages?.length ||
                            campaign.requiredLanguages.some(lang =>
                                normalizeLanguage(lang) === normalizeLanguage(channelLanguage)
                            )

                        const isEligible = meetsMinSubscribers && meetsCategory && meetsLanguage && slotsLeft > 0
                        const ineligibilityReason = !meetsMinSubscribers ? 'subscribers' :
                            !meetsCategory ? 'category' :
                                !meetsLanguage ? 'language' :
                                    slotsLeft <= 0 ? 'slots' : null

                        // Debug logging for eligibility checks
                        if (!meetsLanguage && campaign.requiredLanguages?.length) {
                            console.log('[Eligibility Debug]', {
                                campaignTitle: campaign.title,
                                requiredLanguages: campaign.requiredLanguages,
                                channelLanguage,
                                comparison: campaign.requiredLanguages.map(lang => ({
                                    required: lang.toLowerCase(),
                                    channel: channelLanguage.toLowerCase(),
                                    matches: lang.toLowerCase() === channelLanguage.toLowerCase()
                                }))
                            })
                        }

                        return (
                            <GlassCard
                                key={campaign.id}
                                className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                                onClick={() => navigate(`/campaigns/marketplace/${campaign.id}${selectedChannel ? `?channel=${selectedChannel}` : ''}`)}
                            >
                                {/* Header: Avatar + Title */}
                                <div className="flex items-start gap-3 mb-3">
                                    {/* Avatar with gradient initial */}
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-white font-bold text-lg shrink-0">
                                        {campaign.advertiser?.firstName?.charAt(0)?.toUpperCase() || 'A'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold truncate">{campaign.title}</h3>
                                            {campaign.campaignType === 'open' && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400 flex items-center gap-0.5">
                                                    <Zap className="w-2.5 h-2.5" />
                                                    Auto
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            by {campaign.advertiser?.firstName || 'Advertiser'}
                                        </p>
                                    </div>
                                </div>

                                {/* Stats row */}
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                                    {campaign.minSubscribers && campaign.minSubscribers > 0 && (
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {campaign.minSubscribers >= 1000
                                                ? `${(campaign.minSubscribers / 1000).toFixed(campaign.minSubscribers >= 10000 ? 0 : 1)}K`
                                                : campaign.minSubscribers} min
                                        </span>
                                    )}
                                    {timeLeft && (
                                        <span className="flex items-center gap-1 text-amber-400">
                                            <Clock className="w-3 h-3" />
                                            {timeLeft}
                                        </span>
                                    )}
                                </div>

                                {/* Footer: Slots + Budget */}
                                <div className="flex items-center justify-between py-2 px-3 bg-card/50 rounded-lg border border-border/50">
                                    <span className="text-sm text-muted-foreground">
                                        {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left
                                    </span>
                                    <span className="font-mono font-bold text-primary">
                                        {campaign.perChannelBudget} {campaign.currency}+
                                    </span>
                                </div>
                            </GlassCard>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
