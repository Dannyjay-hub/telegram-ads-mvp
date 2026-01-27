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

function AppContent() {


  const { isLoading, error } = useTelegram();

  // Theme handling
  useEffect(() => {
    // We can rely on TelegramProvider for init, but theme handling can stay here or move to provider
    // For now, let's keep theme logic simple
    if (WebApp.colorScheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20" />
          <p>Connecting to Telegram...</p>
        </div>
      </div>
    )
  }

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
        <header className="mb-6 flex justify-between items-center py-2 px-1">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
            AdMarket
          </h1>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 dark:from-gray-700 dark:to-gray-600" />
        </header>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/advertiser" element={<AdvertiserDashboard />} />
          <Route path="/channel-owner" element={<ChannelOwnerDashboard />} />
          <Route path="/create" element={<CampaignWizard />} />
          <Route path="/campaigns" element={<CampaignsList />} />
          <Route path="/channels/new" element={<ChannelWizard />} />
          <Route path="/channels/edit/:id" element={<ChannelWizard />} />
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
