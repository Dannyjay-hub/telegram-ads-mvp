import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
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

function AppContent() {


  const { error } = useTelegram();

  // WebApp initialization & theme handling
  useEffect(() => {
    try {
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
      {/* Ambient Backlights */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 p-4 max-w-md mx-auto">

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
          <Route path="/channels/dashboard" element={<ChannelOwnerDashboard />} /> {/* Keep for backward compat if needed, or remove? Keeping for now but redirecting logic is in dashboard.tsx */}
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
    <BrowserRouter>
      <TelegramProvider>
        <AppContent />
      </TelegramProvider>
    </BrowserRouter>
  )
}
