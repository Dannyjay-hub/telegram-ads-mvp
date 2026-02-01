import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/card'
import { Settings, RefreshCw, Check, Users, Eye, TrendingUp, ExternalLink, Globe, Plus, Minus, ShoppingCart, Wallet } from 'lucide-react'
import { type Channel, API_URL, getHeaders } from '@/lib/api'
import { useTelegram } from '@/providers/TelegramProvider'
import { useTonWallet } from '@/hooks/useTonWallet'
import { haptic } from '@/utils/haptic'
import { TON_TOKEN, USDT_TOKEN, type JettonToken } from '@/lib/jettons'

// Type for selected package quantities
interface SelectedPackage {
    packageIndex: number;
    title: string;
    type: string;
    price: number;
    quantity: number;
    currency: 'TON' | 'USDT';
}

export function ChannelViewPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { id } = useParams()
    const { user } = useTelegram()
    const { isConnected, walletAddress, connectWallet, formatAddress, sendPayment } = useTonWallet()

    const [channel, setChannel] = useState<Channel | null>(null)
    const [loading, setLoading] = useState(true)
    const [isOwner, setIsOwner] = useState(false)

    // Advertiser buy flow state
    const [selectedPackages, setSelectedPackages] = useState<SelectedPackage[]>([])
    const [showCheckout, setShowCheckout] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [paymentStep, setPaymentStep] = useState<'confirm' | 'paying' | 'success' | 'error'>('confirm')
    const [paymentError, setPaymentError] = useState<string | null>(null)

    // Derive currency from first selected package (all packages must be same currency)
    const selectedCurrency = useMemo((): 'TON' | 'USDT' => {
        if (selectedPackages.length === 0) return 'TON'
        return selectedPackages[0].currency || 'TON'
    }, [selectedPackages])

    const paymentToken = useMemo((): JettonToken => {
        return selectedCurrency === 'USDT' ? USDT_TOKEN : TON_TOKEN
    }, [selectedCurrency])

    // Track where user came from for context-aware back navigation
    // If user came from a deep link (no location.state), always go to dashboard
    const origin = (location.state as any)?.from || null

    useEffect(() => {
        if (id) loadChannel()
    }, [id])

    const loadChannel = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_URL}/channels/${id}`, { headers: getHeaders() })
            if (!res.ok) throw new Error('Channel not found')
            const data = await res.json()
            setChannel(data)

            // Check if current user is an owner or PR manager of this channel
            if (user?.telegramId) {
                try {
                    const adminRes = await fetch(`${API_URL}/channels/${id}/admins`, { headers: getHeaders() })
                    if (adminRes.ok) {
                        const adminData = await adminRes.json()
                        // Check if user is the owner
                        const userIsOwner = adminData.owner?.telegram_id === user.telegramId
                        // Check if user is a PR manager
                        const userIsPRManager = (adminData.pr_managers || []).some(
                            (pm: any) => pm.telegram_id === user.telegramId
                        )
                        // Owner OR PR Manager can access settings
                        setIsOwner(userIsOwner || userIsPRManager)
                    }
                } catch {
                    setIsOwner(false)
                }
            } else {
                setIsOwner(false)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleSync = async () => {
        try {
            await fetch(`${API_URL}/channels/${id}/sync_stats`, {
                method: 'POST',
                headers: getHeaders()
            })
            await loadChannel()
        } catch (e) {
            console.error(e)
        }
    }

    // Get quantity for a specific package
    const getPackageQuantity = (idx: number): number => {
        const found = selectedPackages.find(p => p.packageIndex === idx)
        return found?.quantity || 0
    }

    // Update package quantity
    const updatePackageQuantity = (pkg: any, idx: number, delta: number) => {
        haptic.light()
        const currentQty = getPackageQuantity(idx)
        const newQty = Math.max(0, currentQty + delta)

        if (newQty === 0) {
            // Remove from selection
            setSelectedPackages(prev => prev.filter(p => p.packageIndex !== idx))
        } else {
            const existing = selectedPackages.find(p => p.packageIndex === idx)
            if (existing) {
                // Update quantity
                setSelectedPackages(prev => prev.map(p =>
                    p.packageIndex === idx ? { ...p, quantity: newQty } : p
                ))
            } else {
                // Add new selection
                setSelectedPackages(prev => [...prev, {
                    packageIndex: idx,
                    title: pkg.title,
                    type: pkg.type,
                    price: pkg.price,
                    quantity: newQty,
                    currency: pkg.currency || 'TON'
                }])
            }
        }
    }

    // Calculate total
    const totalAmount = useMemo(() => {
        return selectedPackages.reduce((sum, pkg) => sum + (pkg.price * pkg.quantity), 0)
    }, [selectedPackages])

    const totalItems = useMemo(() => {
        return selectedPackages.reduce((sum, pkg) => sum + pkg.quantity, 0)
    }, [selectedPackages])

    // Handle checkout
    const handleRequestPartnership = async () => {
        haptic.medium()
        if (!isConnected) {
            await connectWallet()
            return
        }
        setPaymentStep('confirm')
        setPaymentError(null)
        setShowCheckout(true)
    }

    // Process payment: Create deal via API then send TON transaction
    const processPayment = async () => {
        if (!walletAddress || !id) return

        setIsProcessing(true)
        setPaymentStep('paying')

        try {
            // Step 1: Create deal via API and get payment instructions
            const contentItems = selectedPackages.map(pkg => ({
                type: pkg.type,
                title: pkg.title,
                quantity: pkg.quantity,
                unitPrice: pkg.price
            }))

            const res = await fetch(`${API_URL}/deals/create-with-items`, {
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    channelId: id,
                    contentItems,
                    walletAddress
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to create deal')
            }

            const deal = await res.json()
            const { paymentInstructions } = deal

            // Step 2: Send transaction using the package's currency
            // For TON: use the amount directly (prices are in TON)
            // For USDT: use the amount directly (prices are in USDT)
            const paymentAmount = paymentInstructions.amount

            await sendPayment(
                paymentToken,
                paymentInstructions.address,
                paymentAmount,
                paymentInstructions.memo
            )

            haptic.success()
            setPaymentStep('success')

            // Auto-navigate after success
            setTimeout(() => {
                setShowCheckout(false)
                navigate('/partnerships')
            }, 2000)

        } catch (error: any) {
            console.error('Payment error:', error)

            // Parse TON Connect specific errors
            let errorMessage = 'Payment failed'
            const errMsg = error.message?.toLowerCase() || ''

            if (errMsg.includes('not authenticated') || errMsg.includes('auth')) {
                errorMessage = 'Wallet session expired. Please disconnect and reconnect your wallet.'
            } else if (errMsg.includes('rejected') || errMsg.includes('cancelled') || errMsg.includes('canceled')) {
                errorMessage = 'Transaction cancelled'
            } else if (errMsg.includes('insufficient') || errMsg.includes('balance')) {
                errorMessage = 'Insufficient balance in your wallet'
            } else if (error.message) {
                errorMessage = error.message
            }

            setPaymentError(errorMessage)
            setPaymentStep('error')
            haptic.error()
        } finally {
            setIsProcessing(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (!channel) {
        return (
            <div className="p-4 text-center">
                <p className="text-muted-foreground">Channel not found</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
                    Go Back
                </Button>
            </div>
        )
    }

    const subscribers = channel.verifiedStats?.subscribers || 0
    const avgViews = channel.avgViews || 0
    const engagement = subscribers > 0 ? ((avgViews / subscribers) * 100).toFixed(1) : '0'

    return (
        <div className="pb-20 max-w-lg mx-auto p-4">
            {/* Header - back navigation handled by Telegram native BackButton */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold">Channel Details</h1>
                {isOwner && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/channels/${id}/settings`, {
                            state: {
                                from: `/channels/${id}/view`,
                                viewOrigin: origin // Pass through so Settings knows where View came from
                            }
                        })}
                    >
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                    </Button>
                )}
            </div>

            {/* Channel Header Card */}
            <GlassCard className="p-6 text-center mb-6">
                {channel.photoUrl ? (
                    <img
                        src={channel.photoUrl}
                        alt={channel.title}
                        className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
                    />
                ) : (
                    <div className="w-20 h-20 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                        {channel.title?.charAt(0).toUpperCase() || 'C'}
                    </div>
                )}
                <div className="flex items-center justify-center gap-2 mb-1">
                    <h2 className="text-xl font-bold">{channel.title}</h2>
                    {channel.isActive && (
                        <span className="bg-green-500/20 text-green-500 text-xs px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3 inline mr-1" />
                            Verified
                        </span>
                    )}
                </div>
                <button
                    onClick={() => {
                        const url = `https://t.me/${channel.username}`;
                        if ((window as any).Telegram?.WebApp?.openTelegramLink) {
                            (window as any).Telegram.WebApp.openTelegramLink(url);
                        } else {
                            window.open(url, '_blank');
                        }
                    }}
                    className="text-primary hover:text-primary/80 inline-flex items-center gap-1 transition-colors"
                >
                    @{channel.username}
                    <ExternalLink className="w-3 h-3" />
                </button>

                {channel.description && (
                    <p className="text-sm text-muted-foreground mt-4 border-t border-white/10 pt-4">
                        {channel.description}
                    </p>
                )}
            </GlassCard>

            {/* Stats Grid */}
            <GlassCard className="p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Analytics</h3>
                    {isOwner && (
                        <Button variant="ghost" size="sm" onClick={handleSync} className="text-xs text-primary">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Sync
                        </Button>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <Users className="w-5 h-5 mx-auto mb-1 text-primary/60" />
                        <p className="text-xl font-bold">{subscribers.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Subscribers</p>
                    </div>
                    <div>
                        <Eye className="w-5 h-5 mx-auto mb-1 text-primary/60" />
                        <p className="text-xl font-bold">{avgViews.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Avg Views</p>
                    </div>
                    <div>
                        <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary/60" />
                        <p className="text-xl font-bold">{engagement}%</p>
                        <p className="text-xs text-muted-foreground">Engagement</p>
                    </div>
                </div>
            </GlassCard>

            {/* Service Packages - with quantity controls for advertisers */}
            <GlassCard className="p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                        {isOwner ? 'Your Packages' : 'Select Packages'}
                    </h3>
                    {!isOwner && totalItems > 0 && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                            {totalItems} selected
                        </span>
                    )}
                </div>
                <div className="space-y-3">
                    {channel.rateCard && channel.rateCard.length > 0 ? (
                        channel.rateCard.map((pkg: any, idx: number) => {
                            const qty = getPackageQuantity(idx)
                            return (
                                <div key={idx} className={`bg-white/5 p-4 rounded-xl border transition-all ${qty > 0 ? 'border-primary/50 bg-primary/5' : 'border-white/5'}`}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{pkg.title}</span>
                                                <span className="text-[10px] uppercase bg-primary/20 text-primary px-1.5 py-0.5 rounded tracking-wider">
                                                    {pkg.type}
                                                </span>
                                            </div>
                                            {pkg.description && (
                                                <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
                                            )}
                                        </div>
                                        <span className="font-bold text-lg text-primary ml-2">
                                            {pkg.price} {pkg.currency === 'USDT' ? '💵' : '💎'}
                                        </span>
                                    </div>

                                    {/* Quantity controls for advertisers */}
                                    {!isOwner && (
                                        <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-white/10">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 rounded-full"
                                                onClick={() => updatePackageQuantity(pkg, idx, -1)}
                                                disabled={qty === 0}
                                            >
                                                <Minus className="w-4 h-4" />
                                            </Button>
                                            <span className={`text-lg font-bold w-8 text-center ${qty > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                                                {qty}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 rounded-full"
                                                onClick={() => updatePackageQuantity(pkg, idx, 1)}
                                            >
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    ) : (
                        <div className="bg-white/5 p-4 rounded-xl flex justify-between items-center border border-white/5">
                            <div>
                                <span className="font-bold">Standard Post</span>
                                <p className="text-xs text-muted-foreground">Starting price</p>
                            </div>
                            <span className="font-bold text-lg text-primary">${channel.basePriceAmount || 100}</span>
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Category & Language */}
            {(channel.category || (channel as any).language) && (
                <GlassCard className="p-4 mb-6">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
                        Details
                    </h3>
                    {channel.category && (
                        <div className="mb-3">
                            <span className="text-xs text-muted-foreground">Category: </span>
                            <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded">{channel.category}</span>
                        </div>
                    )}
                    {(channel as any).language && (
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Language: </span>
                            <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded">{(channel as any).language}</span>
                        </div>
                    )}
                </GlassCard>
            )}

            {/* Floating Checkout Bar for advertisers */}
            {!isOwner && totalItems > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-white/10 p-4 z-50">
                    <div className="max-w-md mx-auto flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">{totalItems} item{totalItems > 1 ? 's' : ''} selected</p>
                            <p className="text-xl font-bold text-primary">${totalAmount.toLocaleString()}</p>
                        </div>
                        <Button
                            size="lg"
                            className="gap-2"
                            onClick={handleRequestPartnership}
                        >
                            <ShoppingCart className="w-4 h-4" />
                            {isConnected ? 'Request Deal' : 'Connect Wallet'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Checkout Modal */}
            {showCheckout && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center">
                    <div className="bg-background w-full max-w-md rounded-t-3xl p-6 space-y-4 animate-in slide-in-from-bottom">
                        {paymentStep === 'confirm' && (
                            <>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold">Confirm Partnership</h3>
                                    <Button variant="ghost" size="sm" onClick={() => setShowCheckout(false)}>×</Button>
                                </div>

                                <div className="space-y-2">
                                    {selectedPackages.map((pkg, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span>{pkg.quantity}x {pkg.title}</span>
                                            <span className="text-primary">{pkg.price * pkg.quantity} {pkg.currency}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                                    <span className="font-semibold">Total</span>
                                    <span className="text-2xl font-bold text-primary">
                                        {totalAmount.toLocaleString()} {selectedCurrency === 'USDT' ? '💵 USDT' : '💎 TON'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 p-3 rounded-lg">
                                    <Wallet className="w-4 h-4" />
                                    <span>Connected: {formatAddress(walletAddress)}</span>
                                </div>

                                <Button
                                    className="w-full h-12 text-lg"
                                    onClick={processPayment}
                                    disabled={isProcessing}
                                >
                                    Pay {totalAmount.toLocaleString()} {selectedCurrency}
                                </Button>

                                <p className="text-xs text-center text-muted-foreground">
                                    Funds will be held in escrow until the deal is completed
                                </p>
                            </>
                        )}

                        {paymentStep === 'paying' && (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                                <h3 className="text-lg font-semibold">Processing Payment</h3>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Please confirm the transaction in your wallet...
                                </p>
                            </div>
                        )}

                        {paymentStep === 'success' && (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-8 h-8 text-green-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-green-500">Payment Sent!</h3>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Your deal request has been submitted. The channel owner will review it shortly.
                                </p>
                            </div>
                        )}

                        {paymentStep === 'error' && (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                                    <span className="text-2xl">❌</span>
                                </div>
                                <h3 className="text-lg font-semibold text-red-500">Payment Failed</h3>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {paymentError || 'Something went wrong. Please try again.'}
                                </p>
                                <Button
                                    className="mt-4"
                                    variant="outline"
                                    onClick={() => setPaymentStep('confirm')}
                                >
                                    Try Again
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
