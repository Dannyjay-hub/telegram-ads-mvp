import { useSearchParams } from 'react-router-dom'
import { MarketplacePage } from '@/components/MarketplacePage'
import { CampaignMarketplace } from './CampaignMarketplace'
import { haptic } from '@/utils/haptic'

// CampaignsMarketplaceTab - uses the real CampaignMarketplace component
function CampaignsMarketplaceTab() {
    return <CampaignMarketplace />
}

export function MarketplaceContainer() {
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = searchParams.get('tab') || 'channels' // 'channels' or 'campaigns'

    const setTab = (tab: string) => {
        haptic.light()
        // Use replace: true so tab changes don't add to browser history
        setSearchParams({ tab }, { replace: true })
    }

    return (
        <div className="flex flex-col h-[calc(100dvh-56px-80px)]">
            {/* Tab Toggle - Figma style pill */}
            <div className="flex-shrink-0 flex justify-center px-6 pb-4 pt-4">
                <div
                    className="relative flex items-center rounded-[16px] h-[40px] p-[3px] w-full max-w-[320px]"
                    style={{ background: 'rgba(30, 41, 59, 0.8)' }}
                >
                    {/* Sliding indicator */}
                    <div
                        className="absolute top-[3px] h-[calc(100%-6px)] rounded-[13px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none z-0"
                        style={{
                            background: '#137fec',
                            width: 'calc(50% - 3px)',
                            left: activeTab === 'channels' ? '3px' : '50%',
                        }}
                    />

                    <button
                        onClick={() => setTab('channels')}
                        className="relative z-10 flex items-center justify-center h-full flex-1 text-[14px] font-bold bg-transparent transition-colors rounded-[13px]"
                        style={{
                            color: activeTab === 'channels' ? '#ffffff' : '#94a3b8',
                            fontFamily: "'Manrope', sans-serif",
                        }}
                    >
                        Find Channels
                    </button>
                    <button
                        onClick={() => setTab('campaigns')}
                        className="relative z-10 flex items-center justify-center h-full flex-1 text-[14px] font-bold bg-transparent transition-colors rounded-[13px]"
                        style={{
                            color: activeTab === 'campaigns' ? '#ffffff' : '#94a3b8',
                            fontFamily: "'Manrope', sans-serif",
                        }}
                    >
                        Find Campaigns
                    </button>
                </div>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide px-4">
                {activeTab === 'channels' ? (
                    <MarketplacePage />
                ) : (
                    <CampaignsMarketplaceTab />
                )}
            </div>
        </div>
    )
}
