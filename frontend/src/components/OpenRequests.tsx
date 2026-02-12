import { useEffect, useState } from 'react'
import { getBriefs, applyToBrief, type PublicBrief } from '@/api'
import { GlassCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Tag, SlidersHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { showWarning, showSuccess, showError } from '@/lib/telegram'

export function OpenRequests() {
    const [briefs, setBriefs] = useState<PublicBrief[]>([])
    const [loading, setLoading] = useState(true)
    const [applyingId, setApplyingId] = useState<string | null>(null)
    const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({})
    const [filters, setFilters] = useState({ minBudget: '', tag: '' })
    const navigate = useNavigate()

    // Mock Channel ID
    const myChannelId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

    useEffect(() => {
        loadBriefs()
    }, [])

    const loadBriefs = async () => {
        setLoading(true)
        try {
            // Updated API call with filters (Need to update api.ts to support params first? No, we pass empty obj if needed, but api.ts definition needs update)
            // Wait, getBriefs in api.ts doesn't support args yet in my previous step. I need to check api.ts.
            // Assuming I update api.ts next.
            const url = new URLSearchParams();
            if (filters.minBudget) url.append('minBudget', filters.minBudget);
            if (filters.tag) url.append('tag', filters.tag);

            // Temporary manual fetch slightly bypassing api.ts if needed or I update api.ts
            // Let's rely on api.ts update coming next.
            const data = await getBriefs(filters)
            setBriefs(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleApply = async (brief: PublicBrief) => {
        const bid = bidAmounts[brief.id];
        if (!bid) {
            showWarning("Please enter your bid amount");
            return;
        }

        setApplyingId(brief.id);
        try {
            await applyToBrief(brief.id, myChannelId, Number(bid));
            showSuccess("Application Sent! Check 'My Channels' to see the negotiation.");
            navigate('/channels/dashboard');
        } catch (e) {
            console.error(e);
            showError("Failed to apply");
        } finally {
            setApplyingId(null);
        }
    }

    return (
        <div className="pb-20 space-y-6">
            <h1 className="text-2xl font-bold">Open Requests</h1>

            {/* Filters */}
            <GlassCard className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <SlidersHorizontal className="w-4 h-4" /> Filters
                </div>
                <div className="flex gap-3">
                    <Input
                        placeholder="Min Budget ($)"
                        type="number"
                        value={filters.minBudget}
                        onChange={e => setFilters({ ...filters, minBudget: e.target.value })}
                        className="flex-1"
                    />
                    <Input
                        placeholder="Tag (e.g. Crypto)"
                        value={filters.tag}
                        onChange={e => setFilters({ ...filters, tag: e.target.value })}
                        className="flex-1"
                    />
                </div>
                <Button variant="secondary" onClick={loadBriefs} className="w-full h-8">Apply Filters</Button>
            </GlassCard>

            {loading ? (
                <Loader2 className="animate-spin mx-auto" />
            ) : briefs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No open requests matching filters.</div>
            ) : (
                <div className="space-y-4">
                    {briefs.map(brief => (
                        <GlassCard key={brief.id} className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg">{brief.title}</h3>
                                <div className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-xs font-bold border border-green-500/20">
                                    ${brief.budgetRangeMin} - ${brief.budgetRangeMax}
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{brief.content}</p>

                            <div className="flex flex-wrap gap-2 mb-4">
                                {brief.tags?.map(tag => (
                                    <span key={tag} className="text-xs flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-muted-foreground">
                                        <Tag className="w-3 h-3" /> {tag}
                                    </span>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-white/5 flex gap-3 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Your Bid ({brief.currency})</label>
                                    <Input
                                        type="number"
                                        placeholder="Enter amount..."
                                        value={bidAmounts[brief.id] || ''}
                                        onChange={e => setBidAmounts({ ...bidAmounts, [brief.id]: e.target.value })}
                                        className="h-10"
                                    />
                                </div>
                                <Button
                                    onClick={() => handleApply(brief)}
                                    disabled={applyingId === brief.id}
                                    className="h-10 px-6 shadow-lg shadow-primary/20"
                                >
                                    {applyingId === brief.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply Now'}
                                </Button>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    )
}
