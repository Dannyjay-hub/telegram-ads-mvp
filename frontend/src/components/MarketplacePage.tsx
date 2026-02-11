import { useEffect, useState } from 'react'
import { getMarketplaceChannels, type Channel } from '@/lib/api'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageCircle, Star } from 'lucide-react'
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

    // Get min price from rate card
    const getMinPrice = (channel: Channel) => {
        if (!channel.rateCard?.length) return null
        const minPrice = Math.min(...channel.rateCard.map((p: any) => p.price || Infinity))
        return minPrice === Infinity ? null : minPrice
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
            <div className="flex-1 overflow-y-auto pb-20">
                <div className="space-y-3">
                    {loading ? (
                        // Loading Skeletons
                        Array.from({ length: 3 }).map((_, i) => (
                            <GlassCard key={i} className="p-4">
                                <div className="animate-pulse">
                                    <div className="flex gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-muted" />
                                        <div className="flex-1">
                                            <div className="h-4 bg-muted rounded w-32 mb-2" />
                                            <div className="h-3 bg-muted rounded w-20" />
                                        </div>
                                    </div>
                                    <div className="h-10 bg-muted rounded" />
                                </div>
                            </GlassCard>
                        ))
                    ) : filteredChannels.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-[14px]">
                            <p className="mb-2">No channels match your filters</p>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={clearFilters}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    ) : (
                        filteredChannels.map(channel => (
                            <GlassCard
                                key={channel.id}
                                className="p-4 cursor-pointer hover:border-primary/30 transition-colors active:scale-[0.99]"
                                onClick={() => navigate(`/marketplace/channel/${channel.id}`, { state: { from: '/marketplace?tab=channels' } })}
                            >
                                {/* Header: Avatar + Name */}
                                <div className="flex gap-3 mb-3">
                                    {channel.photoUrl ? (
                                        <img
                                            src={channel.photoUrl}
                                            alt={channel.title}
                                            className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-lg flex-shrink-0">
                                            {channel.title.charAt(0)}
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-semibold text-[15px] truncate">{channel.title}</h3>
                                        <p className="text-[13px] text-muted-foreground truncate">
                                            @{channel.username} • {formatSubs(channel.verifiedStats?.subscribers || 0)} subs
                                        </p>
                                    </div>
                                </div>

                                {/* Stats Row */}
                                <div className="flex items-center gap-3 text-[13px] text-muted-foreground mb-3">
                                    {/* Rating */}
                                    {(channel as any).avg_rating ? (
                                        <span className="flex items-center gap-1">
                                            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                            {Number((channel as any).avg_rating).toFixed(1)}
                                            <span className="text-muted-foreground/60">
                                                ({(channel as any).total_ratings || 0})
                                            </span>
                                        </span>
                                    ) : (
                                        <span className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-medium">
                                            New
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        ~{channel.avgViews || 0} views
                                    </span>
                                </div>

                                {/* Category & Price */}
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-1.5 flex-wrap">
                                        {parseTagArray(channel.category)
                                            .slice(0, 2)
                                            .map((cat, i) => (
                                                <span
                                                    key={i}
                                                    className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium"
                                                >
                                                    {cat}
                                                </span>
                                            ))}
                                        {parseTagArray(channel.language).length > 0 && (
                                            <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium">
                                                {parseTagArray(channel.language)[0]}
                                            </span>
                                        )}
                                    </div>
                                    {getMinPrice(channel) !== null && (
                                        <span className="text-[13px] font-semibold text-primary">
                                            From {getMinPrice(channel)} TON
                                        </span>
                                    )}
                                </div>
                            </GlassCard>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
