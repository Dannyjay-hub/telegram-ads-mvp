import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Clock, Zap, Loader2, Tag, Globe, CheckCircle } from 'lucide-react'
import { API_URL, getHeaders, apiFetch } from '@/api'

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
    maxSubscribers?: number
    requiredCategories?: string[]
    requiredLanguages?: string[]
    expiresAt?: string
    createdAt?: string
    advertiser?: {
        username?: string
    }
    hasApplied?: boolean
}

interface UserChannel {
    id: string
    title: string
    username?: string
    category?: string
    language?: string
    subscriberCount?: number
    subscribers?: number
    verifiedStats?: {
        subscribers?: number
    }
}

export function MarketplaceCampaignDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [campaign, setCampaign] = useState<MarketplaceCampaign | null>(null)
    const [userChannels, setUserChannels] = useState<UserChannel[]>([])
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [applying, setApplying] = useState(false)

    useEffect(() => {
        if (id) {
            fetchData()
        }
    }, [id])

    const fetchData = async () => {
        try {
            const [campaignRes, channelsRes] = await Promise.all([
                fetch(`${API_URL}/campaigns/${id}`, {
                    headers: getHeaders()
                }),
                fetch(`${API_URL}/channels/my`, {
                    headers: getHeaders()
                })
            ])

            if (campaignRes.ok) {
                const data = await campaignRes.json()
                console.log('[MarketplaceCampaignDetail] API response:', data)
                // API returns { campaign: {...} } wrapper
                setCampaign(data.campaign || data)
            }

            if (channelsRes.ok) {
                const channels = await channelsRes.json()
                setUserChannels(channels)
                if (channels.length > 0) {
                    // Check if channel was passed in URL, otherwise use first channel
                    const urlParams = new URLSearchParams(window.location.search)
                    const preselectedChannel = urlParams.get('channel')
                    if (preselectedChannel && channels.some((ch: UserChannel) => ch.id === preselectedChannel)) {
                        setSelectedChannel(preselectedChannel)
                    } else {
                        setSelectedChannel(channels[0].id)
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch data:', error)
        } finally {
            setLoading(false)
        }
    }

    const getTimeLeft = (expiresAt?: string) => {
        if (!expiresAt) return null
        const now = new Date()
        const expires = new Date(expiresAt)
        const diffHours = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60))
        if (diffHours < 0) return 'Expired'
        if (diffHours < 24) return `${diffHours}h left`
        return `${Math.floor(diffHours / 24)}d left`
    }

    const applyToCampaign = async () => {
        if (!selectedChannel || !campaign) return
        setApplying(true)
        try {
            const response = await apiFetch(`${API_URL}/campaigns/${campaign.id}/apply`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ channelId: selectedChannel })
            })

            if (response.ok) {
                setCampaign(prev => prev ? { ...prev, hasApplied: true } : null)
            } else {
                const error = await response.json()
                alert(error.error || 'Failed to apply')
            }
        } catch (error) {
            console.error('Failed to apply:', error)
        } finally {
            setApplying(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!campaign) {
        return (
            <div className="p-4 text-center text-muted-foreground">
                Campaign not found
            </div>
        )
    }

    // Calculate eligibility
    const selectedChannelData = userChannels.find(ch => ch.id === selectedChannel)
    const channelSubscribers = selectedChannelData?.verifiedStats?.subscribers ||
        selectedChannelData?.subscriberCount ||
        selectedChannelData?.subscribers || 0
    // Keep channel categories and languages as arrays for proper matching
    const channelCategories: string[] = Array.isArray(selectedChannelData?.category)
        ? selectedChannelData.category
        : (selectedChannelData?.category ? [selectedChannelData.category] : [])
    const channelLanguages: string[] = Array.isArray(selectedChannelData?.language)
        ? selectedChannelData.language
        : (selectedChannelData?.language ? [selectedChannelData.language] : [])

    // Display strings (for UI only)
    const channelCategoryDisplay = channelCategories.join(', ')
    const channelLanguageDisplay = channelLanguages.join(', ')

    // Normalize language for comparison (handles 'en' vs 'English' etc)
    const normalizeLanguage = (lang: unknown): string => {
        const lower = String(lang || '').toLowerCase().trim()
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

    const meetsMinSubscribers = !campaign.minSubscribers || channelSubscribers >= campaign.minSubscribers
    const meetsMaxSubscribers = !campaign.maxSubscribers || channelSubscribers <= campaign.maxSubscribers
    // Category: at least one campaign category matches one channel category
    const meetsCategory = !campaign.requiredCategories?.length ||
        campaign.requiredCategories.some(reqCat =>
            channelCategories.some(chCat =>
                String(reqCat || '').toLowerCase() === String(chCat || '').toLowerCase()
            )
        )
    // Language: at least one campaign language matches one channel language
    const meetsLanguage = !campaign.requiredLanguages?.length ||
        campaign.requiredLanguages.some(reqLang =>
            channelLanguages.some(chLang =>
                normalizeLanguage(reqLang) === normalizeLanguage(chLang)
            )
        )

    const slotsLeft = campaign.slots - campaign.slotsFilled
    const isEligible = meetsMinSubscribers && meetsMaxSubscribers && meetsCategory && meetsLanguage && slotsLeft > 0

    const timeLeft = getTimeLeft(campaign.expiresAt)



    return (
        <div className="p-4 pb-24 space-y-4">
            {/* Header */}
            <div className="mb-2">
                <h1 className="text-xl font-bold">{campaign.title}</h1>
                {campaign.advertiser?.username && (
                    <p className="text-sm text-muted-foreground">by @{campaign.advertiser.username}</p>
                )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
                <GlassCard className="text-center p-4">
                    <div className="text-2xl font-bold text-primary">{campaign.perChannelBudget}</div>
                    <div className="text-xs text-muted-foreground">{campaign.currency}/channel</div>
                </GlassCard>
                <GlassCard className="text-center p-4">
                    <div className="text-2xl font-bold">{slotsLeft}/{campaign.slots}</div>
                    <div className="text-xs text-muted-foreground">Slots left</div>
                </GlassCard>
                <GlassCard className="text-center p-4">
                    <div className="text-2xl font-bold flex items-center justify-center gap-1">
                        {campaign.campaignType === 'open' ? (
                            <><Zap className="w-5 h-5 text-green-400" /> Auto</>
                        ) : (
                            'Review'
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {campaign.campaignType === 'open' ? 'Auto-approve' : 'Manual review'}
                    </div>
                </GlassCard>
            </div>

            {/* Time Left */}
            {timeLeft && (
                <GlassCard className="p-4 flex items-center gap-2 justify-center">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400 font-medium">{timeLeft}</span>
                </GlassCard>
            )}

            {/* Brief */}
            <GlassCard className="p-4">
                <h3 className="font-semibold mb-2">Campaign Brief</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{campaign.brief}</p>
            </GlassCard>

            {/* Requirements */}
            {(campaign.minSubscribers || campaign.maxSubscribers || campaign.requiredLanguages?.length || campaign.requiredCategories?.length) && (
                <GlassCard className="p-4">
                    <h3 className="font-semibold mb-3">Requirements</h3>
                    <div className="space-y-2">
                        {campaign.minSubscribers && (
                            <div className={`flex items-center gap-2 text-sm ${meetsMinSubscribers ? 'text-green-400' : 'text-red-400'}`}>
                                <Users className="w-4 h-4" />
                                <span>Min {campaign.minSubscribers.toLocaleString()} subscribers</span>
                                {selectedChannelData && (
                                    <span className="text-muted-foreground">(yours: {channelSubscribers.toLocaleString()})</span>
                                )}
                                {meetsMinSubscribers && <CheckCircle className="w-4 h-4 ml-auto" />}
                            </div>
                        )}
                        {campaign.maxSubscribers && (
                            <div className={`flex items-center gap-2 text-sm ${meetsMaxSubscribers ? 'text-green-400' : 'text-red-400'}`}>
                                <Users className="w-4 h-4" />
                                <span>Max {campaign.maxSubscribers.toLocaleString()} subscribers</span>
                                {meetsMaxSubscribers && <CheckCircle className="w-4 h-4 ml-auto" />}
                            </div>
                        )}
                        {campaign.requiredCategories && campaign.requiredCategories.length > 0 && (
                            <div className={`flex items-center gap-2 text-sm ${meetsCategory ? 'text-green-400' : 'text-red-400'}`}>
                                <Tag className="w-4 h-4" />
                                <span>Category: {campaign.requiredCategories.join(', ')}</span>
                                {selectedChannelData && channelCategoryDisplay && (
                                    <span className="text-muted-foreground">(yours: {channelCategoryDisplay})</span>
                                )}
                                {meetsCategory && <CheckCircle className="w-4 h-4 ml-auto" />}
                            </div>
                        )}
                        {campaign.requiredLanguages && campaign.requiredLanguages.length > 0 && (
                            <div className={`flex items-center gap-2 text-sm ${meetsLanguage ? 'text-green-400' : 'text-red-400'}`}>
                                <Globe className="w-4 h-4" />
                                <span>Language: {campaign.requiredLanguages.join(' or ')}</span>
                                {selectedChannelData && channelLanguageDisplay && (
                                    <span className="text-muted-foreground">(yours: {channelLanguageDisplay})</span>
                                )}
                                {meetsLanguage && <CheckCircle className="w-4 h-4 ml-auto" />}
                            </div>
                        )}
                    </div>
                </GlassCard>
            )}

            {/* Channel Selector */}
            {userChannels.length > 0 && (
                <GlassCard className="p-4">
                    <h3 className="font-semibold mb-3">Select Your Channel</h3>
                    <select
                        className="w-full p-3 rounded-lg bg-secondary border border-border text-foreground"
                        value={selectedChannel || ''}
                        onChange={(e) => setSelectedChannel(e.target.value)}
                    >
                        {userChannels.map(channel => (
                            <option key={channel.id} value={channel.id}>
                                {channel.title} ({(channel.verifiedStats?.subscribers || channel.subscriberCount || channel.subscribers || 0).toLocaleString()} subs)
                            </option>
                        ))}
                    </select>
                    {selectedChannelData && (
                        <div className="mt-2 text-xs text-muted-foreground">
                            Category: {channelCategoryDisplay || 'Not set'} • Language: {channelLanguageDisplay || 'Not set'}
                        </div>
                    )}
                </GlassCard>
            )}

            {/* Apply Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
                {campaign.hasApplied ? (
                    <Button className="w-full h-12" disabled variant="outline">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Already Applied
                    </Button>
                ) : !isEligible ? (
                    <Button className="w-full h-12" disabled variant="outline">
                        {!meetsMinSubscribers ? 'Not enough subscribers' :
                            !meetsMaxSubscribers ? 'Too many subscribers' :
                                !meetsCategory ? 'Category mismatch' :
                                    !meetsLanguage ? 'Language mismatch' :
                                        'No slots available'}
                    </Button>
                ) : userChannels.length === 0 ? (
                    <Button className="w-full h-12" onClick={() => navigate('/channels/add')}>
                        List a Channel First
                    </Button>
                ) : (
                    <Button
                        className="w-full h-12"
                        onClick={applyToCampaign}
                        disabled={applying || !selectedChannel}
                    >
                        {applying ? (
                            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Applying...</>
                        ) : campaign.campaignType === 'open' ? (
                            'Apply & Join'
                        ) : (
                            'Apply for Review'
                        )}
                    </Button>
                )}
            </div>
        </div>
    )
}
