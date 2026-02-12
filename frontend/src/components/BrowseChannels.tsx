import { useEffect, useState } from 'react'
import { getMarketplaceChannels, type Channel } from '@/api'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, SlidersHorizontal, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function BrowseChannels() {
    const [channels, setChannels] = useState<Channel[]>([])
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState({ minSubscribers: '', maxPrice: '' })
    const navigate = useNavigate()

    useEffect(() => {
        loadChannels()
    }, [])

    const loadChannels = async () => {
        setLoading(true)
        try {
            const data = await getMarketplaceChannels({
                minSubscribers: Number(filters.minSubscribers) || undefined,
                maxPrice: Number(filters.maxPrice) || undefined
            })
            setChannels(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleHire = (channel: Channel) => {
        // Navigate to channel view page
        navigate(`/channels/${channel.id}`);
    }

    return (
        <div className="pb-20 space-y-6">
            <h1 className="text-2xl font-bold">Browse Channels</h1>

            {/* Filters */}
            <GlassCard className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <SlidersHorizontal className="w-4 h-4" /> Filters
                </div>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Min Subscribers"
                            type="number"
                            value={filters.minSubscribers}
                            onChange={e => setFilters({ ...filters, minSubscribers: e.target.value })}
                        />
                    </div>
                    <div className="flex-1">
                        <Input
                            placeholder="Max Price ($)"
                            type="number"
                            value={filters.maxPrice}
                            onChange={e => setFilters({ ...filters, maxPrice: e.target.value })}
                        />
                    </div>
                </div>
                <Button onClick={loadChannels} className="w-full" variant="secondary">
                    Apply Filters
                </Button>
            </GlassCard>

            {/* Results */}
            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
            ) : channels.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">No channels found matching criteria.</div>
            ) : (
                <div className="space-y-4">
                    {channels.map(channel => (
                        <GlassCard key={channel.id} className="p-4 flex items-center gap-4">
                            {channel.photoUrl ? (
                                <img
                                    src={channel.photoUrl}
                                    alt={channel.title}
                                    className="w-12 h-12 rounded-full object-cover shrink-0"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-bold shrink-0">
                                    {channel.title.charAt(0)}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold truncate">{channel.title}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Users className="w-3 h-3" />
                                    {channel.verifiedStats?.subscribers?.toLocaleString() || 0}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="font-bold text-lg">
                                    {channel.rateCard?.length ? (
                                        <>From {Math.min(...channel.rateCard.map((p: any) => p.price))} {channel.rateCard[0]?.currency || 'TON'}</>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">No packages</span>
                                    )}
                                </div>
                                <Button size="sm" onClick={() => handleHire(channel)} className="mt-1 h-8">
                                    Hire
                                </Button>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    )
}
