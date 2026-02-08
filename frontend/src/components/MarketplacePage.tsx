
import { useEffect, useState } from 'react'
import { getMarketplaceChannels, type Channel } from '@/lib/api'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Filter, MessageCircle, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const CATEGORIES = ['All', 'Crypto', 'Tech', 'Business', 'Lifestyle', 'News', 'Entertainment']

export function MarketplacePage() {
    const navigate = useNavigate()
    const [channels, setChannels] = useState<Channel[]>([])
    const [selectedCategory, setSelectedCategory] = useState('All')

    useEffect(() => {
        loadMarketplace()
    }, [])

    const loadMarketplace = async () => {
        try {
            const data = await getMarketplaceChannels()
            setChannels(data)
        } catch (e) {
            console.error(e)
        }
    }

    // Filter channels by selected category (handles both string and array category formats)
    const filteredChannels = selectedCategory === 'All'
        ? channels
        : channels.filter(c => {
            const categories = Array.isArray(c.category) ? c.category : (c.category ? [c.category] : [])
            return categories.some(cat => cat.toLowerCase() === selectedCategory.toLowerCase())
        })

    return (
        <div className="pb-20">

            {/* Category Filters */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {CATEGORIES.map(cat => (
                    <Button
                        key={cat}
                        size="sm"
                        variant={selectedCategory === cat ? "secondary" : "outline"}
                        className={`text-xs h-8 whitespace-nowrap ${selectedCategory === cat
                            ? 'bg-primary/20 border-primary/30 text-primary'
                            : 'border-white/10'
                            }`}
                        onClick={() => setSelectedCategory(cat)}
                    >
                        {cat === 'All' && <Filter className="w-3 h-3 mr-2" />}
                        {cat === 'All' ? 'All Categories' : cat}
                    </Button>
                ))}
            </div>

            <div className="space-y-4">
                {filteredChannels.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-xl">
                        <p>No channels found in "{selectedCategory}"</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => setSelectedCategory('All')}
                        >
                            View All Channels
                        </Button>
                    </div>
                ) : (
                    filteredChannels.map(channel => (
                        <GlassCard
                            key={channel.id}
                            className="p-0 overflow-hidden group cursor-pointer hover:border-primary/30 transition-colors"
                            onClick={() => navigate(`/marketplace/channel/${channel.id}`, { state: { from: '/marketplace?tab=channels' } })}
                        >
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex gap-3">
                                        {channel.photoUrl ? (
                                            <img
                                                src={channel.photoUrl}
                                                alt={channel.title}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-lg">
                                                {channel.title.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="font-bold">{channel.title}</h3>
                                            <p className="text-xs text-muted-foreground">@{channel.username}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 text-xs text-muted-foreground mb-4">
                                    <span className="flex items-center gap-1">
                                        <BarChart3 className="w-3 h-3" />
                                        {(channel.verifiedStats?.subscribers || 0).toLocaleString()} Subs
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MessageCircle className="w-3 h-3" />
                                        ~{channel.avgViews || 0} Avg Views
                                    </span>
                                </div>

                                {/* Quick Price Preview */}
                                <div className="flex justify-between items-center bg-white/5 rounded-lg p-3 border border-white/5">
                                    <span className="text-sm text-muted-foreground">
                                        {channel.rateCard && channel.rateCard.length > 0
                                            ? `${channel.rateCard.length} Package${channel.rateCard.length > 1 ? 's' : ''} Available`
                                            : 'No packages yet'
                                        }
                                    </span>
                                    <span className="font-bold text-primary">
                                        {channel.rateCard && channel.rateCard.length > 0
                                            ? `${Math.min(...channel.rateCard.map((p: any) => p.price || 0))} ${channel.rateCard[0]?.currency || 'TON'}+`
                                            : ''
                                        }
                                    </span>
                                </div>
                            </div>
                        </GlassCard>
                    ))
                )}
            </div>
        </div>
    )
}
