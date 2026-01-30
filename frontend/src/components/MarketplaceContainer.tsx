
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Search, Megaphone, Briefcase } from 'lucide-react'
import { MarketplacePage } from './MarketplacePage' // Rename imports later if needed
import { Input } from '@/components/ui/input'

// Placeholder for the Campaigns Marketplace (Sell Side)
function CampaignsMarketplaceTab() {
    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search campaigns by niche, budget..." className="pl-9 bg-white/5 border-white/10" />
                </div>
            </div>

            <div className="text-center py-20 text-muted-foreground border border-dashed border-white/10 rounded-xl">
                <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Open Campaigns</h3>
                <p>Advertisers haven't posted any public campaigns yet.</p>
                <p className="text-sm mt-2">Check back later or enable notifications.</p>
            </div>
        </div>
    )
}

export function MarketplaceContainer() {
    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()
    const location = useLocation()
    const activeTab = searchParams.get('tab') || 'channels' // 'channels' or 'campaigns'

    // Get origin from state (where user came from) or default to home
    const origin = (location.state as any)?.from || '/'

    const setTab = (tab: string) => {
        // Use replace: true so tab changes don't add to browser history
        setSearchParams({ tab }, { replace: true })
    }

    const handleBack = () => {
        navigate(origin)
    }

    return (
        <div className="pb-20 space-y-6">
            {/* Header with Navigation & Toggle */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleBack} className="mr-1">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
                        Marketplace
                    </h1>
                </div>

                {/* P2P Style Toggle */}
                <div className="bg-black/20 p-1 rounded-xl flex relative">
                    {/* Sliding Background (CSS-only for simplicity or Framer Motion later) */}
                    <div
                        className={`absolute top-1 bottom-1 rounded-lg bg-white/10 transition-all duration-300 ease-out`}
                        style={{
                            left: activeTab === 'channels' ? '0.25rem' : '50%',
                            width: 'calc(50% - 0.25rem)'
                        }}
                    />

                    <button
                        onClick={() => setTab('channels')}
                        className={`flex-1 relative z-10 py-3 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'channels' ? 'text-white' : 'text-muted-foreground hover:text-white/80'}`}
                    >
                        <Megaphone className="w-4 h-4" />
                        Find Channels
                    </button>
                    <button
                        onClick={() => setTab('campaigns')}
                        className={`flex-1 relative z-10 py-3 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'campaigns' ? 'text-white' : 'text-muted-foreground hover:text-white/80'}`}
                    >
                        <Briefcase className="w-4 h-4" />
                        Find Campaigns
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[50vh]">
                {activeTab === 'channels' ? (
                    /* The existing Advertiser View (Find Channels) */
                    <MarketplacePage />
                ) : (
                    /* The new Channel Owner View (Find Campaigns) */
                    <CampaignsMarketplaceTab />
                )}
            </div>
        </div>
    )
}
