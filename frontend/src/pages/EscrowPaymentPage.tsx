import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTonWallet } from '@/hooks/useTonWallet'
import { Info, Wallet, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { API_URL, getHeaders, apiFetch } from '@/api'
import { TON_TOKEN, USDT_TOKEN } from '@/lib/jettons'

// Temporary GlassCard component if not found
const GlassCard = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 ${className}`}>
        {children}
    </div>
)

interface Campaign {
    id: string
    title: string
    totalBudget: number
    currency: string
    escrowWalletAddress: string
    slots: number
    status: string
    campaignType?: 'open' | 'closed'
}

export function EscrowPaymentPage() {
    const navigate = useNavigate()
    const location = useLocation()

    const { isConnected, connectWallet, sendPayment } = useTonWallet()

    // Campaign and payment instructions passed from wizard
    const [campaign] = useState<Campaign | null>(location.state?.campaign || null)
    const [paymentInstructions] = useState<{ address: string; memo: string; amount: number; budgetAmount?: number; platformFee?: number; feeCurrency?: string; expiresAt?: string } | null>(
        location.state?.paymentInstructions || null
    )
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Countdown timer state
    const [timeLeft, setTimeLeft] = useState<number>(15 * 60) // 15 min default

    useEffect(() => {
        if (!campaign || !paymentInstructions) {
            setError("No campaign details found. Please create a new campaign.")
            return
        }

        // Check if already expired on load
        if (paymentInstructions.expiresAt) {
            const remaining = new Date(paymentInstructions.expiresAt).getTime() - Date.now()
            if (remaining <= 0) {
                setError("Payment window expired. Please create a new campaign.")
            }
        }
    }, [campaign, paymentInstructions])

    // Countdown timer effect
    useEffect(() => {
        if (!paymentInstructions?.expiresAt) return

        const updateTimer = () => {
            const remaining = Math.floor((new Date(paymentInstructions.expiresAt!).getTime() - Date.now()) / 1000)
            setTimeLeft(Math.max(0, remaining))
        }

        updateTimer() // Initial update
        const interval = setInterval(updateTimer, 1000)
        return () => clearInterval(interval)
    }, [paymentInstructions?.expiresAt])

    // Format time display
    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60
    const isLowTime = timeLeft < 300 && timeLeft > 0 // < 5 min
    const isExpired = timeLeft <= 0

    const handlePayment = async () => {
        if (!campaign || !paymentInstructions) return

        try {
            setLoading(true)
            setError(null)

            // Validate currency before payment
            const normalizedCurrency = campaign.currency?.toUpperCase()
            if (!normalizedCurrency || !['TON', 'USDT'].includes(normalizedCurrency)) {
                setError('Unsupported currency. Only TON and USDT are accepted.')
                setLoading(false)
                return
            }

            // Use correct token based on campaign currency
            const paymentToken = normalizedCurrency === 'USDT' ? USDT_TOKEN : TON_TOKEN

            await sendPayment(
                paymentToken,
                paymentInstructions.address,
                paymentInstructions.amount,
                paymentInstructions.memo
            )

            // Start verifying backend receipt
            startVerification()

        } catch (e: any) {
            console.error('Payment failed:', e)
            const errMsg = e.message?.toLowerCase() || ''

            if (errMsg.includes('rejected') || errMsg.includes('cancelled') || errMsg.includes('canceled')) {
                // User cancelled - show brief feedback then clear
                setError('Payment cancelled')
                setTimeout(() => setError(null), 2000)
                setLoading(false)
            } else if (errMsg.includes('not connected') || errMsg.includes('connect')) {
                // Only show wallet error if genuinely not connected
                if (!isConnected) {
                    setError('Please connect your wallet first')
                }
                setLoading(false)
            } else {
                setError(e.message || 'Payment failed. Please try again.')
                setLoading(false)
            }
        }
    }

    const startVerification = () => {
        setVerifying(true)
        setLoading(false)

        // Poll for campaign activation (webhook/polling will update status)
        let pollCount = 0
        const maxPolls = 60 // ~2 minutes with increasing intervals
        let currentInterval = 1000 // Start at 1s, gradually increase

        const poll = async () => {
            pollCount++

            try {
                if (!campaign?.id) return

                const res = await apiFetch(`${API_URL}/campaigns/${campaign.id}`, {
                    headers: getHeaders()
                })
                const data = await res.json()

                // Check if campaign was funded and activated
                const SUCCESS_STATUSES = ['active', 'funded', 'confirmed', 'filled']
                const isSuccess = SUCCESS_STATUSES.includes(data.status) || data.escrowDeposited > 0

                console.log(`[EscrowPayment] Poll ${pollCount}: status=${data.status}, escrowDeposited=${data.escrowDeposited}, isSuccess=${isSuccess}`)

                if (isSuccess) {
                    setVerifying(false)
                    navigate('/campaigns', {
                        replace: true,
                        state: { paymentSuccess: true, campaignId: campaign.id }
                    })
                    return
                }
            } catch (e) {
                console.error('Poll error:', e)
            }

            // Timeout - redirect gracefully (payment may still be processing on chain)
            if (pollCount >= maxPolls) {
                setVerifying(false)
                console.log('[EscrowPayment] Timeout - redirecting with pending state')
                navigate('/campaigns', {
                    replace: true,
                    state: { paymentPending: true, campaignId: campaign?.id }
                })
                return
            }

            // Gradually increase interval: 1s for first 15, 2s for next 15, 3s after that
            if (pollCount > 30) currentInterval = 3000
            else if (pollCount > 15) currentInterval = 2000

            setTimeout(poll, currentInterval)
        }

        // Start first poll after 1 second
        setTimeout(poll, 1000)
    }

    if (loading && !campaign) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        )
    }

    if (error || !campaign) {
        return (
            <div className="p-4 text-center">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Error</h2>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => navigate(-1)}>Go Back</Button>
            </div>
        )
    }

    // Show verifying state with spinner and message
    if (verifying) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                <div className="relative mb-6">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary" />
                    <CheckCircle2 className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h2 className="text-xl font-bold mb-2">Verifying Payment</h2>
                <p className="text-muted-foreground mb-4">
                    Confirming your transaction on the blockchain...
                </p>
                <p className="text-sm text-muted-foreground/70">
                    This usually takes 5-15 seconds
                </p>
            </div>
        )
    }

    return (
        <div className="pb-24 space-y-6">
            <h1 className="text-xl font-bold">Fund Campaign</h1>

            <GlassCard className="space-y-4">
                {/* Fee breakdown */}
                {paymentInstructions?.platformFee ? (
                    <>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Campaign Budget</span>
                            <span className="font-medium">{paymentInstructions.budgetAmount} {campaign.currency}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Network Fee</span>
                            <span className="font-medium">{paymentInstructions.platformFee} {campaign.currency}</span>
                        </div>
                        <div className="border-t border-border pt-2 flex items-center justify-between">
                            <span className="text-muted-foreground font-medium">Total</span>
                            <span className="text-xl font-bold text-primary">{paymentInstructions.amount} {campaign.currency}</span>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Budget</span>
                        <span className="text-xl font-bold text-primary">{campaign.totalBudget} {campaign.currency}</span>
                    </div>
                )}

                {/* Payment Window Countdown */}
                {paymentInstructions?.expiresAt && (
                    <div className={`p-3 rounded-lg flex items-center gap-3 ${isExpired ? 'bg-red-500/20 text-red-400' :
                        isLowTime ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                        }`}>
                        <Clock className="w-5 h-5" />
                        <div className="flex-1">
                            {isExpired ? (
                                <span className="font-medium">Session Expired</span>
                            ) : (
                                <>
                                    <span className="font-medium">
                                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                                    </span>
                                    <span className="text-sm ml-2 opacity-80">
                                        {isLowTime ? 'Hurry!' : 'remaining'}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="p-3 bg-muted/20 rounded-lg text-sm text-muted-foreground">
                    <Info className="w-4 h-4 inline mr-2 -mt-0.5" />
                    Funds are held securely in escrow and only released when channels complete their work.
                </div>
            </GlassCard>

            <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Payment Method</h3>

                <div className="p-4 border rounded-xl border-primary/20 bg-primary/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-medium">TON Wallet</div>
                            <div className="text-xs text-muted-foreground">Pay with Tonkeeper, etc.</div>
                        </div>
                    </div>
                    {/* Add visual selection indicator if needed */}
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
            </div>

            <div className="fixed bottom-6 left-4 right-4 z-20">
                {isExpired ? (
                    <Button
                        size="lg"
                        className="w-full text-lg font-bold bg-red-500/80 hover:bg-red-500"
                        onClick={() => navigate('/campaigns/create')}
                    >
                        Session Expired - Start Over
                    </Button>
                ) : !isConnected ? (
                    <Button
                        size="lg"
                        className="w-full text-lg font-bold shadow-lg shadow-primary/25"
                        onClick={connectWallet}
                    >
                        Connect Wallet to Pay
                    </Button>
                ) : (
                    <Button
                        size="lg"
                        className="w-full text-lg font-bold shadow-lg shadow-primary/25"
                        onClick={handlePayment}
                        disabled={loading || verifying}
                    >
                        {verifying ? 'Verifying Payment...' : `Pay ${campaign.totalBudget} ${campaign.currency}`}
                    </Button>
                )}
            </div>
        </div>
    )
}
