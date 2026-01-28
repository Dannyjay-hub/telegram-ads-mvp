import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlassCard } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Check, Loader2, AlertTriangle, Users, UserPlus, X, Crown, Zap, Trash2, Plus } from 'lucide-react'
import { verifyChannelPermissions, registerChannel, updateChannel, getMyChannels, deleteChannel, API_URL, getHeaders } from '@/lib/api'
import { useTelegram } from '@/providers/TelegramProvider'

export function ChannelWizard() {
    const navigate = useNavigate()
    const { id } = useParams()
    const { user } = useTelegram()
    const [step, setStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(false)
    const [channelId, setChannelId] = useState('')
    // Removed isDraft

    // Strict Verification State
    const [verifState, setVerifState] = useState<'IDLE' | 'A_BOT_NOT_ADDED' | 'B_MISSING_PERMISSIONS' | 'D_READY'>('IDLE')
    const [missingPerms, setMissingPerms] = useState<string[]>([])

    const [verifiedStats, setVerifiedStats] = useState<any>(null)
    const [basePrice, setBasePrice] = useState('')
    const [rateCard, setRateCard] = useState<any[]>([]) // Legacy support
    const [newPackage, setNewPackage] = useState({ title: '', price: '', type: 'Post', description: '' })
    const [showPackageForm, setShowPackageForm] = useState(false)

    // Listing Details
    const [description, setDescription] = useState('')
    const [category, setCategory] = useState('')
    const [language, setLanguage] = useState('')

    // Channel error state
    const [channelError, setChannelError] = useState<string | null>(null)

    // PR Manager State
    const [owner, setOwner] = useState<any>(null)
    const [prManagers, setPrManagers] = useState<any[]>([])
    const [showPRManagerSection, setShowPRManagerSection] = useState(false)
    const [showPRManagerForm, setShowPRManagerForm] = useState(false)
    const [prError, setPrError] = useState<string | null>(null)

    // Helper function for alerts
    const showAlert = (message: string) => {
        try {
            if ((window as any).Telegram?.WebApp?.showAlert) {
                (window as any).Telegram.WebApp.showAlert(message);
            } else {
                alert(message);
            }
        } catch (e) {
            console.error('Alert failed', e);
            alert(message);
        }
    };

    useEffect(() => {
        if (id && user) {
            loadChannel()
        }
    }, [id, user])

    const loadChannel = async () => {
        setInitialLoading(true)
        try {
            const myChannels = await getMyChannels(user?.telegramId?.toString() || '704124192')
            const channel = myChannels.find(c => c.id === id)

            if (channel) {
                setChannelId(channel.telegramChannelId?.toString() || '')
                setBasePrice(channel.basePriceAmount?.toString() || '')
                setRateCard(channel.rateCard || [])
                setDescription(channel.description || '')
                setCategory(channel.category || '')
                setLanguage(channel.language || '')
                setVerifiedStats({
                    title: channel.title,
                    username: channel.username?.replace('@', ''),
                    subscribers: channel.verifiedStats?.subscribers || 0,
                    avg_views: channel.avgViews || 0,
                    photoUrl: channel.photoUrl || null
                })
                setStep(1)
                setVerifState('D_READY')

                // Fetch PR managers and auto-expand if any exist
                try {
                    const adminsRes = await fetch(`${API_URL}/channels/${id}/admins`, { headers: getHeaders() });
                    if (adminsRes.ok) {
                        const data = await adminsRes.json();
                        setOwner(data.owner);
                        setPrManagers(data.pr_managers || []);
                        // Auto-expand Team section if there are PR managers
                        if (data.pr_managers && data.pr_managers.length > 0) {
                            setShowPRManagerSection(true);
                        }
                    }
                } catch (e) {
                    console.error('Failed to load PR manager data', e);
                }
            }
        } catch (e) {
            console.error(e)
        } finally {
            setInitialLoading(false)
        }
    }

    const handleVerify = async () => {
        if (!channelId) return;
        setLoading(true);
        setVerifState('IDLE');
        setMissingPerms([]);
        console.log('Verifying:', channelId);

        try {
            // 1. Strict Permission Check (State Machine)
            // Pass the input as string (it might be an ID or @username)
            const permRes = await verifyChannelPermissions(channelId);
            console.log('Verification Response:', permRes);

            if (permRes.state === 'A_BOT_NOT_ADDED') {
                setVerifState('A_BOT_NOT_ADDED');
                return;
            }

            if (permRes.state === 'B_MISSING_PERMISSIONS') {
                setVerifState('B_MISSING_PERMISSIONS');
                setMissingPerms(permRes.missing);
                return;
            }

            if (permRes.state === 'ALREADY_LISTED') {
                const errorMsg = permRes.message || 'This channel is already listed on the platform.';
                setChannelError(errorMsg);
                showAlert(errorMsg);
                setLoading(false);
                return;
            }

            if (permRes.status === 'error' || permRes.error) {
                alert(permRes.message || permRes.error || 'Channel not found. Check the username.');
                return;
            }

            if (permRes.state === 'D_READY') {
                setVerifState('D_READY');

                // If backend resolved a username to an ID, assume it for registration
                if (permRes.resolved_id) {
                    setChannelId(permRes.resolved_id.toString());
                }

                // 2. Fetch Display Stats (Only if bot is ready)
                // We could call 'verifyChannel' here too, or just use the details from sync
                // For MVP, let's just reuse the logic or simple mapping
                setVerifiedStats({
                    title: permRes.channel_details?.title || 'Channel',
                    username: permRes.channel_details?.username || 'unknown',
                    subscribers: permRes.channel_details?.subscribers || 0,
                    avg_views: permRes.channel_details?.avg_views || 0,
                    photoUrl: permRes.channel_details?.photoUrl || null
                });

                // To get real subs, we might need a second call, but let's proceed to Step 1
                setStep(1);
            } else if (!permRes.state) {
                // Fallback if no state and no error (unexpected)
                alert('Unexpected response from server.');
            }

        } catch (e: any) {
            console.error(e);
            alert('Verification failed. ' + (e.response?.data?.message || e.message));
        } finally {
            setLoading(false);
        }
    }

    const handleRegister = async (status: 'active' | 'draft' = 'active') => {
        setLoading(true);
        try {
            // If updating an existing channel, verify team permissions first
            if (id) {
                const verifyRes = await fetch(`${API_URL}/channels/${id}/verify-team`, {
                    method: 'POST',
                    headers: getHeaders()
                });
                const verifyData = await verifyRes.json();

                if (!verifyData.valid && verifyData.invalidMembers?.length > 0) {
                    const invalidList = verifyData.invalidMembers
                        .map((m: any) => `• ${m.role === 'bot' ? 'Bot' : m.role === 'owner' ? 'Owner' : '@' + (m.username || m.userId)}: ${m.reason}`)
                        .join('\n');

                    const message = `Some team members no longer have admin permissions:\n\n${invalidList}\n\nPlease fix permissions before updating.`;
                    showAlert(message);

                    // Offer to auto-remove invalid PR managers
                    const invalidPMs = verifyData.invalidMembers.filter((m: any) => m.role === 'pr_manager');
                    if (invalidPMs.length > 0) {
                        const shouldRemove = confirm('Would you like to remove the invalid PR managers from your team?');
                        if (shouldRemove) {
                            for (const pm of invalidPMs) {
                                await fetch(`${API_URL}/channels/${id}/pr-managers/${pm.userId}`, {
                                    method: 'DELETE',
                                    headers: getHeaders()
                                });
                            }
                            // Update local state
                            setPrManagers(prev => prev.filter(
                                (p: any) => !invalidPMs.some((inv: any) => String(inv.userId) === String(p.telegram_id))
                            ));
                            showAlert('Invalid PR managers removed. Please try updating again.');
                        }
                    }
                    setLoading(false);
                    return;
                }
            }

            const payload = {
                telegram_channel_id: Number(channelId),
                title: verifiedStats?.title,
                username: verifiedStats?.username,
                description: description,
                category: category,
                language: language,
                base_price_amount: Number(basePrice) || 100,
                // New Phase 1 Pricing Structure
                pricing: {
                    base_price: Number(basePrice) || 100
                },
                rateCard: rateCard,
                status: status
            };

            if (id) {
                await updateChannel(id, payload);
                // After update, go back to My Channels list
                navigate('/channels/my');
            } else {
                await registerChannel(payload, user?.telegramId);
                // After new registration, go to dashboard to see the new channel
                navigate('/channels/my');
            }
        } catch (e: any) {
            if (e.message.includes('already registered') && !id) {
                if (confirm('Channel already registered! View your channels?')) {
                    navigate('/channels/my');
                }
            } else {
                alert(e.message || 'Failed to register');
            }
        } finally {
            setLoading(false);
        }
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this channel? This cannot be undone.')) return;
        setLoading(true);
        try {
            if (id) {
                await deleteChannel(id);
                navigate('/channels/dashboard');
            }
        } catch (e: any) {
            alert('Failed to delete: ' + e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="pb-20 max-w-lg mx-auto p-4">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-xl font-bold">Add Channel</h1>
            </div>

            {initialLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-6">
                    {step === 0 && (
                        <GlassCard className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div className="bg-blue-500/20 border border-blue-500/30 p-4 rounded-lg space-y-3">
                                    <h3 className="font-bold text-blue-100">1. Setup Instructions</h3>
                                    <p className="text-sm text-blue-50 font-medium leading-relaxed">
                                        Add our bot <span className="text-blue-300 hover:text-blue-200 cursor-pointer underline font-bold" onClick={() => window.open('https://t.me/DanielAdsMVP_bot', '_blank')}>@DanielAdsMVP_bot</span> as an Administrator to your channel with permission to <b>Post Messages</b> and <b>Stories</b>.
                                    </p>
                                </div>

                                {/* Error State: Bot Not Added */}
                                {verifState === 'A_BOT_NOT_ADDED' && (
                                    <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg flex gap-3 animate-in fade-in slide-in-from-top-2">
                                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-red-200">Bot Not Found</p>
                                            <p className="text-xs text-red-300/80">
                                                We couldn't access the channel. Please ensure the bot is an **Administrator**.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Error State: Missing Permissions */}
                                {verifState === 'B_MISSING_PERMISSIONS' && (
                                    <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-lg flex gap-3 animate-in fade-in slide-in-from-top-2">
                                        <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-orange-200">Missing Permissions</p>
                                            <p className="text-xs text-orange-200 mb-2">The bot or you are missing rights:</p>
                                            <ul className="text-xs text-orange-300/80 list-disc pl-4">
                                                {missingPerms.length > 0 ? missingPerms.map(p => (
                                                    <li key={p}>Missing: <b>{p.replace('_', ' ')}</b></li>
                                                )) : (
                                                    <li>Check Admin Rights</li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-purple-500/20 border border-purple-500/30 p-4 rounded-lg space-y-3">
                                    <h3 className="font-bold text-purple-100">2. Enter Channel ID</h3>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-white">Channel ID</Label>
                                            <Input
                                                placeholder="-100..."
                                                value={channelId}
                                                onChange={e => {
                                                    setChannelId(e.target.value);
                                                    setChannelError(null);
                                                }}
                                                className="font-mono bg-black/20 border-white/10 text-white placeholder:text-white/30"
                                            />
                                            {channelError && (
                                                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-sm text-red-400">
                                                    {channelError}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            You can find this using a bot like <span className="text-blue-400 hover:text-blue-300 cursor-pointer underline" onClick={() => window.open('https://t.me/raw_data_bot', '_blank')}>@raw_data_bot</span> or looking at the URL in Telegram Web.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <Button className="w-full h-12" onClick={handleVerify} disabled={loading}>
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Fetch Stats'}
                            </Button>
                        </GlassCard>
                    )}

                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <GlassCard className="p-6 text-center animate-in scale-in-95">
                                {verifiedStats?.photoUrl ? (
                                    <img
                                        src={verifiedStats.photoUrl}
                                        alt={verifiedStats?.title}
                                        className="w-16 h-16 rounded-full mx-auto mb-4 object-cover"
                                    />
                                ) : (
                                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                                        <Check className="w-8 h-8" />
                                    </div>
                                )}
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{verifiedStats?.title || 'Verified'}</h2>
                                <p className="text-muted-foreground">@{verifiedStats?.username}</p>

                                <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200/20">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Subscribers</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">{(verifiedStats?.subscribers || 0).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Avg Views</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">{(verifiedStats?.avg_views || 0).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Engagement</p>
                                        <p className="text-lg font-bold text-green-500">
                                            {verifiedStats?.subscribers > 0
                                                ? ((verifiedStats?.avg_views / verifiedStats?.subscribers) * 100).toFixed(1) + '%'
                                                : '-'}
                                        </p>
                                    </div>
                                </div>
                            </GlassCard>

                            <GlassCard className="p-6 space-y-6">
                                <h3 className="font-semibold">Listing Details</h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Input
                                            placeholder="Tell advertisers about your channel..."
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Category</Label>
                                            <Input
                                                placeholder="Tech, News, Crypto..."
                                                value={category}
                                                onChange={e => setCategory(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Language</Label>
                                            <Input
                                                placeholder="English, Spanish, Chinese..."
                                                value={language}
                                                onChange={e => setLanguage(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>

                            <GlassCard className="p-6 space-y-6">
                                <h3 className="font-semibold">Pricing Configuration</h3>

                                {/* Base Price First */}
                                <div className="space-y-2">
                                    <Label>Base Price (Fallback)</Label>
                                    <p className="text-xs text-muted-foreground -mt-1 mb-2">
                                        Starting price for general inquiries.
                                    </p>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                        <Input
                                            type="number"
                                            className="pl-7 bg-black/20"
                                            value={basePrice}
                                            onChange={e => setBasePrice(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Service Packages Header with Add Button */}
                                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-primary" />
                                        <h4 className="font-semibold">Service Packages</h4>
                                    </div>
                                    {!showPackageForm && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowPackageForm(true)}
                                            className="border-primary/30 text-primary"
                                        >
                                            <Plus className="w-4 h-4 mr-1" />
                                            Add Package
                                        </Button>
                                    )}
                                </div>

                                {/* List of Saved Packages */}
                                {rateCard.length > 0 && (
                                    <div className="space-y-3">
                                        {rateCard.map((pkg, idx) => (
                                            <div key={idx} className="flex justify-between items-center py-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold">{pkg.title}</span>
                                                        <span className="text-[10px] uppercase bg-white/10 px-1.5 py-0.5 rounded text-muted-foreground tracking-wider">{pkg.type}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{pkg.description}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-lg">${pkg.price}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-400/10"
                                                        onClick={() => {
                                                            const newCard = [...rateCard];
                                                            newCard.splice(idx, 1);
                                                            setRateCard(newCard);
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add New Package Form - Collapsible */}
                                {showPackageForm && (
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4 animate-in slide-in-from-top-2 fade-in">
                                        <h4 className="text-sm font-semibold">New Package</h4>

                                        <div className="space-y-2">
                                            <Label>Package Title</Label>
                                            <Input
                                                placeholder="e.g. 24h Pinned Post"
                                                value={newPackage.title}
                                                onChange={(e) => setNewPackage({ ...newPackage, title: e.target.value })}
                                                className="bg-black/20"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Price ($)</Label>
                                                <Input
                                                    type="number"
                                                    placeholder="100"
                                                    value={newPackage.price}
                                                    onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })}
                                                    className="bg-black/20"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Type</Label>
                                                <select
                                                    className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                    value={newPackage.type}
                                                    onChange={(e) => setNewPackage({ ...newPackage, type: e.target.value })}
                                                >
                                                    <option value="Post">Post</option>
                                                    <option value="Story">Story</option>
                                                    <option value="Forward">Forward</option>
                                                    <option value="Others">Others</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Description</Label>
                                            <textarea
                                                className="flex min-h-[80px] w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                placeholder="What's included? (e.g. link in bio, 24h pin)"
                                                value={newPackage.description}
                                                onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                                            />
                                        </div>

                                        <div className="flex justify-end gap-3 pt-2">
                                            <Button
                                                variant="ghost"
                                                onClick={() => {
                                                    setNewPackage({ title: '', price: '', type: 'Post', description: '' });
                                                    setShowPackageForm(false);
                                                }}
                                                className="hover:bg-white/5"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    if (!newPackage.title || !newPackage.price) return;
                                                    setRateCard([...rateCard, {
                                                        title: newPackage.title,
                                                        price: Number(newPackage.price),
                                                        type: newPackage.type,
                                                        description: newPackage.description
                                                    }]);
                                                    setNewPackage({ title: '', price: '', type: 'Post', description: '' });
                                                    setShowPackageForm(false);
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                            >
                                                Save Package
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </GlassCard>

                            {/* Team Management Section */}
                            <GlassCard className="p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-5 h-5 text-primary" />
                                        <h3 className="font-semibold">Team Management</h3>
                                    </div>
                                    {!showPRManagerSection && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={async () => {
                                                setShowPRManagerSection(true);
                                                // Fetch admin data
                                                try {
                                                    const adminsRes = await fetch(`${API_URL}/channels/${id}/admins`, { headers: getHeaders() });
                                                    if (adminsRes.ok) {
                                                        const data = await adminsRes.json();
                                                        setOwner(data.owner);
                                                        setPrManagers(data.pr_managers || []);
                                                    }
                                                } catch (e) {
                                                    console.error('Failed to load PR manager data', e);
                                                }
                                            }}
                                            className="border-primary/30 text-primary"
                                        >
                                            <UserPlus className="w-4 h-4 mr-2" />
                                            Manage Team
                                        </Button>
                                    )}
                                </div>

                                <p className="text-sm text-muted-foreground">
                                    Add PR managers to help manage deals on this channel.
                                </p>

                                {showPRManagerSection && (
                                    <div className="space-y-4 pt-2">
                                        {/* Owner Display */}
                                        {owner && (
                                            <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                                    <Crown className="w-5 h-5 text-yellow-500" />
                                                </div>
                                                <div>
                                                    <p className="font-bold">Primary Owner: @{owner.username}</p>
                                                    <p className="text-xs text-muted-foreground">Receives all payments • Cannot be removed</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* PR Managers List */}
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold">PR Managers:</Label>
                                            {prManagers.length === 0 ? (
                                                <p className="text-sm text-muted-foreground italic">No PR managers added yet</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {prManagers.map((pm: any) => (
                                                        <div key={pm.telegram_id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                                                                    {pm.username?.charAt(0).toUpperCase() || 'P'}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span>@{pm.username}</span>
                                                                    <span className="text-[10px] text-muted-foreground">ID: {pm.telegram_id}</span>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                                                onClick={async () => {
                                                                    if (!confirm(`Remove @${pm.username} as PR manager?`)) return;
                                                                    try {
                                                                        const headers = getHeaders() as Record<string, string>;
                                                                        if (user?.telegramId) {
                                                                            headers['X-Telegram-ID'] = user.telegramId.toString();
                                                                        }
                                                                        const res = await fetch(`${API_URL}/channels/${id}/pr-managers/${pm.telegram_id}`, {
                                                                            method: 'DELETE',
                                                                            headers
                                                                        });
                                                                        if (!res.ok) {
                                                                            if (res.status === 404) {
                                                                                setPrManagers(prev => prev.filter((p: any) => String(p.telegram_id) !== String(pm.telegram_id)));
                                                                                showAlert('Ghost user removed');
                                                                                return;
                                                                            }
                                                                            const err = await res.json();
                                                                            throw new Error(err.error || 'Failed to remove');
                                                                        }
                                                                        setPrManagers(prev => prev.filter((p: any) => String(p.telegram_id) !== String(pm.telegram_id)));
                                                                        showAlert('PR Manager removed');
                                                                    } catch (e: any) {
                                                                        showAlert(e.message || 'Failed to remove PR manager');
                                                                    }
                                                                }}
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Add PR Manager Form */}
                                        <div className="pt-2">
                                            {!showPRManagerForm ? (
                                                <Button
                                                    variant="outline"
                                                    className="w-full border-primary/30 text-primary hover:bg-primary/10"
                                                    onClick={() => setShowPRManagerForm(true)}
                                                >
                                                    <UserPlus className="w-4 h-4 mr-2" />
                                                    Add PR Manager
                                                </Button>
                                            ) : (
                                                <div className="space-y-4 animate-in slide-in-from-top-2 fade-in">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-sm">Add PR Manager</Label>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setShowPRManagerForm(false)}
                                                            className="h-6 text-xs text-muted-foreground hover:text-foreground"
                                                        >
                                                            Done
                                                        </Button>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <Input
                                                            placeholder="Enter Telegram username (e.g. @username)"
                                                            className="flex-1 bg-white/5 border-white/10"
                                                            id="prManagerInput"
                                                            onChange={() => setPrError(null)}
                                                        />
                                                        <Button
                                                            onClick={async () => {
                                                                const input = document.getElementById('prManagerInput') as HTMLInputElement;
                                                                const username = input?.value?.trim().replace('@', '');
                                                                if (!username) {
                                                                    setPrError('Please enter a username');
                                                                    return;
                                                                }
                                                                try {
                                                                    const headers = getHeaders() as Record<string, string>;
                                                                    if (user?.telegramId) {
                                                                        headers['X-Telegram-ID'] = user.telegramId.toString();
                                                                    }
                                                                    const res = await fetch(`${API_URL}/channels/${id}/pr-managers`, {
                                                                        method: 'POST',
                                                                        headers,
                                                                        body: JSON.stringify({ username })
                                                                    });

                                                                    if (res.ok) {
                                                                        const data = await res.json();
                                                                        setPrManagers(prev => {
                                                                            if (prev.some(p => String(p.telegram_id) === String(data.telegram_id))) return prev;
                                                                            return [...prev, {
                                                                                telegram_id: data.telegram_id,
                                                                                username: data.username || username,
                                                                                role: 'pr_manager'
                                                                            }];
                                                                        });
                                                                        input.value = '';
                                                                        showAlert(`@${data.username || username} added as PR Manager!`);
                                                                    } else {
                                                                        const err = await res.json();
                                                                        setPrError(err.error || 'Failed to add PR manager');
                                                                    }
                                                                } catch (e) {
                                                                    setPrError('Failed to connect to server');
                                                                }
                                                            }}
                                                            className="bg-primary hover:bg-primary/80"
                                                        >
                                                            <UserPlus className="w-4 h-4 mr-2" />
                                                            Add
                                                        </Button>
                                                    </div>

                                                    {prError && (
                                                        <p className="text-xs text-red-400">{prError}</p>
                                                    )}
                                                    <p className="text-xs text-muted-foreground">
                                                        The user must be an admin of this Telegram channel to be added as a PR manager.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </GlassCard>

                            <div className="flex gap-4">
                                <Button
                                    variant="outline"
                                    className="w-full h-12 text-lg border-white/20 hover:bg-white/10"
                                    onClick={() => handleRegister('draft')}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Draft'}
                                </Button>
                                <Button
                                    className="w-full h-12 text-lg"
                                    onClick={() => handleRegister('active')}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (id ? 'Update Channel' : 'Confirm Listing')}
                                </Button>
                            </div>

                            {id && (
                                <Button
                                    className="w-full bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 mt-4"
                                    onClick={handleDelete}
                                    disabled={loading}
                                >
                                    Delete Channel
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
