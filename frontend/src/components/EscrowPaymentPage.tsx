import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTonWallet } from '@/hooks/useTonWallet'
import { ChevronLeft, Info, Wallet, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTelegram } from '@/providers/TelegramProvider'
import { API_URL } from '@/lib/api'
import { TON_TOKEN } from '@/lib/jettons'

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
}

export function EscrowPaymentPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user } = useTelegram()
    const { isConnected, connectWallet, sendPayment } = useTonWallet()

    // Campaign and payment instructions passed from wizard
    const [campaign] = useState<Campaign | null>(location.state?.campaign || null)
    const [paymentInstructions] = useState<{ address: string; memo: string; amount: number } | null>(
        location.state?.paymentInstructions || null
    )
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!campaign || !paymentInstructions) {
            setError("No campaign details found. Please create a new campaign.")
        }
    }, [campaign, paymentInstructions])

    const handlePayment = async () => {
        if (!campaign || !paymentInstructions) return

        try {
            setLoading(true)
            setError(null)

            // Use sendPayment from useTonWallet (same as ChannelViewPage)
            // This properly handles TON transfers with memo
            await sendPayment(
                TON_TOKEN,
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
                // User cancelled, just reset loading
                setLoading(false)
            } else if (errMsg.includes('not connected') || errMsg.includes('connect')) {
                setError('Please connect your wallet first')
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

        // Poll for campaign activation (webhook will update status to 'active')
        let pollCount = 0
        const maxPolls = 40 // 2 minutes max (every 3 seconds)

        const interval = setInterval(async () => {
            pollCount++

            try {
                if (!campaign?.id) return

                const res = await fetch(`${API_URL}/campaigns/${campaign.id}`, {
                    headers: { 'X-Telegram-ID': String(user?.telegramId || '') }
                })
                const data = await res.json()

                // Check if campaign was funded and activated
                if (data.status === 'active' || data.escrowDeposited > 0) {
                    clearInterval(interval)
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

            // Timeout after max polls
            if (pollCount >= maxPolls) {
                clearInterval(interval)
                setVerifying(false)
                // Still redirect, payment may be processing
                navigate('/campaigns', {
                    replace: true,
                    state: { paymentPending: true, campaignId: campaign?.id }
                })
            }
        }, 3000)
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

    return (
        <div className="pb-24 space-y-6">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/5 rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-bold">Fund Campaign</h1>
            </div>

            <GlassCard className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Budget</span>
                    <span className="text-xl font-bold text-primary">{campaign.totalBudget} {campaign.currency}</span>
                </div>

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
                {!isConnected ? (
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
