import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { TelegramProvider, useTelegram } from '@/providers/TelegramProvider'
import { Dashboard } from '@/components/Dashboard'
import { CampaignWizard } from '@/components/CampaignWizard'
import { AdvertiserDashboard } from '@/components/AdvertiserDashboard'
import { ChannelOwnerDashboard } from '@/components/ChannelOwnerDashboard'
import { MyChannelsPage } from '@/components/MyChannelsPage'
import { CampaignsList } from '@/components/CampaignsList'
import { PartnershipsList } from '@/components/PartnershipsList'
import { MarketplaceContainer } from '@/components/MarketplaceContainer'
import { ChannelWizard } from '@/components/ChannelWizard'
import { ChannelViewPage } from '@/components/ChannelViewPage'
import { WalletButton } from '@/components/WalletButton'

// TON Connect manifest URL - must be accessible publicly
const MANIFEST_URL = `${window.location.origin}/tonconnect-manifest.json`;

function AppContent() {
  const { error } = useTelegram();
  const navigate = useNavigate();

  // Handle deep links from startapp parameter (e.g., from bot notifications)
  useEffect(() => {
    const startParam = WebApp.initDataUnsafe?.start_param;
    if (startParam) {
      console.log('[App] Deep link startapp:', startParam);

      // Parse the startapp parameter
      if (startParam.startsWith('channel_')) {
        const channelId = startParam.replace('channel_', '');
        navigate(`/channels/${channelId}/view`);
      } else if (startParam === 'dashboard') {
        navigate('/channel-owner');
      }
    }
  }, [navigate]);

  // WebApp initialization & theme handling
  useEffect(() => {
    try {
      // Signal that app is ready
      if (typeof WebApp.ready === 'function') {
        WebApp.ready();
      }

      // Expand to fullscreen (shows the minimize chevron button)
      WebApp.expand();

      // Disable vertical swipes (prevents accidental close by swiping down)
      if (typeof WebApp.disableVerticalSwipes === 'function') {
        WebApp.disableVerticalSwipes();
      }

      // Note: requestFullscreen() and lockOrientation() removed - they push content behind status bar

      // Sync colors with theme
      const isDark = WebApp.colorScheme === 'dark';
      const bgColor = isDark ? '#0a0a0f' : '#ffffff';
      const headerColor = isDark ? '#0a0a0f' : '#ffffff';

      if (typeof WebApp.setHeaderColor === 'function') {
        WebApp.setHeaderColor(headerColor);
      }
      if (typeof WebApp.setBackgroundColor === 'function') {
        WebApp.setBackgroundColor(bgColor);
      }
      if (typeof WebApp.setBottomBarColor === 'function') {
        WebApp.setBottomBarColor(bgColor);
      }

      // Apply theme class
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.error('WebApp initialization error:', e);
    }
  }, [])

  // Skip loading screen - render app immediately while auth happens in background

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4 text-center">
        <div>
          <h1 className="text-xl font-bold text-red-500 mb-2">Connection Failed</h1>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-background transition-colors duration-300 relative overflow-hidden">

      {/* Fixed Header with Wallet Button - positioned below Telegram native header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/30"
        style={{
          paddingTop: 'calc(var(--tg-viewport-safe-area-inset-top, 0px) + var(--tg-viewport-content-safe-area-inset-top, 0px))'
        }}
      >
        <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-end">
          <WalletButton />
        </div>
      </header>

      {/* Content with padding for fixed header */}
      <div
        className="relative z-10 p-4 max-w-md mx-auto"
        style={{
          paddingTop: 'calc(var(--tg-viewport-safe-area-inset-top, 0px) + var(--tg-viewport-content-safe-area-inset-top, 0px) + 52px)'
        }}
      >

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/advertiser" element={<AdvertiserDashboard />} />
          <Route path="/channel-owner" element={<ChannelOwnerDashboard />} />
          <Route path="/create" element={<CampaignWizard />} />
          <Route path="/campaigns" element={<CampaignsList />} />
          <Route path="/channels/new" element={<ChannelWizard />} />
          <Route path="/channels/edit/:id" element={<ChannelWizard />} />
          <Route path="/channels/:id/view" element={<ChannelViewPage />} />
          <Route path="/channels/:id/settings" element={<ChannelWizard />} />
          <Route path="/marketplace/channel/:id" element={<ChannelViewPage />} />
          <Route path="/channels/my" element={<MyChannelsPage />} />
          <Route path="/channels/dashboard" element={<ChannelOwnerDashboard />} />
          <Route path="/channels/partnerships" element={<PartnershipsList />} />
          <Route path="/marketplace" element={<MarketplaceContainer />} />
          <Route path="/marketplace/requests" element={<MarketplaceContainer />} />
          <Route path="/partnerships" element={<PartnershipsList />} />
        </Routes>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <BrowserRouter>
        <TelegramProvider>
          <AppContent />
        </TelegramProvider>
      </BrowserRouter>
    </TonConnectUIProvider>
  )
}
