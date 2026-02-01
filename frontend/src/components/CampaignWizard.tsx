import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlassCard } from '@/components/ui/card'
import { ChevronRight, Check } from 'lucide-react'
import { createDeal } from '@/lib/api'
import { useTelegram } from '@/providers/TelegramProvider'

const STEPS = ['Budget', 'Creative', 'Summary']

export function CampaignWizard() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user } = useTelegram()
    const [step, setStep] = useState(0)
    const [loading, setLoading] = useState(false)

    // Pre-fill from "Hire" button
    const initialState = location.state || {}

    const [formData, setFormData] = useState({
        budget: initialState.price ? String(initialState.price) : '',
        currency: 'USD',
        brief: '',
        channelId: initialState.channelId || '93057d7b-fc8a-485b-805a-dafc7c632fc5', // Fallback (Test Channel)
        packageTitle: undefined as string | undefined, // Snapshot
        packageDescription: undefined as string | undefined
    })

    // Mock post creation
    const handleNext = async () => {
        if (step === STEPS.length - 1) {
            // Submit
            setLoading(true)
            try {
                await createDeal({
                    priceAmount: Number(formData.budget),
                    priceCurrency: formData.currency,
                    briefText: formData.brief,
                    channelId: formData.channelId,
                    packageTitle: formData.packageTitle,
                    packageDescription: formData.packageDescription,
                    // Backend now defaults to 'submitted' status
                }, user?.telegramId)
                navigate('/')
            } catch (e) {
                console.error(e)
                // Fallback demo
                setTimeout(() => navigate('/'), 1000)
            } finally {
                setLoading(false)
            }
        } else {
            setStep(s => s + 1)
        }
    }

    return (
        <div className="pb-20">
            {/* Header - back navigation handled by Telegram native BackButton */}
            <div className="mb-6">
                <h1 className="text-xl font-bold">New Campaign</h1>
            </div>

            {/* Progress */}
            <div className="flex justify-between mb-8 px-2">
                {STEPS.map((s, i) => (
                    <div key={s} className="flex flex-col items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i <= step ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'bg-muted text-muted-foreground'
                            }`}>
                            {i < step ? <Check className="w-4 h-4" /> : i + 1}
                        </div>
                        <span className={`text-xs ${i <= step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s}</span>
                    </div>
                ))}
            </div>

            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {step === 0 && (
                    <GlassCard className="space-y-4">
                        {initialState.channel?.rateCard && initialState.channel.rateCard.length > 0 ? (
                            <div className="space-y-3">
                                <label className="text-sm font-medium mb-1.5 block">Select a Package</label>
                                <div className="grid gap-3">
                                    {initialState.channel.rateCard.map((pkg: any) => (
                                        <div
                                            key={pkg.id}
                                            className={`p-3 rounded-lg border cursor-pointer hover:bg-white/5 transition-all ${formData.packageTitle === pkg.title ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-white/10'
                                                }`}
                                            onClick={() => setFormData({
                                                ...formData,
                                                budget: String(pkg.price),
                                                brief: pkg.description ? `(Package: ${pkg.title}) ${pkg.description}` : formData.brief,
                                                packageTitle: pkg.title,
                                                packageDescription: pkg.description
                                            })}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold">{pkg.title}</span>
                                                <span className="font-mono font-bold">${pkg.price}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>
                                        </div>
                                    ))}
                                    <div
                                        className={`p-3 rounded-lg border cursor-pointer border-dashed border-white/20 hover:border-white/40 text-center text-sm text-muted-foreground ${!formData.packageTitle ? 'bg-white/5' : ''
                                            }`}
                                        onClick={() => setFormData({ ...formData, budget: '', packageTitle: undefined, packageDescription: undefined })}
                                    >
                                        Or enter custom budget...
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Total Budget</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="pl-7 text-lg"
                                    value={formData.budget}
                                    onChange={e => setFormData({ ...formData, budget: e.target.value })}
                                    autoFocus={!initialState.channel?.rateCard?.length}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Currency</label>
                            <div className="flex gap-2">
                                {['USD', 'TON', 'USDT'].map(c => (
                                    <Button
                                        key={c}
                                        variant={formData.currency === c ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, currency: c })}
                                        className="flex-1"
                                    >
                                        {c}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </GlassCard>
                )}

                {step === 1 && (
                    <GlassCard className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Campaign Brief</label>
                            <textarea
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Describe your ad requirements..."
                                value={formData.brief}
                                onChange={e => setFormData({ ...formData, brief: e.target.value })}
                            />
                        </div>
                        <div className="p-4 rounded-lg bg-accent/50 text-xs text-muted-foreground">
                            Tip: Be specific about the tone of voice and any mandatory hashtags.
                        </div>
                    </GlassCard>
                )}

                {step === 2 && (
                    <GlassCard className="space-y-4">
                        <h3 className="font-semibold text-lg">Review</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-muted-foreground">Budget</span>
                                <span className="font-bold">{formData.currency} {formData.budget}</span>
                            </div>
                            <div className="py-2">
                                <span className="text-muted-foreground block mb-1">Brief</span>
                                <p className="bg-muted/50 p-3 rounded-md">{formData.brief || 'No brief provided'}</p>
                            </div>
                        </div>
                    </GlassCard>
                )}
            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 w-full p-4 glass border-t-0 rounded-none rounded-t-2xl z-20">
                <Button className="w-full text-lg h-12 shadow-xl shadow-primary/20" onClick={handleNext} disabled={loading}>
                    {loading ? 'Creating...' : step === STEPS.length - 1 ? 'Launch Campaign' : 'Continue'}
                    {!loading && step !== STEPS.length - 1 && <ChevronRight className="w-5 h-5 ml-1" />}
                </Button>
            </div>
        </div>
    )
}
