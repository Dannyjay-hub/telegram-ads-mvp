/**
 * AdvertiserDashboard - Figma Design (node 1:134)
 * Dark theme advertiser home with budget summary, nav options, and quick stats
 */

import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/providers/TelegramProvider'
import { haptic } from '@/utils/haptic'
import { getBotDeepLinkUrl } from '@/lib/telegram'

export function AdvertiserDashboard() {
    const navigate = useNavigate()
    const { user } = useTelegram()

    const displayName = user?.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : 'Advertiser'

    const openSupport = () => {
        haptic.light();
        const url = getBotDeepLinkUrl('support');
        if ((window as any).Telegram?.WebApp?.openTelegramLink) {
            (window as any).Telegram.WebApp.openTelegramLink(url);
        } else {
            window.open(url, '_blank');
        }
    }

    const navItems = [
        {
            icon: 'rocket_launch',
            iconColor: '#137fec',
            iconBg: 'rgba(19, 127, 236, 0.15)',
            label: 'Launch Campaign',
            desc: 'Start a new advertising push now',
            onClick: () => { haptic.light(); navigate('/create'); },
            highlight: true,
        },
        {
            icon: 'bar_chart',
            iconColor: '#94a3b8',
            iconBg: 'rgba(148, 163, 184, 0.1)',
            label: 'View Campaigns',
            desc: 'Analyze performance and stats',
            onClick: () => { haptic.light(); navigate('/campaigns'); },
        },
        {
            icon: 'storefront',
            iconColor: '#94a3b8',
            iconBg: 'rgba(148, 163, 184, 0.1)',
            label: 'Channel Marketplace',
            desc: 'Find the best channels for your ads',
            onClick: () => { haptic.light(); navigate('/marketplace?tab=channels', { state: { from: '/advertiser' } }); },
        },
        {
            icon: 'handshake',
            iconColor: '#94a3b8',
            iconBg: 'rgba(148, 163, 184, 0.1)',
            label: 'Active Partnerships',
            desc: 'Manage ongoing collaborations',
            onClick: () => { haptic.light(); navigate('/partnerships'); },
        },
    ]

    const quickStats = [
        { icon: 'trending_up', iconColor: '#137fec', label: 'CPM AVG', value: '$2.45' },
        { icon: 'ads_click', iconColor: '#22c55e', label: 'CTR AVG', value: '4.82%' },
        { icon: 'monitoring', iconColor: '#f97316', label: 'REVENUE', value: '2.4x' },
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
                        <span className="text-[12px] font-medium uppercase tracking-[0.6px]"
                            style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}>
                            Advertiser
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
                {/* Budget Summary Card */}
                <div
                    className="rounded-[16px] p-5 relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #137fec 0%, #0d5bab 100%)',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-medium text-white/70"
                            style={{ fontFamily: "'Manrope', sans-serif" }}>
                            Total Ad Budget
                        </span>
                        <button className="bg-white/20 rounded-full px-3 py-1 text-[11px] font-bold text-white uppercase tracking-[0.5px]"
                            style={{ fontFamily: "'Manrope', sans-serif" }}>
                            Top Up
                        </button>
                    </div>
                    <div className="text-[32px] font-extrabold text-white mb-4"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        $12,450.80
                    </div>
                    <div className="flex gap-8">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-white/60"
                                style={{ fontFamily: "'Manrope', sans-serif" }}>
                                Active Reach
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[16px] font-bold text-white"
                                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                    1.2M
                                </span>
                                <span className="text-[11px] font-medium text-[#22c55e]">▲ 12%</span>
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-white/60"
                                style={{ fontFamily: "'Manrope', sans-serif" }}>
                                Campaigns
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[16px] font-bold text-white"
                                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                    14
                                </span>
                                <span className="text-[11px] font-medium text-white/60">running</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Items */}
                <div className="flex flex-col gap-3">
                    {navItems.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={item.onClick}
                            className={`w-full rounded-[16px] p-4 flex items-center gap-4 transition-all duration-200 active:scale-[0.98] ${item.highlight
                                ? 'bg-[rgba(19,127,236,0.08)] border border-[rgba(19,127,236,0.15)]'
                                : 'bg-[#1e293b]'
                                }`}
                        >
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ background: item.iconBg }}
                            >
                                <span className="material-icons-round text-[24px]" style={{ color: item.iconColor }}>
                                    {item.icon}
                                </span>
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-[16px] font-bold text-white"
                                    style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    {item.label}
                                </div>
                                <div className="text-[12px] mt-0.5"
                                    style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}>
                                    {item.desc}
                                </div>
                            </div>
                            <span className="material-icons-round text-[20px] text-[#64748b]">chevron_right</span>
                        </button>
                    ))}
                </div>

                {/* Quick Stats Preview */}
                <div className="flex flex-col gap-3">
                    <span className="text-[14px] font-bold uppercase tracking-[0.7px]"
                        style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}>
                        Quick Stats Preview
                    </span>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                        {quickStats.map((stat, idx) => (
                            <div
                                key={idx}
                                className="min-w-[120px] rounded-[13px] p-4"
                                style={{
                                    background: 'rgba(30, 41, 59, 0.6)',
                                    border: '1px solid rgba(30, 41, 59, 0.8)',
                                }}
                            >
                                <span className="material-icons-round text-[16px] mb-2 block" style={{ color: stat.iconColor }}>
                                    {stat.icon}
                                </span>
                                <div className="text-[10px] font-bold uppercase tracking-[0.5px] mb-1"
                                    style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}>
                                    {stat.label}
                                </div>
                                <div className="text-[18px] font-extrabold text-white"
                                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                    {stat.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
