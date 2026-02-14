import { useEffect, useState } from 'react'
import { getMarketplaceChannels, type Channel } from '@/api'
import { ChevronRight, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { parseTagArray } from '@/lib/parseTagArray'

// Filter components
import { SearchInput } from '@/components/ui/search-input'
import { FilterDropdown, ActiveFilterChips } from '@/components/marketplace/FilterDropdown'
import { SortDropdown } from '@/components/marketplace/SortDropdown'
import { useMarketplaceFilters } from '@/hooks/useMarketplaceFilters'

export function MarketplacePage() {
    const navigate = useNavigate()
    const [channels, setChannels] = useState<Channel[]>([])
    const [loading, setLoading] = useState(true)

    // Use the filter hook
    const {
        filters,
        filteredChannels,
        resultCount,
        updateSearch,
        toggleCategory,
        toggleLanguage,
        setSubscribers,
        setPrice,
        setSortBy,
        clearFilters,
        clearAdvancedFilters,
    } = useMarketplaceFilters(channels)

    useEffect(() => {
        loadMarketplace()
    }, [])

    const loadMarketplace = async () => {
        try {
            setLoading(true)
            const data = await getMarketplaceChannels()
            setChannels(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    // Format subscriber count
    const formatSubs = (count: number) => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
        if (count >= 1000) return `${(count / 1000).toFixed(0)}K`
        return count.toString()
    }

    // Get min price from rate card — reads actual lowest package price
    const getMinPrice = (channel: Channel) => {
        if (!channel.rateCard?.length) return null
        const prices = channel.rateCard
            .map((p: any) => Number(p.price))
            .filter((p: number) => p > 0 && isFinite(p))
        if (!prices.length) return null
        return Math.min(...prices)
    }

    // Get currency from rate card
    const getCurrency = (channel: Channel) => {
        if (!channel.rateCard?.length) return 'TON'
        return channel.rateCard[0]?.currency || 'TON'
    }

    // Format categories — show 1 + count of extra
    const formatCategories = (channel: Channel) => {
        const categories = parseTagArray(channel.category)
        const languages = parseTagArray(channel.language)
        const all = [...categories, ...languages]
        if (!all.length) return null

        const first = all[0]
        const extra = all.length - 1
        return { first, extra }
    }

    return (
        <div className="flex flex-col h-full">
            {/* Sticky Header: Search + Filter/Sort Row */}
            <div className="flex-shrink-0 pb-2 bg-[--tg-theme-bg-color]">
                {/* Search Bar */}
                <div className="mb-3">
                    <SearchInput
                        value={filters.search}
                        onChange={updateSearch}
                        placeholder="Search channels..."
                    />
                </div>

                {/* Filter + Sort Row */}
                <div className="flex items-center justify-between gap-3 mb-2">
                    {/* Filter Dropdown - Left */}
                    <FilterDropdown
                        categories={filters.categories}
                        languages={filters.languages}
                        subscribers={filters.subscribers}
                        price={filters.price}
                        onToggleCategory={toggleCategory}
                        onToggleLanguage={toggleLanguage}
                        onSetSubscribers={setSubscribers}
                        onSetPrice={setPrice}
                        onClearAll={clearAdvancedFilters}
                    />

                    {/* Result Count (centered) */}
                    <p className="text-[13px] text-[--tg-theme-hint-color] flex-1 text-center">
                        {loading ? 'Loading...' : `${resultCount} channel${resultCount !== 1 ? 's' : ''}`}
                    </p>

                    {/* Sort Dropdown - Right */}
                    <SortDropdown
                        value={filters.sortBy}
                        onChange={setSortBy}
                    />
                </div>

                {/* Active Filter Chips */}
                <ActiveFilterChips
                    categories={filters.categories}
                    languages={filters.languages}
                    subscribers={filters.subscribers}
                    price={filters.price}
                    onRemoveCategory={toggleCategory}
                    onRemoveLanguage={toggleLanguage}
                    onClearSubscribers={() => setSubscribers(null)}
                    onClearPrice={() => setPrice(null)}
                />
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto scrollbar-hide pb-4">
                {loading ? (
                    // Loading Skeletons — Access-style grouped list
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
                ) : filteredChannels.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <p className="mb-2">No channels match your filters</p>
                        <button
                            onClick={clearFilters}
                            className="text-[13px] text-primary font-medium"
                        >
                            Clear Filters
                        </button>
                    </div>
                ) : (
                    /* Grouped List — Access mini app style */
                    <div className="rounded-[10px] overflow-hidden">
                        {filteredChannels.map((channel, index) => {
                            const minPrice = getMinPrice(channel)
                            const currency = getCurrency(channel)
                            const catInfo = formatCategories(channel)

                            return (
                                <div
                                    key={channel.id}
                                    className="bg-card px-4 py-[10px] cursor-pointer active:bg-accent transition-colors"
                                    style={index > 0 ? { borderTop: '0.5px solid var(--tg-theme-section-separator-color, rgba(84,84,88,0.34))' } : undefined}
                                    onClick={() => navigate(`/marketplace/channel/${channel.id}`, { state: { from: '/marketplace?tab=channels' } })}
                                >
                                    <div className="flex items-center gap-[10px]">
                                        {/* Avatar */}
                                        {channel.photoUrl ? (
                                            <img
                                                src={channel.photoUrl}
                                                alt={channel.title}
                                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-sm flex-shrink-0 text-white">
                                                {channel.title.charAt(0)}
                                            </div>
                                        )}

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            {/* Row 1: Name */}
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-medium text-[15px] truncate">
                                                    {channel.title}
                                                </span>
                                                {(channel as any).avg_rating ? (
                                                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground flex-shrink-0">
                                                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                                        {Number((channel as any).avg_rating).toFixed(1)}
                                                    </span>
                                                ) : null}
                                            </div>

                                            {/* Row 2: Subs + Category */}
                                            <div className="flex items-center gap-1 text-[13px] text-muted-foreground mt-0.5">
                                                <span className="truncate">
                                                    {formatSubs(channel.verifiedStats?.subscribers || 0)} members
                                                </span>
                                                {catInfo && (
                                                    <>
                                                        <span className="text-muted-foreground/40">·</span>
                                                        <span className="truncate">{catInfo.first}</span>
                                                        {catInfo.extra > 0 && (
                                                            <span className="text-muted-foreground/60 flex-shrink-0">
                                                                +{catInfo.extra}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: Price + Chevron */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {minPrice !== null && (
                                                <span className="text-[13px] font-medium text-primary">
                                                    {minPrice} {currency}
                                                </span>
                                            )}
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
    )
}
