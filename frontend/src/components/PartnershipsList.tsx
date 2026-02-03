
import { useState, useEffect } from 'react'
import { GlassCard, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Handshake, Copy, Check, MessageCircle, Clock, DollarSign, AlertCircle } from 'lucide-react'
import { API_URL, getHeaders } from '@/lib/api'
import { haptic } from '@/utils/haptic'

// Deal with channel data
interface DealWithChannel {
    id: string
    status: string
    priceAmount: number
    priceCurrency: string
    paymentMemo?: string
    briefText?: string
    createdAt: string
    channel?: {
        id: string
        title: string
        username?: string
        photoUrl?: string
    }
}

// Status badge config
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    draft: { label: 'Draft', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
    pending: { label: 'Awaiting Payment', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    funded: { label: 'Payment Received', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    approved: { label: 'Approved', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    rejected: { label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    in_progress: { label: 'In Progress', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    posted: { label: 'Posted', color: 'text-teal-400', bgColor: 'bg-teal-500/20' },
    monitoring: { label: 'Monitoring', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    released: { label: 'Completed', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    cancelled: { label: 'Cancelled', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    refunded: { label: 'Refunded', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    pending_refund: { label: 'Refund Pending', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    disputed: { label: 'Disputed', color: 'text-orange-400', bgColor: 'bg-orange-500/20' }
}

function StatusBadge({ status }: { status: string }) {
    const config = statusConfig[status] || statusConfig.draft
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}>
            {config.label}
        </span>
    )
}

function CopyMemo({ memo }: { memo: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation()
        await navigator.clipboard.writeText(memo)
        haptic.light()
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
            <span className="font-mono">{memo}</span>
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
    )
}

export function PartnershipsList() {
    const [deals, setDeals] = useState<DealWithChannel[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active')

    useEffect(() => {
        loadDeals()
    }, [])

    const loadDeals = async () => {
        try {
            const response = await fetch(`${API_URL}/deals/my`, {
                headers: getHeaders()
            })
            if (response.ok) {
                const data = await response.json()
                setDeals(data)
            }
        } catch (error) {
            console.error('Failed to load deals:', error)
        } finally {
            setLoading(false)
        }
    }

    const openBot = () => {
        haptic.light()
        const url = 'https://t.me/DanielAdsMVP_bot'
        if ((window as any).Telegram?.WebApp?.openTelegramLink) {
            (window as any).Telegram.WebApp.openTelegramLink(url)
        } else {
            window.open(url, '_blank')
        }
    }

    // Filter out drafts entirely - they're unpaid and shouldn't appear anywhere
    const visibleDeals = deals.filter(d => d.status !== 'draft')

    // Active: requires attention or in progress
    const activeStatuses = ['pending', 'funded', 'approved', 'in_progress', 'disputed', 'monitoring']
    const activeDeals = visibleDeals.filter(d => activeStatuses.includes(d.status))
    const inactiveDeals = visibleDeals.filter(d => !activeStatuses.includes(d.status))

    const displayDeals = activeTab === 'active' ? activeDeals : inactiveDeals

    if (loading) {
        return (
            <div className="space-y-4">
                <GlassCard className="animate-pulse h-24" />
                <GlassCard className="animate-pulse h-24" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-2">
                <Button
                    variant={activeTab === 'active' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => { haptic.light(); setActiveTab('active') }}
                    className="flex-1"
                >
                    Active ({activeDeals.length})
                </Button>
                <Button
                    variant={activeTab === 'inactive' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => { haptic.light(); setActiveTab('inactive') }}
                    className="flex-1"
                >
                    Completed ({inactiveDeals.length})
                </Button>
            </div>

            {displayDeals.length === 0 ? (
                <GlassCard>
                    <CardContent className="text-center py-10">
                        <Handshake className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                        <p className="text-muted-foreground">
                            {activeTab === 'active'
                                ? 'No active partnerships yet'
                                : 'No completed partnerships yet'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            Start by browsing channels in the Marketplace
                        </p>
                    </CardContent>
                </GlassCard>
            ) : (
                <div className="space-y-3">
                    {displayDeals.map(deal => (
                        <GlassCard key={deal.id} className="p-4">
                            <div className="flex items-start gap-3">
                                {/* Channel Avatar */}
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                                    {deal.channel?.photoUrl ? (
                                        <img src={deal.channel.photoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        deal.channel?.title?.charAt(0) || '?'
                                    )}
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-semibold truncate">
                                            {deal.channel?.title || 'Unknown Channel'}
                                        </h3>
                                        <StatusBadge status={deal.status} />
                                    </div>

                                    {deal.channel?.username && (
                                        <p className="text-xs text-muted-foreground">@{deal.channel.username}</p>
                                    )}

                                    {/* Price and Memo */}
                                    <div className="flex items-center gap-4 mt-2 text-sm">
                                        <span className="flex items-center gap-1 text-green-400">
                                            <DollarSign className="w-3 h-3" />
                                            {deal.priceAmount} {deal.priceCurrency}
                                        </span>

                                        {deal.paymentMemo && (
                                            <CopyMemo memo={deal.paymentMemo} />
                                        )}
                                    </div>

                                    {/* Status hint */}
                                    {deal.status === 'pending' && (
                                        <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Waiting for your payment
                                        </p>
                                    )}
                                    {deal.status === 'funded' && (
                                        <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Waiting for channel owner approval
                                        </p>
                                    )}
                                </div>

                                {/* Bot button */}
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={openBot}
                                    className="shrink-0"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                </Button>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    )
}
