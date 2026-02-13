import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Lottie from 'lottie-react'
import { verifyChannelPermissions, API_URL, getHeaders, apiFetch } from '@/api'
import { openTelegramLink, getBotUrl } from '@/lib/telegram'
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

type PageState = 'idle' | 'checking' | 'verifying' | 'success'

export function AddChannelPage() {
    const navigate = useNavigate()
    const [state, setState] = useState<PageState>('idle')
    const [verifiedStats, setVerifiedStats] = useState<any>(null)
    const [resolvedChannelId, setResolvedChannelId] = useState<string>('')

    // Toast state (Access-style bottom toast)
    const [toastMessage, setToastMessage] = useState('')
    const [toastVisible, setToastVisible] = useState(false)
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Snapshot & polling refs
    const snapshotTimeRef = useRef<number>(Date.now())
    const snapshotIdsRef = useRef<Set<string>>(new Set())
    const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pollCountRef = useRef(0)
    const MAX_POLLS = 15 // ~22.5 seconds at 1.5s intervals

    // Show Access-style bottom toast
    const showToast = useCallback((message: string) => {
        // Clear previous timer
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setToastMessage(message)
        setToastVisible(true)
        // Auto-hide after 4 seconds (same as Access)
        toastTimerRef.current = setTimeout(() => {
            setToastVisible(false)
        }, 4000)
    }, [])

    // Fetch current bot events snapshot on mount
    useEffect(() => {
        fetchSnapshot()
        return () => {
            stopPolling()
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        }
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
            // Timeout — reset to idle and show toast (exactly like Access)
            stopPolling()
            setState('idle')
            showToast('Please check if the bot was added to the group or channel')
            haptic.error()
        }
    }

    const verifyDetectedChannel = async (channel: BotEvent) => {
        try {
            const identifier = channel.chat_id.toString()
            const permRes = await verifyChannelPermissions(identifier)

            if (permRes.state === 'A_BOT_NOT_ADDED') {
                setState('idle')
                showToast('Bot was not found in the channel. Please try adding it again.')
                haptic.error()
                return
            }

            if (permRes.state === 'B_MISSING_PERMISSIONS') {
                setState('idle')
                showToast('The bot is missing required permissions. Please grant Post Messages and Stories permissions.')
                haptic.error()
                return
            }

            if (permRes.state === 'NOT_OWNER') {
                setState('idle')
                showToast('Only the channel creator can list this channel.')
                haptic.error()
                return
            }

            if (permRes.state === 'ALREADY_LISTED') {
                setState('idle')
                showToast(permRes.message || 'This channel is already listed on the platform.')
                haptic.error()
                return
            }

            if (permRes.state === 'PRIVATE_CHANNEL') {
                setState('idle')
                showToast('Private channels cannot be listed. Only public channels with a username are allowed.')
                haptic.error()
                return
            }

            if (permRes.status === 'error' || permRes.error) {
                setState('idle')
                showToast(permRes.message || permRes.error || 'Verification failed. Please try again.')
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
            setState('idle')
            showToast('Verification failed. Please check your connection and try again.')
            haptic.error()
        }
    }

    const handleAddChannel = () => {
        haptic.light()
        // Open Telegram with deep link to add bot as channel admin
        const botUrl = getBotUrl()
        openTelegramLink(`${botUrl}?startchannel`)

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

    // Determine button text & handler
    const getButtonConfig = () => {
        switch (state) {
            case 'idle':
                return { text: 'Add Group or Channel', onClick: handleAddChannel, loading: false }
            case 'checking':
                return { text: 'Cancel', onClick: handleCancel, loading: false }
            case 'verifying':
                return { text: 'Verifying...', onClick: () => { }, loading: true }
            case 'success':
                return { text: 'Next', onClick: handleNext, loading: false }
            default:
                return { text: 'Add Group or Channel', onClick: handleAddChannel, loading: false }
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
                {state === 'idle' && (
                    <div className="add-channel-center">
                        <img src="/icon.png" alt="TG Ads" className="add-channel-icon" />
                        <h1 className="add-channel-title">
                            Add Bot to Your Channel
                        </h1>
                        <p className="add-channel-subtitle">
                            Our bot requires admin access to post ads in your channel.
                            Telegram bots can't read messages or manage your channel.
                        </p>
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
                            Checking Bot Permissions
                        </h1>
                        <p className="add-channel-subtitle">
                            This may take a moment — the check usually doesn't take long
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

            {/* Access-style Bottom Toast */}
            <div className={`add-channel-toast ${toastVisible ? 'add-channel-toast-visible' : ''}`}>
                <div className="add-channel-toast-content">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <path d="M14 23C12.7689 23 11.6098 22.764 10.5225 22.2921C9.43528 21.8259 8.47747 21.1784 7.64909 20.3496C6.82071 19.5209 6.17066 18.5655 5.69895 17.4835C5.23298 16.3957 5 15.2331 5 13.9957C5 12.764 5.23298 11.6072 5.69895 10.5252C6.17066 9.43741 6.81783 8.47914 7.64046 7.65036C8.46884 6.82158 9.42665 6.1741 10.5139 5.70791C11.6012 5.23597 12.7603 5 13.9914 5C15.2224 5 16.3816 5.23597 17.4688 5.70791C18.5618 6.1741 19.5197 6.82158 20.3423 7.65036C21.1707 8.47914 21.8207 9.43741 22.2924 10.5252C22.7641 11.6072 23 12.764 23 13.9957C23 15.2331 22.7641 16.3957 22.2924 17.4835C21.8207 18.5655 21.1707 19.5209 20.3423 20.3496C19.5197 21.1784 18.5647 21.8259 17.4775 22.2921C16.3902 22.764 15.2311 23 14 23ZM14 15.4029C14.5523 15.4029 14.8399 15.1151 14.8629 14.5396L15.001 10.4561C15.0125 10.1741 14.9204 9.94101 14.7248 9.75683C14.535 9.56691 14.2905 9.47194 13.9914 9.47194C13.6865 9.47194 13.4391 9.56403 13.2493 9.7482C13.0594 9.93237 12.9703 10.1683 12.9818 10.4561L13.1112 14.5396C13.1342 15.1151 13.4305 15.4029 14 15.4029ZM14 18.4417C14.3106 18.4417 14.5753 18.3468 14.7939 18.1568C15.0125 17.9612 15.1218 17.7108 15.1218 17.4058C15.1218 17.1065 15.0125 16.859 14.7939 16.6633C14.5753 16.4676 14.3106 16.3698 14 16.3698C13.6836 16.3698 13.4161 16.4676 13.1975 16.6633C12.9789 16.859 12.8696 17.1065 12.8696 17.4058C12.8696 17.7108 12.9789 17.9612 13.1975 18.1568C13.4219 18.3468 13.6894 18.4417 14 18.4417Z" fill="white" />
                    </svg>
                    <span>{toastMessage}</span>
                </div>
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
