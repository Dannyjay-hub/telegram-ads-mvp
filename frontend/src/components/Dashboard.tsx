
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '@/components/ui/card'
import { useTelegram } from '@/providers/TelegramProvider'
import { Briefcase, Tv } from 'lucide-react'
import { haptic } from '@/utils/haptic'

// Get user name instantly from WebApp (no async wait)
const getInstantUserName = (): string => {
    try {
        const webApp = (window as any)?.Telegram?.WebApp;
        const firstName = webApp?.initDataUnsafe?.user?.first_name;
        return firstName || 'Creator';
    } catch {
        return 'Creator';
    }
};

export function Dashboard() {
    const { user } = useTelegram()
    const navigate = useNavigate()

    // Use instant name, fallback to provider's user if available
    const displayName = user?.firstName || getInstantUserName();

    return (
        <div className="min-h-[80vh] flex flex-col justify-center space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Welcome, {displayName}!
                </h2>
                <p className="text-muted-foreground">Select your role to get started</p>
            </div>

            <div className="space-y-4">
                <GlassCard
                    onClick={() => { haptic.light(); navigate('/advertiser'); }}
                    className="p-8 flex items-center gap-6 cursor-pointer hover:bg-white/5 hover:border-purple-500/50 transition-all duration-300 group"
                >
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Briefcase className="w-8 h-8 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold mb-1">Advertiser</h3>
                        <p className="text-sm text-muted-foreground">Promote your products and manage campaigns.</p>
                    </div>
                </GlassCard>

                <GlassCard
                    onClick={() => { haptic.light(); navigate('/channel-owner'); }}
                    className="p-8 flex items-center gap-6 cursor-pointer hover:bg-white/5 hover:border-yellow-500/50 transition-all duration-300 group"
                >
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Tv className="w-8 h-8 text-yellow-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold mb-1">Channel Owner</h3>
                        <p className="text-sm text-muted-foreground">Monetize your audience and list channels.</p>
                    </div>
                </GlassCard>
            </div>
        </div>
    )
}
