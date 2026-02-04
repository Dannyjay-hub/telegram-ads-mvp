import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTonConnectUI } from '@tonconnect/ui-react'
import { ChevronLeft, Info, Wallet, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTelegram } from '@/providers/TelegramProvider'
import { API_URL } from '@/lib/api'

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
    const [tonConnectUI] = useTonConnectUI()

    // Campaign can be passed via state (from wizard) or we fetch it
    const [campaign] = useState<Campaign | null>(location.state?.campaign || null)
    const [loading, setLoading] = useState(!location.state?.campaign)
    const [verifying, setVerifying] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Parse campaign ID if passed via URL param (fallback)
    // We might need a route like /campaigns/:id/escrow to be safe, 
    // but for now handling the /campaigns/escrow state-based route is key.

    useEffect(() => {
        if (!campaign) {
            // Ideally we should redirect back if no campaign state
            // But for now let's just show error
            setError("No campaign details found")
            setLoading(false)
        }
    }, [campaign])

    const handlePayment = async () => {
        if (!campaign) return

        try {
            setLoading(true)

            // 1. Prepare transaction
            // Amount in nanoton (1 TON = 1e9 nanoton)
            const amountNano = Math.floor(campaign.totalBudget * 1e9).toString()

            // Get wallet address to send to (platform master wallet)
            // In a real app, this would be campaign.escrowWalletAddress or a unique generated address
            const destinationAddress = campaign.escrowWalletAddress || "EQ...MASTER_WALLET..."

            // Transaction structure
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
                messages: [
                    {
                        address: destinationAddress,
                        amount: amountNano,
                        payload: undefined // logic to create payload (comment/memo) below
                    }
                ]
            }

            // Ideally we need a comment/memo to identify this payment
            // Using a simple body text if possible, or we need to encode it as BOC
            // For now, let's assume the backend monitors the sender address + amount
            // OR usually we pass a 'text' comment in the transaction payload

            // NOTE: tonConnectUI expects payload as specific format if it's a binary message
            // simpler is to just send amount if the backend tracks it via source/amount match
            // OR better: The backend should provide a payment link or QR code structure

            // For this MVP, we'll try to send with the campaign ID as comment if supported by UI libs easily,
            // otherwise just send the amount and rely on the backend finding it.

            await tonConnectUI.sendTransaction(transaction)

            // 2. Start verifying backend receipt
            startVerification()

        } catch (e: any) {
            console.error('Payment failed:', e)
            // Use e.message directly for rejection reason
            if (e?.message?.includes('User rejected')) {
                // User cancelled, do nothing
            } else {
                setError("Payment failed. Please try again.")
            }
            setLoading(false)
        }
    }

    const startVerification = () => {
        setVerifying(true)
        // Poll backend for status update
        const interval = setInterval(async () => {
            try {
                if (!campaign?.id) return
                const res = await fetch(`${API_URL}/campaigns/${campaign.id}`, {
                    headers: { 'X-Telegram-ID': String(user?.telegramId || '') }
                })
                const data = await res.json()

                if (data.status === 'active' || data.escrowFunded) {
                    clearInterval(interval)
                    setVerifying(false)
                    navigate('/campaigns', { replace: true })
                }
            } catch (e) {
                console.error('Poll error', e)
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
                {!tonConnectUI.connected ? (
                    <Button
                        size="lg"
                        className="w-full text-lg font-bold shadow-lg shadow-primary/25"
                        onClick={() => tonConnectUI.openModal()}
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
