/**
 * Dashboard - Marketplace Entry Hub
 * Redesigned from Figma (node 1:3)
 * Dark theme with blue accents, glassmorphism, Material Icons
 */

import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/providers/TelegramProvider'
import { haptic } from '@/utils/haptic'

export function Dashboard() {
    const { user } = useTelegram()
    const navigate = useNavigate()

    const displayName = user?.username
        ? `@${user.username}`
        : user?.firstName || 'Creator'

    return (
        <div className="flex flex-col gap-4 w-full">
            {/* Top Navigation / Header */}
            <div
                className="flex items-center justify-between px-6 py-4"
                style={{
                    background: 'rgba(16, 25, 34, 0.8)',
                    backdropFilter: 'blur(10px)',
                }}
            >
                <div className="flex gap-3 items-center">
                    {/* Profile Avatar */}
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full border-2 border-[#137fec] bg-[#1e293b] flex items-center justify-center overflow-hidden">
                            <span className="material-icons-round text-[#94a3b8] text-[20px]">person</span>
                        </div>
                        {/* Online indicator */}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#22c55e] border-2 border-[#101922] rounded-full" />
                    </div>
                    {/* User Info */}
                    <div className="flex flex-col">
                        <span
                            className="text-[12px] font-medium tracking-[0.6px] uppercase"
                            style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}
                        >
                            Welcome back
                        </span>
                        <span
                            className="text-[14px] font-bold text-white"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                            {displayName}
                        </span>
                    </div>
                </div>
                {/* Notification Bell */}
                <div className="w-10 h-10 bg-[#1e293b] rounded-full flex items-center justify-center">
                    <span className="material-icons-round text-[#cbd5e1] text-[20px]">notifications</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-col gap-8 px-6 pb-24">
                {/* Hero Section */}
                <div className="flex flex-col gap-1">
                    <h1
                        className="text-[24px] font-extrabold text-white leading-[30px]"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                        Ad Marketplace
                    </h1>
                    <p
                        className="text-[14px] leading-[20px]"
                        style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}
                    >
                        Choose your path to start deals.
                    </p>
                </div>

                {/* Quick Stats Dashboard */}
                <div className="flex gap-3 w-full">
                    {/* Active Campaigns */}
                    <div
                        className="flex-1 relative rounded-[13px] p-4 min-h-[110px]"
                        style={{
                            background: 'rgba(19, 127, 236, 0.1)',
                            border: '1px solid rgba(19, 127, 236, 0.2)',
                        }}
                    >
                        <div className="flex gap-2 items-center mb-2">
                            <span className="material-icons-round text-[#137fec] text-[14px]">campaign</span>
                            <span
                                className="text-[10px] font-bold uppercase tracking-[-0.25px]"
                                style={{ color: '#137fec', fontFamily: "'Manrope', sans-serif" }}
                            >
                                Active
                            </span>
                        </div>
                        <div
                            className="text-[20px] font-extrabold mb-1"
                            style={{ color: '#137fec', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                            3
                        </div>
                        <div
                            className="text-[11px]"
                            style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}
                        >
                            Campaigns live
                        </div>
                    </div>
                    {/* Pending Bids */}
                    <div
                        className="flex-1 relative rounded-[13px] p-4 min-h-[110px]"
                        style={{
                            background: 'rgba(249, 115, 22, 0.1)',
                            border: '1px solid rgba(249, 115, 22, 0.2)',
                        }}
                    >
                        <div className="flex gap-2 items-center mb-2">
                            <span className="material-icons-round text-[#f97316] text-[14px]">pending_actions</span>
                            <span
                                className="text-[10px] font-bold uppercase tracking-[-0.25px]"
                                style={{ color: '#f97316', fontFamily: "'Manrope', sans-serif" }}
                            >
                                Pending
                            </span>
                        </div>
                        <div
                            className="text-[20px] font-extrabold mb-1"
                            style={{ color: '#f97316', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                            1
                        </div>
                        <div
                            className="text-[11px]"
                            style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}
                        >
                            Bid awaiting reply
                        </div>
                    </div>
                </div>

                {/* Main Entry Cards */}
                <div className="flex flex-col gap-4 w-full">
                    {/* Advertiser Card */}
                    <button
                        onClick={() => { haptic.light(); navigate('/advertiser'); }}
                        className="w-full bg-[#137fec] rounded-[16px] p-6 relative overflow-hidden text-left transition-all duration-200 active:scale-[0.98]"
                    >
                        {/* Decorative elements */}
                        <div className="absolute top-6 right-6">
                            <span className="material-icons-round text-[36px]" style={{ color: 'rgba(255,255,255,0.3)' }}>trending_up</span>
                        </div>
                        <div
                            className="absolute -bottom-4 -right-4 w-32 h-32 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.1)', filter: 'blur(20px)' }}
                        />
                        {/* Icon */}
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.2)' }}>
                            <span className="material-icons-round text-white text-[30px]">megaphone</span>
                        </div>
                        {/* Text */}
                        <h3
                            className="text-[20px] font-bold text-white mb-2"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                            I am an Advertiser
                        </h3>
                        <p
                            className="text-[14px] leading-[20px] max-w-[200px]"
                            style={{ color: 'rgba(255,255,255,0.8)', fontFamily: "'Manrope', sans-serif" }}
                        >
                            Find channels, launch campaigns and grow your reach.
                        </p>
                    </button>

                    {/* Channel Owner Card */}
                    <button
                        onClick={() => { haptic.light(); navigate('/channel-owner'); }}
                        className="w-full bg-[#1e293b] rounded-[16px] p-6 relative overflow-hidden text-left transition-all duration-200 active:scale-[0.98]"
                    >
                        {/* Decorative elements */}
                        <div className="absolute top-6 right-6">
                            <span className="material-icons-round text-[36px] text-[#334155]">payments</span>
                        </div>
                        <div
                            className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full"
                            style={{ background: 'rgba(19,127,236,0.05)', filter: 'blur(32px)' }}
                        />
                        {/* Icon */}
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(19,127,236,0.2)' }}>
                            <span className="material-icons-round text-[#137fec] text-[30px]">podcasts</span>
                        </div>
                        {/* Text */}
                        <h3
                            className="text-[20px] font-bold text-white mb-2"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                            I am a Channel Owner
                        </h3>
                        <p
                            className="text-[14px] leading-[20px] max-w-[200px]"
                            style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}
                        >
                            Monetize your audience and list your channel.
                        </p>
                    </button>
                </div>

                {/* How It Works Section */}
                <div className="flex flex-col gap-4 py-4">
                    {/* Section Header */}
                    <div className="flex items-center justify-between">
                        <span
                            className="text-[14px] font-bold uppercase tracking-[0.7px]"
                            style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}
                        >
                            Secure Deal Flow
                        </span>
                        <span
                            className="text-[12px] font-medium cursor-pointer"
                            style={{ color: '#137fec', fontFamily: "'Manrope', sans-serif" }}
                        >
                            Learn more
                        </span>
                    </div>
                    {/* Steps */}
                    <div className="flex flex-col gap-6">
                        {/* Step 1 */}
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-[#1e293b] flex items-center justify-center flex-shrink-0">
                                <span className="text-[12px] font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>1</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[14px] font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    Discovery &amp; Offer
                                </span>
                                <span className="text-[12px] leading-[19.5px]" style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}>
                                    Browse channels or create campaign requests. Send offers directly via the bot.
                                </span>
                            </div>
                        </div>
                        {/* Step 2 */}
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-[#1e293b] flex items-center justify-center flex-shrink-0">
                                <span className="text-[12px] font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>2</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[14px] font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    Escrow Deposit
                                </span>
                                <span className="text-[12px] leading-[19.5px]" style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}>
                                    Funds are securely held in escrow once an offer is accepted. Zero risk for both parties.
                                </span>
                            </div>
                        </div>
                        {/* Step 3 */}
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-[#1e293b] flex items-center justify-center flex-shrink-0">
                                <span className="text-[12px] font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>3</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[14px] font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    Execution &amp; Release
                                </span>
                                <span className="text-[12px] leading-[19.5px]" style={{ color: '#94a3b8', fontFamily: "'Manrope', sans-serif" }}>
                                    Post verification is automatic. Funds are released to the owner after the ad duration.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Referral Banner */}
                <div
                    className="flex items-center justify-between p-5 rounded-[16px] w-full"
                    style={{ backgroundImage: 'linear-gradient(167deg, #6366f1 0%, #9333ea 100%)' }}
                >
                    <div className="flex flex-col gap-0.5">
                        <span
                            className="text-[10px] font-bold uppercase text-white opacity-80"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                            Referral Program
                        </span>
                        <span
                            className="text-[14px] font-bold text-white"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                            Invite friends, earn 5%
                        </span>
                    </div>
                    <button className="bg-white rounded-full px-4 py-2">
                        <span
                            className="text-[12px] font-bold text-center"
                            style={{ color: '#4f46e5', fontFamily: "'Manrope', sans-serif" }}
                        >
                            Share Link
                        </span>
                    </button>
                </div>
            </div>
        </div>
    )
}
