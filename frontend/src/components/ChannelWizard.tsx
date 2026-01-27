import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlassCard } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Check, Loader2, AlertTriangle } from 'lucide-react'
import { verifyChannelPermissions, registerChannel, updateChannel, getMyChannels, deleteChannel } from '@/lib/api'
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

    // Listing Details
    const [description, setDescription] = useState('')
    const [category, setCategory] = useState('')
    const [tags, setTags] = useState('')

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
                setTags(channel.tags?.join(', ') || '')
                setVerifiedStats({
                    title: channel.title,
                    username: channel.username?.replace('@', ''),
                    subscribers: channel.verifiedStats?.subscribers || 0
                })
                setStep(1)
                setVerifState('D_READY')
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
                    avg_views: permRes.channel_details?.avg_views || 0 // Expect this
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
            const payload = {
                telegram_channel_id: Number(channelId),
                title: verifiedStats?.title,
                username: verifiedStats?.username,
                description: description,
                category: category,
                tags: tags.split(',').map(t => t.trim()).filter(Boolean),
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
            } else {
                await registerChannel(payload, user?.telegramId);
            }

            navigate('/channels/dashboard');
        } catch (e: any) {
            if (e.message.includes('already registered') && !id) {
                if (confirm('Channel already registered! View dashboard?')) {
                    navigate('/channels/dashboard');
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
                                                onChange={e => setChannelId(e.target.value)}
                                                className="font-mono bg-black/20 border-white/10 text-white placeholder:text-white/30"
                                            />
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
                                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                                    <Check className="w-8 h-8" />
                                </div>
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
                                            <Label>Tags (Comma separated)</Label>
                                            <Input
                                                placeholder="bitcoin, daily, news"
                                                value={tags}
                                                onChange={e => setTags(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>

                            <GlassCard className="p-6 space-y-6">
                                <h3 className="font-semibold">Service Packages</h3>

                                {/* List of Saved Packages */}
                                <div className="space-y-3">
                                    {rateCard.map((pkg, idx) => (
                                        <div key={idx} className="bg-white/5 p-4 rounded-xl flex justify-between items-center border border-white/5">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-base">{pkg.title}</span>
                                                    <span className="text-[10px] uppercase bg-white/10 px-1.5 py-0.5 rounded text-muted-foreground tracking-wider">{pkg.type}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{pkg.description}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-bold text-lg">${pkg.price}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                                                    onClick={() => {
                                                        const newCard = [...rateCard];
                                                        newCard.splice(idx, 1);
                                                        setRateCard(newCard);
                                                    }}
                                                >
                                                    &times;
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Add New Package Form */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
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
                                            onClick={() => setNewPackage({ title: '', price: '', type: 'Post', description: '' })}
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
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            Save Package
                                        </Button>
                                    </div>
                                </div>

                                {/* Base Price Fallback */}
                                <div className="space-y-2 pt-2 border-t border-white/5">
                                    <Label>Base Price (Fallback)</Label>
                                    <p className="text-xs text-muted-foreground -mt-1 mb-2">
                                        Used if no packages are selected or available.
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
