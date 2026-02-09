import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlassCard } from '@/components/ui/card'
import { ChevronRight, Check, Users, Globe, Folder, Clock, Sparkles, Target, Save } from 'lucide-react'
import { useTelegram } from '@/providers/TelegramProvider'
import { API_URL } from '@/lib/api'

const STEPS = ['Basics', 'Budget', 'Targeting', 'Type', 'Review']
const DRAFT_KEY = 'campaign_draft'

// Common categories for channels
const CATEGORIES = [
    'Crypto', 'Tech', 'Finance', 'Gaming', 'Entertainment',
    'News', 'Education', 'Lifestyle', 'Sports', 'Business'
]

// Common languages
const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'ru', name: 'Russian' },
    { code: 'es', name: 'Spanish' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'hi', name: 'Hindi' },
    { code: 'de', name: 'German' }
]

interface CampaignFormData {
    // Basics
    title: string
    brief: string
    contentType: 'post' | 'story' | 'forward'
    // Budget - now per-channel based
    perChannelBudget: string
    currency: 'TON' | 'USDT'
    slots: number
    // Targeting
    minSubscribers: string
    maxSubscribers: string
    requiredLanguages: string[]
    requiredCategories: string[]
    // Type
    campaignType: 'open' | 'closed'
    expiresInDays: string
}

const DEFAULT_FORM_DATA: CampaignFormData = {
    title: '',
    brief: '',
    contentType: 'post',
    perChannelBudget: '',
    currency: 'TON',
    slots: 3,
    minSubscribers: '',
    maxSubscribers: '',
    requiredLanguages: [],
    requiredCategories: [],
    campaignType: 'open',
    expiresInDays: '7'
}

