import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, Users, Clock, Zap, SlidersHorizontal, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { useTelegram } from '@/providers/TelegramProvider'
import { API_URL, getHeaders, apiFetch } from '@/api'
import { SearchInput } from '@/components/ui/search-input'
import { useCampaignFilters, CAMPAIGN_BUDGET_PRESETS, CAMPAIGN_SORT_OPTIONS } from '@/hooks/useCampaignFilters'
import { cn } from '@/lib/utils'
import { haptic } from '@/utils/haptic'

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
    firstName?: string
    hasApplied?: boolean
    created_at?: string
}

export function CampaignMarketplace() {
    const navigate = useNavigate()
    const { user } = useTelegram()
    const [campaigns, setCampaigns] = useState<MarketplaceCampaign[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
    const [userChannels, setUserChannels] = useState<any[]>([])

    // Filtering
    const {
        filters,
        filteredCampaigns,
        resultCount,
        activeFilterCount,
        updateSearch,
        setBudgetRange,
        setSortBy,
        clearFilters,
    } = useCampaignFilters(campaigns)

    // Sort dropdown state
    const [sortOpen, setSortOpen] = useState(false)
    const sortRef = useRef<HTMLDivElement>(null)

    // Budget filter dropdown state
    const [budgetOpen, setBudgetOpen] = useState(false)
    const budgetRef = useRef<HTMLDivElement>(null)

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e: PointerEvent) => {
            if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
            if (budgetRef.current && !budgetRef.current.contains(e.target as Node)) setBudgetOpen(false)
        }
        document.addEventListener('pointerdown', handler, true)
        return () => document.removeEventListener('pointerdown', handler, true)
    }, [])

    useEffect(() => {
        fetchMarketplace()
        fetchUserChannels()
    }, [user?.telegramId])

    const fetchMarketplace = async () => {
        try {
            const response = await apiFetch(`${API_URL}/campaigns/marketplace`, {
                headers: getHeaders()
            })

            if (response.ok) {
                const data = await response.json()
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
            const response = await apiFetch(`${API_URL}/channels/my`, {
                headers: getHeaders()
            })
            if (response.ok) {
                const data = await response.json()
                const channels = Array.isArray(data) ? data : (data.channels || [])
                setUserChannels(channels)
                if (channels.length > 0) {
                    setSelectedChannel(channels[0].id)
                }
            }
        } catch (e) {
            console.error('Error fetching channels:', e)
        }
    }

    const getTimeLeft = (expiresAt?: string) => {
        if (!expiresAt) return null
        const diff = new Date(expiresAt).getTime() - Date.now()
        if (diff <= 0) return 'Expired'
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        if (days > 0) return `${days}d left`
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        return `${hours}h left`
    }

    return (
        <div className="flex flex-col h-full">
            {/* Sticky Header: Search + Filter/Sort */}
            <div className="flex-shrink-0 pb-2 bg-[--tg-theme-bg-color]">
                {/* Search */}
                <div className="mb-3">
                    <SearchInput
                        value={filters.search}
                        onChange={updateSearch}
                        placeholder="Search campaigns..."
                    />
                </div>

                {/* Channel Selector (Channel Owners) */}
                {userChannels.length > 0 && (
                    <div className="mb-3">
                        <select
                            className="w-full bg-[var(--fill-secondary)] border-0 rounded-[10px] px-3 py-2.5 text-sm text-foreground appearance-none"
                            value={selectedChannel || ''}
                            onChange={e => setSelectedChannel(e.target.value)}
                        >
                            {userChannels.map(ch => (
                                <option key={ch.id} value={ch.id}>
                                    {ch.title}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Filter + Sort Row */}
                <div className="flex items-center justify-between gap-3 mb-2">
                    {/* Budget Filter */}
                    <div ref={budgetRef} className="relative">
                        <button
                            type="button"
                            onClick={() => { haptic.soft(); setBudgetOpen(!budgetOpen); }}
                            className={cn(
                                "flex items-center gap-1.5 px-3 h-[32px] rounded-[10px]",
                                "text-[13px] font-medium",
                                "bg-[var(--fill-secondary)]",
                                "transition-all duration-200 active:scale-[0.96]",
                                (filters.budgetRange || activeFilterCount > 0) && "text-primary"
                            )}
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            Budget
                            {activeFilterCount > 0 && (
                                <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        <div className={cn(
                            "absolute top-[calc(100%+8px)] left-0 z-20",
                            "min-w-[160px] rounded-[10px]",
                            "bg-card/95 backdrop-blur-xl border border-border shadow-lg",
                            "transition-all duration-200 origin-top-left",
                            budgetOpen ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                        )}>
                            <ul className="py-1">
                                {CAMPAIGN_BUDGET_PRESETS.map(({ label, value }) => {
                                    const isSelected = JSON.stringify(filters.budgetRange) === JSON.stringify(value);
                                    return (
                                        <li
                                            key={label}
                                            onClick={() => { haptic.soft(); setBudgetRange(value); setBudgetOpen(false); }}
                                            className={cn(
                                                "flex items-center gap-2 px-4 py-2.5 cursor-pointer text-[15px]",
                                                "transition-colors hover:bg-primary/5",
                                                isSelected && "text-primary"
                                            )}
                                        >
                                            <Check className={cn("w-4 h-4", isSelected ? "opacity-100" : "opacity-0")} />
                                            <span>{label}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>

                    {/* Result Count */}
                    <p className="text-[13px] text-[--tg-theme-hint-color] flex-1 text-center">
                        {loading ? 'Loading...' : `${resultCount} campaign${resultCount !== 1 ? 's' : ''}`}
                    </p>

                    {/* Sort Dropdown */}
                    <div ref={sortRef} className="relative">
                        <button
                            type="button"
                            onClick={() => { haptic.soft(); setSortOpen(!sortOpen); }}
                            className={cn(
                                "flex items-center gap-1.5 px-3 h-[32px] rounded-[10px]",
                                "text-[13px] font-medium",
                                "bg-[var(--fill-secondary)]",
                                "transition-all duration-200 active:scale-[0.96]"
                            )}
                        >
                            <span className="text-muted-foreground">Sort</span>
                            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", sortOpen && "rotate-180")} />
                        </button>

                        <div className={cn(
                            "absolute top-[calc(100%+8px)] right-0 z-20",
                            "min-w-[180px] rounded-[10px]",
                            "bg-card/95 backdrop-blur-xl border border-border shadow-lg",
                            "transition-all duration-200 origin-top-right",
                            sortOpen ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                        )}>
                            <ul className="py-1">
                                {CAMPAIGN_SORT_OPTIONS.map(({ label, value }) => {
                                    const isSelected = value === filters.sortBy;
                                    return (
                                        <li
                                            key={value}
                                            onClick={() => { haptic.soft(); setSortBy(value); setSortOpen(false); }}
                                            className={cn(
                                                "flex items-center gap-2 px-4 py-2.5 cursor-pointer text-[15px]",
                                                "transition-colors hover:bg-primary/5",
                                                isSelected && "text-primary"
                                            )}
                                        >
                                            <Check className={cn("w-4 h-4", isSelected ? "opacity-100" : "opacity-0")} />
                                            <span>{label}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide pb-4">
                <div className="space-y-3">
                    {/* Empty State for No Channels */}
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

                    {loading ? (
                        // Loading Skeletons — grouped list style
                        <div className="rounded-[10px] overflow-hidden">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="bg-card px-4 py-[10px] animate-pulse"
                                    style={i > 0 ? { borderTop: '0.5px solid var(--tg-theme-section-separator-color, rgba(84,84,88,0.34))' } : undefined}
                                >
                                    <div className="flex items-center gap-[10px]">
                                        <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="h-4 bg-muted rounded w-32 mb-1.5" />
                                            <div className="h-3 bg-muted rounded w-48" />
                                        </div>
                                        <div className="h-4 bg-muted rounded w-16" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredCampaigns.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            {campaigns.length === 0 ? (
                                <>
                                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p className="font-semibold mb-2">No campaigns available</p>
                                    <p className="text-sm">Check back later for new opportunities</p>
                                </>
                            ) : (
                                <>
                                    <p className="mb-2">No campaigns match your filters</p>
                                    <button onClick={clearFilters} className="text-[13px] text-primary font-medium">
                                        Clear Filters
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        /* Grouped List — Access mini app style */
                        <div className="rounded-[10px] overflow-hidden">
                            {filteredCampaigns.map((campaign, index) => {
                                const slotsLeft = campaign.slots - campaign.slotsFilled
                                const timeLeft = getTimeLeft(campaign.expiresAt)

                                return (
                                    <div
                                        key={campaign.id}
                                        className="bg-card px-4 py-[10px] cursor-pointer active:bg-accent transition-colors"
                                        style={index > 0 ? { borderTop: '0.5px solid var(--tg-theme-section-separator-color, rgba(84,84,88,0.34))' } : undefined}
                                        onClick={() => navigate(`/campaigns/marketplace/${campaign.id}${selectedChannel ? `?channel=${selectedChannel}` : ''}`)}
                                    >
                                        <div className="flex items-center gap-[10px]">
                                            {/* Avatar */}
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                                                {campaign.advertiser?.firstName?.charAt(0)?.toUpperCase() || 'A'}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                {/* Row 1: Title + Auto badge */}
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-medium text-[15px] truncate">
                                                        {campaign.title}
                                                    </span>
                                                    {campaign.campaignType === 'open' && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400 flex items-center gap-0.5 flex-shrink-0">
                                                            <Zap className="w-2.5 h-2.5" />
                                                            Auto
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Row 2: Slots + Time */}
                                                <div className="flex items-center gap-1 text-[13px] text-muted-foreground mt-0.5">
                                                    <span>{slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left</span>
                                                    {timeLeft && (
                                                        <>
                                                            <span className="text-muted-foreground/40">·</span>
                                                            <span className="text-amber-400 flex items-center gap-0.5">
                                                                <Clock className="w-3 h-3" />
                                                                {timeLeft}
                                                            </span>
                                                        </>
                                                    )}
                                                    {campaign.minSubscribers && campaign.minSubscribers > 0 && (
                                                        <>
                                                            <span className="text-muted-foreground/40">·</span>
                                                            <span className="flex items-center gap-0.5">
                                                                <Users className="w-3 h-3" />
                                                                {campaign.minSubscribers >= 1000
                                                                    ? `${(campaign.minSubscribers / 1000).toFixed(0)}K`
                                                                    : campaign.minSubscribers}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Budget + Chevron */}
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <span className="text-[13px] font-semibold text-primary">
                                                    {campaign.perChannelBudget} {campaign.currency}+
                                                </span>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
