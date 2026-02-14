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
        <div className="flex flex-col h-[calc(100dvh-56px-32px)]">
            {/* Sticky Header — center-aligned compact pill toggle (matches Access) */}
            <div className="flex-shrink-0 flex justify-center pb-4">
                <div
                    className="relative flex items-center rounded-[18px] h-[36px] p-[2px]"
                    style={{ backgroundColor: 'var(--fill-secondary)' }}
                >
                    {/* Sliding indicator */}
                    <div
                        className="absolute top-[2px] h-[calc(100%-4px)] rounded-[16px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none z-0"
                        style={{
                            backgroundColor: 'var(--tg-theme-section-bg-color, var(--card))',
                            width: activeTab === 'channels' ? '136px' : '150px',
                            left: activeTab === 'channels' ? '2px' : '138px',
                        }}
                    />

                    <button
                        onClick={() => setTab('channels')}
                        className="relative z-10 flex items-center justify-center h-full px-5 text-[15px] font-semibold bg-transparent transition-colors"
                        style={{ color: 'var(--tg-theme-text-color, inherit)' }}
                    >
                        Find Channels
                    </button>
                    <button
                        onClick={() => setTab('campaigns')}
                        className="relative z-10 flex items-center justify-center h-full px-5 text-[15px] font-semibold bg-transparent transition-colors"
                        style={{ color: 'var(--tg-theme-text-color, inherit)' }}
                    >
                        Find Campaigns
                    </button>
                </div>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide">
                {activeTab === 'channels' ? (
                    <MarketplacePage />
                ) : (
                    <CampaignsMarketplaceTab />
                )}
            </div>
        </div>
    )
}