export function CampaignWizard() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user } = useTelegram()
    const [step, setStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [savingDraft, setSavingDraft] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [campaignId, setCampaignId] = useState<string | null>(null) // Track existing draft ID

    // Ref to track current step for back button handler
    const stepRef = useRef(step)
    stepRef.current = step // Always keep ref in sync

    const [formData, setFormData] = useState<CampaignFormData>(DEFAULT_FORM_DATA)

    // Check if resuming a draft
    useEffect(() => {
        const resumeDraft = location.state?.resumeDraft
        if (resumeDraft) {
            // Load draft data into form
            setFormData({
                ...DEFAULT_FORM_DATA,
                title: resumeDraft.title || '',
                brief: resumeDraft.brief || '',
                slots: resumeDraft.slots || 5,
                perChannelBudget: resumeDraft.totalBudget && resumeDraft.slots
                    ? String(resumeDraft.totalBudget / resumeDraft.slots)
                    : '',
                currency: resumeDraft.currency || 'TON',
                requiredLanguages: resumeDraft.requiredLanguages || [],
                requiredCategories: resumeDraft.requiredCategories || [],
                minSubscribers: resumeDraft.minSubscribers ? String(resumeDraft.minSubscribers) : '',
                maxSubscribers: resumeDraft.maxSubscribers ? String(resumeDraft.maxSubscribers) : '',
                campaignType: resumeDraft.campaignType || 'open',
                expiresInDays: resumeDraft.expiresInDays ? String(resumeDraft.expiresInDays) : '7'
            })
            // Resume at saved step
            setStep(resumeDraft.draftStep || 0)
            // Track the campaign ID for future updates
            setCampaignId(resumeDraft.id)
            // Clear localStorage draft since we're resuming from DB
            localStorage.removeItem(DRAFT_KEY)
            return
        }

        // Fresh create - clear any old localStorage draft
        // User must explicitly use "Resume" button to restore a draft
        localStorage.removeItem(DRAFT_KEY)
    }, [location.state])

    // Handle Telegram back button - go to previous step or exit
    // Using onEvent to properly intercept before global handler
    useEffect(() => {
        const WebApp = (window as any).Telegram?.WebApp
        if (!WebApp) return

        // Show back button
        WebApp.BackButton.show()

        const handleBack = () => {
            const currentStep = stepRef.current
            if (currentStep > 0) {
                setStep(currentStep - 1)
            } else {
                // Step 0 - navigate to advertiser dashboard
                navigate('/advertiser')
            }
        }

        // Use onEvent instead of onClick to properly handle the event
        WebApp.onEvent('backButtonClicked', handleBack)

        return () => {
            WebApp.offEvent('backButtonClicked', handleBack)
        }
    }, [navigate])

    // Save draft to localStorage on change (including step)
    useEffect(() => {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...formData, draftStep: step }))
        } catch (e) {
            console.warn('Failed to save draft:', e)
        }
    }, [formData, step])

    // Calculate total budget from per-channel × slots
    const totalBudget = formData.slots > 0 && formData.perChannelBudget
        ? (parseFloat(formData.perChannelBudget) * formData.slots).toFixed(2)
        : '0'

    // Validation for min/max subscribers
    const subscriberRangeValid = () => {
        if (!formData.minSubscribers || !formData.maxSubscribers) return true
        const min = parseInt(formData.minSubscribers)
        const max = parseInt(formData.maxSubscribers)
        return !isNaN(min) && !isNaN(max) && min <= max
    }

    const canProceed = () => {
        switch (step) {
            case 0: return formData.title.length >= 3 && formData.brief.length >= 10
            case 1: {
                const budget = parseFloat(formData.perChannelBudget)
                return !isNaN(budget) && budget >= 0.1 && formData.slots > 0
            }
            case 2: return subscriberRangeValid()
            case 3: return true
            default: return true
        }
    }

    const handleNext = async () => {
        if (step < STEPS.length - 1) {
            setStep(s => s + 1)
            return
        }

        // Submit campaign
        setLoading(true)
        setError(null)

        try {
            const finalTotalBudget = parseFloat(formData.perChannelBudget) * formData.slots
            const expiresAt = formData.expiresInDays
                ? new Date(Date.now() + parseInt(formData.expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
                : undefined

            // Safe payload with proper null handling
            const payload = {
                // If resuming a draft, pass the ID so backend updates instead of creates new
                campaignId: campaignId || undefined,
                title: formData.title.trim(),
                brief: formData.brief.trim(),
                contentType: formData.contentType,
                totalBudget: Math.round(finalTotalBudget * 100) / 100, // Round to 2 decimals
                currency: formData.currency,
                slots: formData.slots,
                campaignType: formData.campaignType,
                minSubscribers: formData.minSubscribers ? Math.max(0, parseInt(formData.minSubscribers)) : 0,
                maxSubscribers: formData.maxSubscribers ? Math.max(0, parseInt(formData.maxSubscribers)) : null,
                requiredLanguages: formData.requiredLanguages.length > 0 ? formData.requiredLanguages : null,
                requiredCategories: formData.requiredCategories.length > 0 ? formData.requiredCategories : null,
                expiresAt
            }

            const response = await fetch(`${API_URL}/campaigns`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-ID': String(user?.telegramId || '')
                },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                const errData = await response.json()
                throw new Error(errData.error || 'Failed to create campaign')
            }

            const { campaign, paymentInstructions } = await response.json()

            // Clear draft on success
            localStorage.removeItem(DRAFT_KEY)

            // Both open and closed campaigns require escrow payment upfront
            // The difference is: open campaigns appear in marketplace for anyone to apply,
            // closed campaigns require advertiser to manually invite specific channels
            navigate('/campaigns/escrow', { state: { campaign, paymentInstructions } })
        } catch (e: any) {
            console.error('Campaign creation error:', e)
            setError(e.message || 'Failed to create campaign')
        } finally {
            setLoading(false)
        }
    }

    const toggleArrayItem = (arr: string[], item: string) => {
        return arr.includes(item)
            ? arr.filter(x => x !== item)
            : [...arr, item]
    }

    const saveAsDraft = async () => {
        if (!user?.telegramId) {
            setError('Please connect your Telegram account first')
            return
        }

        // Prevent double-click
        if (savingDraft) return

        setSavingDraft(true)
        setError(null)

        // Retry mechanism for iOS Safari "Load failed" errors
        const maxRetries = 3

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Use PATCH for existing drafts, POST for new ones
                const isUpdate = !!campaignId
                const url = isUpdate
                    ? `${API_URL}/campaigns/${campaignId}/draft`
                    : `${API_URL}/campaigns/draft`

                const response = await fetch(url, {
                    method: isUpdate ? 'PATCH' : 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Telegram-ID': String(user.telegramId)
                    },
                    body: JSON.stringify({
                        title: formData.title,
                        brief: formData.brief,
                        totalBudget: parseFloat(formData.perChannelBudget || '0') * formData.slots,
                        currency: formData.currency,
                        slots: formData.slots,
                        campaignType: formData.campaignType,
                        minSubscribers: parseInt(formData.minSubscribers) || 0,
                        maxSubscribers: formData.maxSubscribers ? parseInt(formData.maxSubscribers) : null,
                        requiredLanguages: formData.requiredLanguages,
                        requiredCategories: formData.requiredCategories,
                        draftStep: step,
                        expiresInDays: parseInt(formData.expiresInDays) || 7
                    })
                })

                if (!response.ok) {
                    let errMsg = 'Failed to save draft'
                    try {
                        const errData = await response.json()
                        errMsg = errData.error || errMsg
                    } catch {
                        errMsg = `Server error: ${response.status} ${response.statusText}`
                    }
                    throw new Error(errMsg)
                }

                // Success! Clear draft and navigate
                localStorage.removeItem(DRAFT_KEY)
                navigate('/campaigns', { state: { draftSaved: true } })
                setSavingDraft(false)
                return // Exit function on success

            } catch (e: any) {
                const isNetworkError = e.message?.includes('Load failed') ||
                    e.message?.includes('Network') ||
                    e.message?.includes('fetch')

                // Only retry on network errors
                if (isNetworkError && attempt < maxRetries) {
                    console.log(`Draft save attempt ${attempt} failed, retrying...`)
                    await new Promise(r => setTimeout(r, 500)) // Wait 500ms before retry
                    continue
                }

                // Final attempt or non-network error - show error
                console.error('Draft save error:', e)
                setError(e.message || 'Failed to save draft')
                break
            }
        }

        setSavingDraft(false)
    }

    // Prevent negative numbers in numeric inputs
    const handleNumericInput = (value: string, field: keyof CampaignFormData) => {
        const num = parseFloat(value)
        if (value !== '' && num < 0) return
        setFormData({ ...formData, [field]: value })
    }

    return (
        <div className="pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold">Create Campaign</h1>
                    <p className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={saveAsDraft}
                    disabled={savingDraft || !formData.title}
                    className="gap-1.5"
                >
                    <Save className="w-4 h-4" />
                    {savingDraft ? 'Saving...' : 'Save Draft'}
                </Button>
            </div>

            {/* Progress */}
            <div className="flex gap-1 mb-6">
                {STEPS.map((_, i) => (
                    <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-primary' : 'bg-muted'
                            }`}
                    />
                ))}
            </div>

            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Step 0: Basics */}
                {step === 0 && (
                    <GlassCard className="p-5 space-y-5">
                        <div className="flex items-center gap-2 text-primary mb-2">
                            <Sparkles className="w-5 h-5" />
                            <span className="font-semibold">Campaign Details</span>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Campaign Title</label>
                            <Input
                                placeholder="e.g., Product Launch Q1"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Brief / Instructions</label>
                            <textarea
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                placeholder="Describe your ad requirements, tone of voice, mandatory elements..."
                                value={formData.brief}
                                onChange={e => setFormData({ ...formData, brief: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {formData.brief.length} / 500 characters
                            </p>
                        </div>

                        {/* Content Type */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Content Type</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'post', label: 'Post', icon: '📝', desc: 'Channel post' },
                                    { value: 'story', label: 'Story', icon: '📱', desc: '24h story' },
                                    { value: 'forward', label: 'Forward', icon: '↪️', desc: 'Repost' }
                                ].map(type => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, contentType: type.value as 'post' | 'story' | 'forward' })}
                                        className={`p-3 rounded-xl border-2 text-center transition-all ${formData.contentType === type.value
                                            ? 'border-primary bg-primary/10'
                                            : 'border-muted hover:border-muted-foreground/30'
                                            }`}
                                    >
                                        <div className="text-2xl mb-1">{type.icon}</div>
                                        <div className="font-medium text-sm">{type.label}</div>
                                        <div className="text-xs text-muted-foreground">{type.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </GlassCard>
                )}

                {/* Step 1: Budget - Now per-channel based */}
                {step === 1 && (
                    <GlassCard className="p-5 space-y-5">
                        <div className="flex items-center gap-2 text-primary mb-2">
                            <Target className="w-5 h-5" />
                            <span className="font-semibold">Budget & Slots</span>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Budget Per Channel</label>
                            <Input
                                type="number"
                                min="0"
                                step="0.1"
                                placeholder="0.00"
                                value={formData.perChannelBudget}
                                onChange={e => handleNumericInput(e.target.value, 'perChannelBudget')}
                                autoFocus
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                How much each channel will receive
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Currency</label>
                            <div className="flex gap-2">
                                {(['TON', 'USDT'] as const).map(c => (
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

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">
                                Number of Channels
                            </label>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setFormData({ ...formData, slots: Math.max(1, formData.slots - 1) })}
                                    disabled={formData.slots <= 1}
                                >
                                    -
                                </Button>
                                <span className="text-2xl font-bold w-12 text-center">{formData.slots}</span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setFormData({ ...formData, slots: Math.min(50, formData.slots + 1) })}
                                    disabled={formData.slots >= 50}
                                >
                                    +
                                </Button>
                            </div>
                        </div>

                        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Total Campaign Budget:</span>
                                <span className="text-xl font-bold text-primary">
                                    {totalBudget} {formData.currency}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {formData.perChannelBudget || '0'} × {formData.slots} channels
                            </p>
                        </div>
                    </GlassCard>
                )}

                {/* Step 2: Targeting */}
                {step === 2 && (
                    <GlassCard className="p-5 space-y-5">
                        <div className="flex items-center gap-2 text-primary mb-2">
                            <Users className="w-5 h-5" />
                            <span className="font-semibold">Channel Requirements</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Min Subscribers</label>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="e.g., 1000"
                                    value={formData.minSubscribers}
                                    onChange={e => handleNumericInput(e.target.value, 'minSubscribers')}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Max Subscribers</label>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="No limit"
                                    value={formData.maxSubscribers}
                                    onChange={e => handleNumericInput(e.target.value, 'maxSubscribers')}
                                />
                            </div>
                        </div>

                        {/* Validation warning */}
                        {formData.minSubscribers && formData.maxSubscribers && !subscriberRangeValid() && (
                            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                Min subscribers must be less than or equal to max subscribers
                            </div>
                        )}

                        <div>
                            <label className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                Languages
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {LANGUAGES.map(lang => (
                                    <button
                                        key={lang.code}
                                        onClick={() => setFormData({
                                            ...formData,
                                            requiredLanguages: toggleArrayItem(formData.requiredLanguages, lang.code)
                                        })}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${formData.requiredLanguages.includes(lang.code)
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted hover:bg-muted/80'
                                            }`}
                                    >
                                        {lang.name}
                                    </button>
                                ))}
                            </div>
                            {formData.requiredLanguages.length === 0 && (
                                <p className="text-xs text-muted-foreground mt-1">All languages accepted</p>
                            )}
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Folder className="w-4 h-4" />
                                Categories
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setFormData({
                                            ...formData,
                                            requiredCategories: toggleArrayItem(formData.requiredCategories, cat)
                                        })}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${formData.requiredCategories.includes(cat)
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted hover:bg-muted/80'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            {formData.requiredCategories.length === 0 && (
                                <p className="text-xs text-muted-foreground mt-1">All categories accepted</p>
                            )}
                        </div>
                    </GlassCard>
                )}

                {/* Step 3: Type & Duration */}
                {step === 3 && (
                    <GlassCard className="p-5 space-y-5">
                        <div className="flex items-center gap-2 text-primary mb-2">
                            <Clock className="w-5 h-5" />
                            <span className="font-semibold">Campaign Type</span>
                        </div>

                        <div className="space-y-3">
                            <div
                                onClick={() => setFormData({ ...formData, campaignType: 'open' })}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.campaignType === 'open'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted hover:border-muted-foreground/30'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.campaignType === 'open' ? 'border-primary' : 'border-muted-foreground'
                                        }`}>
                                        {formData.campaignType === 'open' && (
                                            <div className="w-2 h-2 rounded-full bg-primary" />
                                        )}
                                    </div>
                                    <span className="font-semibold">Open Campaign</span>
                                </div>
                                <p className="text-xs text-muted-foreground ml-6">
                                    Channels that meet criteria are auto-accepted. Full budget escrowed upfront. Best for speed.
                                </p>
                            </div>

                            <div
                                onClick={() => setFormData({ ...formData, campaignType: 'closed' })}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.campaignType === 'closed'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted hover:border-muted-foreground/30'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.campaignType === 'closed' ? 'border-primary' : 'border-muted-foreground'
                                        }`}>
                                        {formData.campaignType === 'closed' && (
                                            <div className="w-2 h-2 rounded-full bg-primary" />
                                        )}
                                    </div>
                                    <span className="font-semibold">Closed Campaign</span>
                                </div>
                                <p className="text-xs text-muted-foreground ml-6">
                                    You manually review and approve each channel. Full budget escrowed upfront. Best for quality control.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Campaign Duration</label>
                            <div className="flex gap-2 flex-wrap">
                                {['3', '7', '14', '30'].map(days => (
                                    <Button
                                        key={days}
                                        variant={formData.expiresInDays === days ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, expiresInDays: days })}
                                        className="flex-1 min-w-[60px]"
                                    >
                                        {days}d
                                    </Button>
                                ))}
                                <Button
                                    variant={!['3', '7', '14', '30'].includes(formData.expiresInDays) ? 'default' : 'outline'}
                                    onClick={() => setFormData({ ...formData, expiresInDays: '' })}
                                    className="flex-1 min-w-[60px]"
                                >
                                    Custom
                                </Button>
                            </div>
                            {!['3', '7', '14', '30'].includes(formData.expiresInDays) && (
                                <div className="mt-2">
                                    <Input
                                        type="number"
                                        min="1"
                                        max="90"
                                        placeholder="Enter days (1-90)"
                                        value={formData.expiresInDays}
                                        onChange={e => {
                                            const val = e.target.value
                                            if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 90)) {
                                                setFormData({ ...formData, expiresInDays: val })
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </GlassCard>
                )}

                {/* Step 4: Review */}
                {step === 4 && (
                    <GlassCard className="p-5 space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Check className="w-5 h-5 text-primary" />
                            Review Campaign
                        </h3>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between py-2 border-b border-muted">
                                <span className="text-muted-foreground">Title</span>
                                <span className="font-medium">{formData.title}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-muted">
                                <span className="text-muted-foreground">Per Channel</span>
                                <span className="font-medium">
                                    {formData.perChannelBudget} {formData.currency}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-muted">
                                <span className="text-muted-foreground">Channels</span>
                                <span>{formData.slots}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-muted">
                                <span className="text-muted-foreground">Total Budget</span>
                                <span className="font-bold text-primary">
                                    {totalBudget} {formData.currency}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-muted">
                                <span className="text-muted-foreground">Type</span>
                                <span className="capitalize">{formData.campaignType}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-muted">
                                <span className="text-muted-foreground">Duration</span>
                                <span>{formData.expiresInDays} days</span>
                            </div>
                            {formData.minSubscribers && (
                                <div className="flex justify-between py-2 border-b border-muted">
                                    <span className="text-muted-foreground">Min Subscribers</span>
                                    <span>{parseInt(formData.minSubscribers).toLocaleString()}</span>
                                </div>
                            )}
                            {formData.requiredLanguages.length > 0 && (
                                <div className="flex justify-between py-2 border-b border-muted">
                                    <span className="text-muted-foreground">Languages</span>
                                    <span>{formData.requiredLanguages.map(l =>
                                        LANGUAGES.find(x => x.code === l)?.name
                                    ).join(', ')}</span>
                                </div>
                            )}
                            {formData.requiredCategories.length > 0 && (
                                <div className="flex justify-between py-2 border-b border-muted">
                                    <span className="text-muted-foreground">Categories</span>
                                    <span>{formData.requiredCategories.join(', ')}</span>
                                </div>
                            )}

                            <div className="py-2">
                                <span className="text-muted-foreground block mb-1">Brief</span>
                                <p className="bg-muted/50 p-3 rounded-md text-xs">{formData.brief}</p>
                            </div>
                        </div>

                        {/* Escrow message for all campaign types */}
                        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <p className="text-xs text-amber-200">
                                ⚡ You'll need to escrow {totalBudget} {formData.currency} to publish this campaign.
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                {error}
                            </div>
                        )}
                    </GlassCard>
                )}
            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 w-full p-4 glass border-t-0 rounded-none rounded-t-2xl z-20">
                <Button
                    className="w-full text-lg h-12 shadow-xl shadow-primary/20"
                    onClick={handleNext}
                    disabled={loading || !canProceed()}
                >
                    {loading ? 'Creating...' : step === STEPS.length - 1
                        ? (formData.campaignType === 'open' ? 'Continue to Payment' : 'Create Campaign')
                        : 'Continue'}
                    {!loading && step !== STEPS.length - 1 && <ChevronRight className="w-5 h-5 ml-1" />}
                </Button>
            </div>
        </div>
    )
}
