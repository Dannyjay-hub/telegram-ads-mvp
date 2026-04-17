/**
 * ChannelOwnerDashboard - Figma Design (node 1:288)
 * Dark theme channel owner dashboard with earnings summary, quick actions grid,
 * and ongoing placements section
 */

import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/providers/TelegramProvider'
import { haptic } from '@/utils/haptic'
import { getBotDeepLinkUrl } from '@/lib/telegram'

export function ChannelOwnerDashboard() {
    const navigate = useNavigate()
    const { user } = useTelegram()

    const displayName = user?.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : 'Channel Owner'

    const openSupport = () => {
        haptic.light();
        const url = getBotDeepLinkUrl('support');
        if ((window as any).Telegram?.WebApp?.openTelegramLink) {
            (window as any).Telegram.WebApp.openTelegramLink(url);
        } else {
            window.open(url, '_blank');
        }
    }

    const quickActions = [
        {
            icon: 'campaign',
            iconColor: '#137fec',
            iconBg: 'rgba(19, 127, 236, 0.15)',
            label: 'List Channel',
            desc: 'Grow your audience revenue',
            onClick: () => { haptic.light(); navigate('/channels/add'); },
        },
        {
            icon: 'explore',
            iconColor: '#f97316',
            iconBg: 'rgba(249, 115, 22, 0.15)',
            label: 'Explore Ads',
            desc: 'Find perfect ad campaigns',
            onClick: () => { haptic.light(); navigate('/marketplace?tab=campaigns', { state: { from: '/channel-owner' } }); },
        },
        {
            icon: 'handshake',
            iconColor: '#22c55e',
            iconBg: 'rgba(34, 197, 94, 0.15)',
            label: 'Partnerships',
            desc: 'Manage your collaborations',
            onClick: () => { haptic.light(); navigate('/channels/partnerships'); },
        },
        {
            icon: 'list_alt',
            iconColor: '#94a3b8',
            iconBg: 'rgba(148, 163, 184, 0.1)',
            label: 'My Channels',
            desc: 'View & manage listings',
            onClick: () => { haptic.light(); navigate('/channels/my'); },
        },
    ]

    const placements = [
        { name: 'Crypto Pulse Promo', impressions: '2.4k impressions', status: 'Active', amount: '+$120.00', time: '2H AGO' },
        { name: 'FinTech App Review', impressions: 'Scheduled for Tomorrow', status: 'PENDING', amount: '+$450.00', time: 'PENDING' },
    ]

    return (
        <div className="flex flex-col gap-4 w-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4">
                <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-full bg-[#1e293b] border-2 border-[#137fec] flex items-center justify-center overflow-hidden">
                        <span className="material-icons-round text-[#94a3b8] text-[20px]">person</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[12px] font-medium"
                            style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}>
                            Welcome back,
                        </span>
                        <span className="text-[14px] font-bold text-white"
                            style={{ fontFamily: "'Manrope', sans-serif" }}>
                            {displayName}
                        </span>
                    </div>
                </div>
                <button onClick={openSupport} className="w-10 h-10 bg-[#1e293b] rounded-full flex items-center justify-center">
                    <span className="material-icons-round text-[#137fec] text-[20px]">notifications</span>
                </button>
            </div>

            <div className="flex flex-col gap-6 px-6 pb-4">
                {/* Earnings Summary Card */}
                <div
                    className="rounded-[16px] p-5 relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #137fec 0%, #0d5bab 100%)',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-medium text-white/70 uppercase tracking-[0.5px]"
                            style={{ fontFamily: "'Manrope', sans-serif" }}>
                            Total Earned
                        </span>
                        <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                            <span className="material-icons-round text-[14px] text-white">trending_up</span>
                            <span className="text-[11px] font-bold text-white">+12%</span>
                        </div>
                    </div>
                    <div className="text-[32px] font-extrabold text-white mb-4"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        $12,840.50
                    </div>
                    <div className="flex gap-8">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-white/60"
                                style={{ fontFamily: "'Manrope', sans-serif" }}>
                                Pending Payout
                            </span>
                            <div className="mt-0.5">
                                <span className="text-[16px] font-bold text-white"
                                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                    $1,420.00
                                </span>
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-white/60"
                                style={{ fontFamily: "'Manrope', sans-serif" }}>
                                Active Ads
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[16px] font-bold text-white"
                                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                    8
                                </span>
                                <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions - 2x2 Grid */}
                <div className="flex flex-col gap-3">
                    <span className="text-[14px] font-bold uppercase tracking-[0.7px]"
                        style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}>
                        Quick Actions
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                        {quickActions.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={action.onClick}
                                className="bg-[#1e293b] rounded-[16px] p-5 flex flex-col items-start text-left transition-all duration-200 active:scale-[0.97]"
                            >
                                <div
                                    className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                                    style={{ background: action.iconBg }}
                                >
                                    <span className="material-icons-round text-[24px]" style={{ color: action.iconColor }}>
                                        {action.icon}
                                    </span>
                                </div>
                                <span className="text-[14px] font-bold text-white mb-1"
                                    style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    {action.label}
                                </span>
                                <span className="text-[12px] leading-[16px]"
                                    style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}>
                                    {action.desc}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Ongoing Placements */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[14px] font-bold uppercase tracking-[0.7px]"
                            style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}>
                            Ongoing Placements
                        </span>
                        <span className="text-[12px] font-medium cursor-pointer"
                            style={{ color: '#137fec', fontFamily: "'Manrope', sans-serif" }}>
                            View All
                        </span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {placements.map((placement, idx) => (
                            <div
                                key={idx}
                                className="bg-[#1e293b] rounded-[16px] px-5 py-4 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[rgba(19,127,236,0.15)] flex items-center justify-center">
                                        <span className="material-icons-round text-[18px] text-[#137fec]">article</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[14px] font-bold text-white"
                                            style={{ fontFamily: "'Manrope', sans-serif" }}>
                                            {placement.name}
                                        </span>
                                        <span className="text-[12px]"
                                            style={{ color: '#64748b', fontFamily: "'Manrope', sans-serif" }}>
                                            {placement.impressions} • {placement.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[14px] font-bold"
                                        style={{ color: '#22c55e', fontFamily: "'Manrope', sans-serif" }}>
                                        {placement.amount}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-[0.3px]"
                                        style={{ color: '#64748b', fontFamily: "'Manrope', sans-serif" }}>
                                        {placement.time}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
