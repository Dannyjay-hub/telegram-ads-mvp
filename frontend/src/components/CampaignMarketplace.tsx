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
        username?: string
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
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold">Find Campaigns</h1>
                <p className="text-sm text-muted-foreground">
                    {campaigns.length} active campaign{campaigns.length !== 1 ? 's' : ''}
                </p>
            </div>

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
                                className="p-4 space-y-3 cursor-pointer hover:border-primary/50 transition-colors"
                                onClick={() => navigate(`/campaigns/marketplace/${campaign.id}`)}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold truncate">{campaign.title}</h3>
                                            {campaign.campaignType === 'open' && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 flex items-center gap-1">
                                                    <Zap className="w-3 h-3" />
                                                    Auto
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                            {campaign.brief}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <span className="font-mono font-bold text-primary text-base">
                                                {campaign.perChannelBudget} {campaign.currency}
                                            </span>
                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                <Users className="w-3 h-3" />
                                                {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left
                                            </span>
                                            {timeLeft && (
                                                <span className="flex items-center gap-1 text-amber-400">
                                                    <Clock className="w-3 h-3" />
                                                    {timeLeft}
                                                </span>
                                            )}
                                        </div>

                                        {campaign.minSubscribers && (
                                            <div className={`mt-2 text-xs ${meetsMinSubscribers ? 'text-muted-foreground' : 'text-red-400'}`}>
                                                Min {campaign.minSubscribers.toLocaleString()} subscribers
                                                {!meetsMinSubscribers && selectedChannelData && (
                                                    <span className="ml-1">(your channel has {channelSubscribers.toLocaleString()})</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-muted" onClick={(e) => e.stopPropagation()}>
                                    {campaign.hasApplied ? (
                                        <Button className="w-full" disabled variant="outline">
                                            Applied ✓
                                        </Button>
                                    ) : !isEligible ? (
                                        <Button className="w-full" disabled variant="outline">
                                            {ineligibilityReason === 'subscribers' ? 'Not enough subscribers' :
                                                ineligibilityReason === 'category' ? 'Category mismatch' :
                                                    ineligibilityReason === 'language' ? 'Language mismatch' :
                                                        'No slots available'}
                                        </Button>
                                    ) : (
                                        <Button
                                            className="w-full"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                applyToCampaign(campaign.id)
                                            }}
                                            disabled={applying === campaign.id || !selectedChannel}
                                        >
                                            {applying === campaign.id ? 'Applying...' : (
                                                campaign.campaignType === 'open' ? 'Apply & Join' : 'Apply'
                                            )}
                                        </Button>
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
