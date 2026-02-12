import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Lottie from 'lottie-react'
import { verifyChannelPermissions, API_URL, getHeaders, apiFetch } from '@/api'
import { openTelegramLink, getBotUrl, BOT_USERNAME } from '@/lib/telegram'
import { TelegramMainButton } from '@/components/TelegramMainButton'
import { haptic } from '@/utils/haptic'

// Import Lottie animations
import hourglassAnimation from '@/assets/animations/hourglass.json'
import confettiAnimation from '@/assets/animations/confetti.json'

// Types
interface BotEvent {
    id: string
    chat_id: number
    chat_title: string | null
    chat_username: string | null
    chat_type: string
    added_by_user_id: number
    bot_status: string
    created_at: string
}

type PageState = 'idle' | 'checking' | 'verifying' | 'error' | 'error_owner' | 'error_perms' | 'error_already_listed' | 'success'

export function AddChannelPage() {
    const navigate = useNavigate()
    const [state, setState] = useState<PageState>('idle')
    const [errorMessage, setErrorMessage] = useState('')
    const [detectedChannel, setDetectedChannel] = useState<BotEvent | null>(null)
    const [verifiedStats, setVerifiedStats] = useState<any>(null)
    const [resolvedChannelId, setResolvedChannelId] = useState<string>('')

    // Snapshot & polling refs
    const snapshotTimeRef = useRef<number>(Date.now())
    const snapshotIdsRef = useRef<Set<string>>(new Set())
    const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pollCountRef = useRef(0)
    const MAX_POLLS = 15 // ~22.5 seconds at 1.5s intervals

    // Fetch current bot events snapshot on mount
    useEffect(() => {
        fetchSnapshot()
        return () => stopPolling()
    }, [])

    const fetchSnapshot = async () => {
        try {
            const res = await apiFetch(`${API_URL}/channels/bot-events`, {
                headers: getHeaders(),
            })
            if (res.ok) {
                const data = await res.json()
                const ids = new Set<string>((data.events || []).map((e: BotEvent) => e.id))
                snapshotIdsRef.current = ids
            }
            snapshotTimeRef.current = Date.now()
        } catch (e) {
            console.error('Failed to fetch bot events snapshot:', e)
        }
    }

    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearTimeout(pollingRef.current)
            pollingRef.current = null
        }
        pollCountRef.current = 0
    }, [])

    const startPolling = useCallback(() => {
        stopPolling()
        pollCountRef.current = 0
        pollForNewChannel()
    }, [])

    const pollForNewChannel = async () => {
        pollCountRef.current += 1

        try {
            const res = await apiFetch(`${API_URL}/channels/bot-events`, {
                headers: getHeaders(),
            })
            if (res.ok) {
                const data = await res.json()
                const events: BotEvent[] = data.events || []

                // Find new events: not in snapshot AND created after snapshot time
                const newEvents = events.filter(
                    (e) =>
                        !snapshotIdsRef.current.has(e.id) &&
                        new Date(e.created_at).getTime() > snapshotTimeRef.current
                )

                if (newEvents.length > 0) {
                    // Take the first new channel (most recent)
                    const channel = newEvents[0]
                    setDetectedChannel(channel)
                    haptic.success()

                    // Auto-verify permissions
                    setState('verifying')
                    await verifyDetectedChannel(channel)
                    return
                }
            }
        } catch (e) {
            console.error('Polling error:', e)
        }

        // Continue polling if not maxed out
        if (pollCountRef.current < MAX_POLLS) {
            pollingRef.current = setTimeout(pollForNewChannel, 1500)
        } else {
            // Timeout — show error
            setState('error')
            setErrorMessage('Bot was not detected. Please make sure you added the bot as an admin to your channel.')
            haptic.error()
        }
    }

    const verifyDetectedChannel = async (channel: BotEvent) => {
        try {
            const identifier = channel.chat_id.toString()
            const permRes = await verifyChannelPermissions(identifier)

            if (permRes.state === 'A_BOT_NOT_ADDED') {
                setState('error')
                setErrorMessage('Bot was not found in the channel. Please try adding it again.')
                haptic.error()
                return
            }

            if (permRes.state === 'B_MISSING_PERMISSIONS') {
                setState('error_perms')
                setErrorMessage('The bot is missing some required permissions. Please ensure it has Post Messages and Stories permissions.')
                haptic.error()
                return
            }

            if (permRes.state === 'NOT_OWNER') {
                setState('error_owner')
                setErrorMessage('Only the channel creator can list this channel. Admins and PR managers cannot list channels.')
                haptic.error()
                return
            }

            if (permRes.state === 'ALREADY_LISTED') {
                setState('error_already_listed')
                setErrorMessage(permRes.message || 'This channel is already listed on the platform.')
                haptic.error()
                return
            }

            if (permRes.status === 'error' || permRes.error) {
                setState('error')
                setErrorMessage(permRes.message || permRes.error || 'Verification failed. Please try again.')
                haptic.error()
                return
            }

            if (permRes.state === 'D_READY') {
                const resolvedId = permRes.resolved_id ? permRes.resolved_id.toString() : identifier
                setResolvedChannelId(resolvedId)
                setVerifiedStats({
                    title: permRes.channel_details?.title || channel.chat_title || 'Channel',
                    username: permRes.channel_details?.username || channel.chat_username || null,
                    subscribers: permRes.channel_details?.subscribers || 0,
                    avg_views: permRes.channel_details?.avg_views || 0,
                    photoUrl: permRes.channel_details?.photoUrl || null,
                })
                setState('success')
                haptic.success()
            }
        } catch (e: any) {
            console.error('Verification error:', e)
            setState('error')
            setErrorMessage('Verification failed. Please check your connection and try again.')
            haptic.error()
        }
    }

    const handleAddChannel = () => {
        haptic.light()
        // Open Telegram with deep link to add bot as channel admin
        const botUrl = getBotUrl()
        openTelegramLink(`${botUrl}?startchannel=&admin=post_messages+edit_messages+post_stories`)

        // Start polling after a short delay (give user time to switch to Telegram)
        setState('checking')
        snapshotTimeRef.current = Date.now()
        setTimeout(() => {
            startPolling()
        }, 2000)
    }

    const handleCancel = () => {
        haptic.light()
        stopPolling()
        setState('idle')
        setErrorMessage('')
    }

    const handleNext = () => {
        haptic.medium()
        // Navigate to ChannelWizard with verified data via route state
        navigate('/channels/new', {
            state: {
                fromAddChannel: true,
                channelId: resolvedChannelId,
                verifiedStats,
            },
        })
    }

    const handleRetry = () => {
        haptic.light()
        setState('idle')
        setErrorMessage('')
        setDetectedChannel(null)
        // Refresh snapshot
        fetchSnapshot()
    }

    // Determine button text & handler
    const getButtonConfig = () => {
        switch (state) {
            case 'idle':
                return { text: 'Add Channel', onClick: handleAddChannel, loading: false }
            case 'checking':
                return { text: 'Cancel', onClick: handleCancel, loading: false }
            case 'verifying':
                return { text: 'Verifying...', onClick: () => { }, loading: true }
            case 'error':
            case 'error_owner':
            case 'error_perms':
            case 'error_already_listed':
                return { text: 'Try Again', onClick: handleRetry, loading: false }
            case 'success':
                return { text: 'Next', onClick: handleNext, loading: false }
            default:
                return { text: 'Add Channel', onClick: handleAddChannel, loading: false }
        }
    }

    const buttonConfig = getButtonConfig()

    // Channel display name for success state
    const displayName = verifiedStats?.username
        ? `@${verifiedStats.username}`
        : '🔒 Private Channel'

    return (
        <div className="add-channel-page">
            <div className="add-channel-content">
                {/* Idle State */}
                {(state === 'idle' || state === 'error' || state === 'error_owner' || state === 'error_perms' || state === 'error_already_listed') && (
                    <div className="add-channel-center">
                        <img src="/icon.png" alt="TG Ads" className="add-channel-icon" />
                        <h1 className="add-channel-title">
                            Add Bot to Your Channel
                        </h1>
                        <p className="add-channel-subtitle">
                            Our bot <strong>@{BOT_USERNAME}</strong> requires admin access to post ads.
                            It can only post messages — it can't read your content or manage your channel.
                        </p>

                        {/* Error Banners */}
                        {state === 'error' && (
                            <div className="add-channel-error-banner">
                                <span className="add-channel-error-icon">⚠️</span>
                                <span>{errorMessage}</span>
                            </div>
                        )}
                        {state === 'error_owner' && (
                            <div className="add-channel-error-banner">
                                <span className="add-channel-error-icon">👑</span>
                                <span>{errorMessage}</span>
                            </div>
                        )}
                        {state === 'error_perms' && (
                            <div className="add-channel-error-banner">
                                <span className="add-channel-error-icon">🔐</span>
                                <span>{errorMessage}</span>
                            </div>
                        )}
                        {state === 'error_already_listed' && (
                            <div className="add-channel-error-banner">
                                <span className="add-channel-error-icon">📋</span>
                                <span>{errorMessage}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Checking State */}
                {state === 'checking' && (
                    <div className="add-channel-center">
                        <div className="add-channel-lottie">
                            <Lottie
                                animationData={hourglassAnimation}
                                loop={true}
                                style={{ width: 120, height: 120 }}
                            />
                        </div>
                        <h1 className="add-channel-title">
                            Checking If the Bot Was Added
                        </h1>
                        <p className="add-channel-subtitle">
                            This may take a moment — add the bot as an admin to your channel, then come back here.
                        </p>
                        <p className="add-channel-poll-status">
                            Checking... ({pollCountRef.current}/{MAX_POLLS})
                        </p>
                    </div>
                )}

                {/* Verifying State */}
                {state === 'verifying' && (
                    <div className="add-channel-center">
                        <div className="add-channel-lottie">
                            <Lottie
                                animationData={hourglassAnimation}
                                loop={true}
                                style={{ width: 120, height: 120 }}
                            />
                        </div>
                        <h1 className="add-channel-title">
                            Verifying Permissions
                        </h1>
                        <p className="add-channel-subtitle">
                            Bot detected in <strong>{detectedChannel?.chat_title || 'your channel'}</strong>.
                            Checking ownership and permissions...
                        </p>
                    </div>
                )}

                {/* Success State */}
                {state === 'success' && (
                    <div className="add-channel-center">
                        <div className="add-channel-lottie">
                            <Lottie
                                animationData={confettiAnimation}
                                loop={false}
                                style={{ width: 150, height: 150 }}
                            />
                        </div>
                        <h1 className="add-channel-title add-channel-title-success">
                            Added.{'\n'}Now, Configure It!
                        </h1>
                        <p className="add-channel-subtitle">
                            <strong>{verifiedStats?.title}</strong>
                        </p>
                        <p className="add-channel-channel-handle">
                            {displayName}
                        </p>
                        <p className="add-channel-subtitle-small">
                            Your channel is connected. Set up your listing details, packages, and pricing.
                        </p>
                    </div>
                )}
            </div>

            {/* Native Telegram Main Button */}
            <TelegramMainButton
                text={buttonConfig.text}
                onClick={buttonConfig.onClick}
                loading={buttonConfig.loading}
            />
        </div>
    )
}

export default AddChannelPage
