import { useSearchParams } from 'react-router-dom'
import { Megaphone, Briefcase } from 'lucide-react'
import { MarketplacePage } from './MarketplacePage'
import { CampaignMarketplace } from './CampaignMarketplace'

// CampaignsMarketplaceTab - uses the real CampaignMarketplace component
function CampaignsMarketplaceTab() {
    return <CampaignMarketplace />
}

export function MarketplaceContainer() {
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = searchParams.get('tab') || 'channels' // 'channels' or 'campaigns'

    const setTab = (tab: string) => {
        // Use replace: true so tab changes don't add to browser history
        setSearchParams({ tab }, { replace: true })
    }

    return (
        <div className="flex flex-col h-[calc(100vh-60px)]">
            {/* Sticky Tabs - No "Marketplace" title */}
            <div className="flex-shrink-0 bg-[--tg-theme-bg-color] pb-3">
                {/* P2P Style Toggle */}
                <div className="bg-black/20 p-1 rounded-xl flex relative">
                    {/* Sliding Background */}
                    <div
                        className="absolute top-1 bottom-1 rounded-lg bg-white/10 transition-all duration-300 ease-out"
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

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0" style={{ overscrollBehavior: 'contain' }}>
                {activeTab === 'channels' ? (
                    <MarketplacePage />
                ) : (
                    <CampaignsMarketplaceTab />
                )}
            </div>
        </div>
    )
}
