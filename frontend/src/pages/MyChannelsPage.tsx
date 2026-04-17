
import { useEffect, useState } from 'react'
import { getMyChannels, type Channel } from '@/api'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/providers/TelegramProvider'
import { ChannelAnalyticsCard } from '@/components/ChannelAnalyticsCard'
import { haptic } from '@/utils/haptic'

export function MyChannelsPage() {
    const { user } = useTelegram();
    const [channels, setChannels] = useState<Channel[]>([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        if (user) {
            loadChannels()
        }
    }, [user])

    const loadChannels = async () => {
        try {
            const data = await getMyChannels()
            setChannels(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center px-6 pt-4 pb-4">
                <h1
                    className="text-[20px] font-extrabold text-white"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                    My Channels
                </h1>
                <button
                    onClick={() => { haptic.light(); navigate('/channels/add'); }}
                    className="flex items-center gap-1.5 bg-[rgba(19,127,236,0.15)] border border-[rgba(19,127,236,0.2)] rounded-full px-4 py-2 transition-all active:scale-[0.96]"
                >
                    <span className="material-icons-round text-[16px] text-[#137fec]">add</span>
                    <span className="text-[13px] font-bold text-[#137fec]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Add New
                    </span>
                </button>
            </div>

            {/* Channel List */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-4">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <span className="material-icons-round text-[24px] text-[#137fec] animate-spin">progress_activity</span>
                    </div>
                ) : channels.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-[#1e293b] rounded-[16px]">
                        <span className="material-icons-round text-[48px] text-[#334155] mb-4 block">tv_off</span>
                        <p className="text-[14px] text-[#94a3b8] mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            You haven't listed any channels yet.
                        </p>
                        <Button onClick={() => navigate('/channels/add')}>List Your First Channel</Button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {channels.map(channel => (
                            <div key={channel.id} className="bg-[#1e293b] rounded-[16px] p-5">
                                {/* Channel Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-[16px] font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                            {channel.title}
                                        </h3>
                                        <button
                                            onClick={() => {
                                                const url = `https://t.me/${channel.username}`;
                                                if ((window as any).Telegram?.WebApp?.openTelegramLink) {
                                                    (window as any).Telegram.WebApp.openTelegramLink(url);
                                                } else {
                                                    window.open(url, '_blank');
                                                }
                                            }}
                                            className="text-[13px] text-[#137fec] hover:underline text-left mt-0.5"
                                            style={{ fontFamily: "'Manrope', sans-serif" }}
                                        >
                                            @{channel.username}
                                        </button>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${channel.isActive ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' : 'bg-[rgba(249,115,22,0.15)] text-[#f97316]'}`}>
                                            {channel.isActive ? 'Active' : 'Pending'}
                                        </div>
                                        <div className="text-[10px] uppercase tracking-[0.5px] text-[#64748b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                            {channel.rateCard?.length || 0} packages
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 mb-4">
                                    {!channel.isActive ? (
                                        <button
                                            className="w-full bg-[#137fec] hover:bg-[#137fec]/90 text-white font-bold rounded-[12px] py-2.5 text-[14px] transition-all active:scale-[0.98]"
                                            onClick={() => navigate(`/channels/edit/${channel.id}`, { state: { from: '/channels/my' } })}
                                            style={{ fontFamily: "'Manrope', sans-serif" }}
                                        >
                                            Complete Draft
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                className="flex-1 bg-[#334155] text-white font-medium rounded-[12px] py-2 text-[13px] transition-all active:scale-[0.98]"
                                                onClick={() => navigate(`/channels/${channel.id}/view`, { state: { from: '/channels/my' } })}
                                                style={{ fontFamily: "'Manrope', sans-serif" }}
                                            >
                                                View
                                            </button>
                                            <button
                                                className="flex-1 bg-[#334155] text-white font-medium rounded-[12px] py-2 text-[13px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                                onClick={() => navigate(`/channels/edit/${channel.id}`, { state: { from: '/channels/my' } })}
                                                style={{ fontFamily: "'Manrope', sans-serif" }}
                                            >
                                                <span className="material-icons-round text-[14px]">settings</span>
                                                Settings
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Analytics Section */}
                                <ChannelAnalyticsCard channel={channel} onSync={loadChannels} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
