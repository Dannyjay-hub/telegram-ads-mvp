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
        <div className="flex flex-col h-full min-h-screen">
            {/* Sticky Header Section - includes title, tabs */}
            <div className="sticky top-0 z-30 bg-[--tg-theme-bg-color] pb-3 -mx-4 px-4 pt-2">
                {/* Title */}
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500 mb-3">
                    Marketplace
                </h1>

                {/* P2P Style Toggle */}
                <div className="bg-[--tg-theme-secondary-bg-color] p-1 rounded-xl flex relative">
                    {/* Sliding Background */}
                    <div
                        className="absolute top-1 bottom-1 rounded-lg bg-[--tg-theme-button-color]/20 transition-all duration-300 ease-out"
                        style={{
                            left: activeTab === 'channels' ? '0.25rem' : '50%',
                            width: 'calc(50% - 0.25rem)'
                        }}
                    />

                    <button
                        onClick={() => setTab('channels')}
                        className={`flex-1 relative z-10 py-3 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'channels' ? 'text-[--tg-theme-text-color]' : 'text-[--tg-theme-hint-color]'}`}
                    >
                        <Megaphone className="w-4 h-4" />
                        Find Channels
                    </button>
                    <button
                        onClick={() => setTab('campaigns')}
                        className={`flex-1 relative z-10 py-3 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'campaigns' ? 'text-[--tg-theme-text-color]' : 'text-[--tg-theme-hint-color]'}`}
                    >
                        <Briefcase className="w-4 h-4" />
                        Find Campaigns
                    </button>
                </div>
            </div>

            {/* Content Area - scrollable */}
            <div className="flex-1 pb-20">
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
