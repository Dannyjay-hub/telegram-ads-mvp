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
import { CampaignDetail } from '@/components/CampaignDetail'
import { CampaignMarketplace } from '@/components/CampaignMarketplace'
import { MarketplaceCampaignDetail } from '@/components/MarketplaceCampaignDetail'
import { PartnershipsList } from '@/components/PartnershipsList'
import { ChannelOwnerPartnerships } from '@/components/ChannelOwnerPartnerships'
import { MarketplaceContainer } from '@/components/MarketplaceContainer'
import { ChannelWizard } from '@/components/ChannelWizard'
import { ChannelViewPage } from '@/components/ChannelViewPage'
import { WalletButton } from '@/components/WalletButton'
import { EscrowPaymentPage } from '@/components/EscrowPaymentPage'
import { useTelegramBackButton, initTelegramViewport } from '@/hooks/useTelegramBackButton'

// TON Connect manifest URL - must be accessible publicly
const MANIFEST_URL = `${window.location.origin}/tonconnect-manifest.json`;

function AppContent() {
  const { error } = useTelegram();
  const navigate = useNavigate();

  // Enable Telegram native BackButton based on current route
  useTelegramBackButton();

  // Handle deep links from startapp parameter (e.g., from bot notifications)
  // IMPORTANT: Only run once on app mount to prevent navigation loops
  useEffect(() => {
    // Try multiple sources for the start parameter (Telegram injects it differently in different contexts)
    const getStartParam = (): string | null => {
      // Method 1: From WebApp SDK
      if (WebApp.initDataUnsafe?.start_param) {
        return WebApp.initDataUnsafe.start_param;
      }

      // Method 2: From URL search params (for inline button links)
      const urlParams = new URLSearchParams(window.location.search);
      const startapp = urlParams.get('tgWebAppStartParam') || urlParams.get('startapp');
      if (startapp) {
        return startapp;
      }

      return null;
    };

    const startParam = getStartParam();
    if (startParam) {
      console.log('[App] Deep link startapp:', startParam);

      // Clear URL params to prevent loop on navigation
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      // Parse and navigate based on parameter
      if (startParam.startsWith('channel_')) {
        const channelId = startParam.replace('channel_', '');
        navigate(`/channels/${channelId}/view`);
      } else if (startParam.startsWith('owner_deal_')) {
        // Channel owner viewing a deal request - go to channel partnerships
        const dealId = startParam.replace('owner_deal_', '');
        navigate(`/channels/partnerships?deal=${dealId}`);
      } else if (startParam.startsWith('schedule_')) {
        // Scheduling/time proposal - check who the user is and route accordingly
        // For now, route to partnerships as deals are managed there
        const dealId = startParam.replace('schedule_', '');
        // The partnerships page will detect the deal and show appropriate view
        navigate(`/partnerships?deal=${dealId}`);
      } else if (startParam.startsWith('deal_')) {
        // Advertiser viewing their deal - go to partnerships
        const dealId = startParam.replace('deal_', '');
        navigate(`/partnerships?deal=${dealId}`);
      } else if (startParam === 'dashboard') {
        navigate('/channel-owner');
      } else if (startParam === 'advertiser') {
        navigate('/advertiser');
      } else if (startParam === 'partnerships') {
        navigate('/partnerships');
      } else if (startParam === 'campaigns') {
        navigate('/campaigns');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = only run once on mount

  // WebApp initialization & theme handling
  useEffect(() => {
    try {
      // Initialize Telegram viewport CSS variables
      initTelegramViewport();

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
    <div className="min-h-screen w-full bg-background transition-colors duration-300">

      {/* Global Fixed WalletButton - centered in Telegram header safe area (like giveaway-tool) */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-end justify-center pointer-events-none"
        style={{
          height: 'var(--tg-header-height, 56px)',
          paddingBottom: '8px',
        }}
      >
        <div className="pointer-events-auto">
          <WalletButton />
        </div>
      </div>

      {/* Content - uses CSS variable for proper top padding below Telegram header */}
      <div
        className="relative z-10 p-4 max-w-md mx-auto"
        style={{
          paddingTop: 'calc(var(--tg-header-height, 56px) + 16px)'
        }}
      >

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/advertiser" element={<AdvertiserDashboard />} />
          <Route path="/channel-owner" element={<ChannelOwnerDashboard />} />
          <Route path="/create" element={<CampaignWizard />} />
          <Route path="/campaign/create" element={<CampaignWizard />} />
          <Route path="/campaign/create" element={<CampaignWizard />} />
          <Route path="/campaigns" element={<CampaignsList />} />
          <Route path="/campaigns/marketplace" element={<CampaignMarketplace />} />
          <Route path="/campaigns/marketplace/:id" element={<MarketplaceCampaignDetail />} />
          <Route path="/campaigns/escrow" element={<EscrowPaymentPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/channels/new" element={<ChannelWizard />} />
          <Route path="/channels/edit/:id" element={<ChannelWizard />} />
          <Route path="/channels/:id/view" element={<ChannelViewPage />} />
          <Route path="/channels/:id/settings" element={<ChannelWizard />} />
          <Route path="/marketplace/channel/:id" element={<ChannelViewPage />} />
          <Route path="/channels/my" element={<MyChannelsPage />} />
          <Route path="/channels/dashboard" element={<ChannelOwnerDashboard />} />
          <Route path="/channels/partnerships" element={<ChannelOwnerPartnerships />} />
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
    // restoreConnection=false prevents 404 errors when TonConnect's stored session expires  
    // Users will need to reconnect wallet on each session, but this is more reliable
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <BrowserRouter>
        <TelegramProvider>
          <AppContent />
        </TelegramProvider>
      </BrowserRouter>
    </TonConnectUIProvider>
  )
}

