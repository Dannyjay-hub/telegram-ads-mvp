
import { useEffect, useState } from 'react'
import { getMarketplaceChannels, type Channel } from '@/lib/api'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Filter, Star, MessageCircle, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function MarketplacePage() {
    const navigate = useNavigate()
    const [channels, setChannels] = useState<Channel[]>([])

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

    return (
        <div className="pb-20">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-xl font-bold">Marketplace</h1>
                    <p className="text-xs text-muted-foreground">Find the perfect channel for your ad</p>
                </div>
            </div>

            {/* Filters (Mock) */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <Button size="sm" variant="secondary" className="bg-white/10 border border-white/10 text-xs h-8">
                    <Filter className="w-3 h-3 mr-2" /> All Categories
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-8 border-white/10">Crypto</Button>
                <Button size="sm" variant="outline" className="text-xs h-8 border-white/10">Tech</Button>
                <Button size="sm" variant="outline" className="text-xs h-8 border-white/10">Business</Button>
            </div>

            <div className="space-y-4">
                {channels.map(channel => (
                    <GlassCard key={channel.id} className="p-0 overflow-hidden group">
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-lg">
                                        {channel.title.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold">{channel.title}</h3>
                                        <p className="text-xs text-muted-foreground">@{channel.username}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
                                        <Star className="w-3 h-3 fill-green-400" /> 4.9
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-4 text-xs text-muted-foreground mb-4">
                                <span className="flex items-center gap-1">
                                    <BarChart3 className="w-3 h-3" />
                                    {channel.verifiedStats?.subscribers?.toLocaleString() || '1.1k'} Subs
                                </span>
                                <span className="flex items-center gap-1">
                                    <MessageCircle className="w-3 h-3" />
                                    ~{channel.avgViews || 500} Avg Views
                                </span>
                            </div>

                            {/* Packages Preview */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Available Packages</h4>
                                {channel.rateCard && channel.rateCard.length > 0 ? (
                                    <div className="grid gap-2">
                                        {channel.rateCard.map((pkg: any, idx: number) => (
                                            <div key={idx} className="bg-white/5 hover:bg-white/10 rounded-lg p-3 flex justify-between items-center transition-colors cursor-pointer border border-white/5 hover:border-primary/30 group">
                                                <div>
                                                    <span className="text-sm font-medium block">{pkg.title || 'Untitled Package'}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase bg-white/5 px-1.5 py-0.5 rounded mt-1 inline-block tracking-wider group-hover:bg-white/10 transition-colors">
                                                        {pkg.type || 'POST'}
                                                    </span>
                                                </div>
                                                <Button size="sm" className="h-8 text-xs font-bold bg-primary/20 hover:bg-primary/40 text-primary border border-primary/20 px-3">
                                                    ${pkg.price}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-white/5 rounded-lg p-3 flex justify-between items-center border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">Standard Post</span>
                                            <span className="text-[10px] text-muted-foreground uppercase bg-white/5 px-1.5 py-0.5 rounded mt-1 inline-block tracking-wider">
                                                Starting At
                                            </span>
                                        </div>
                                        <Button size="sm" className="h-8 text-xs font-bold bg-primary/20 hover:bg-primary/40 text-primary border border-primary/20 px-3">
                                            ${channel.basePriceAmount || 100}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </div>
    )
}
