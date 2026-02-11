/**
 * Telegram WebApp utility functions
 * Use these instead of native browser alerts/confirms for better UX in mini apps
 */

import { haptic } from '@/utils/haptic';

// Bot username - configurable via env var
export const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'DanielAdsMVP_bot';

/** Get the base bot URL, e.g. https://t.me/BotName */
export function getBotUrl(): string {
    return `https://t.me/${BOT_USERNAME}`;
}

/** Get a bot deep link URL, e.g. https://t.me/BotName?start=support */
export function getBotDeepLinkUrl(startParam?: string): string {
    const base = getBotUrl();
    return startParam ? `${base}?start=${startParam}` : base;
}


// Get WebApp at call time, not module load time
const getWebApp = () => (window as any).Telegram?.WebApp;

/**
 * Show an in-app alert using Telegram's WebApp.showAlert
 * Falls back to browser alert if not in Telegram
 */
export function showAlert(message: string, callback?: () => void): void {
    const WebApp = getWebApp();
    try {
        if (WebApp?.showAlert) {
            WebApp.showAlert(message, callback);
        } else {
            alert(message);
            callback?.();
        }
    } catch (e) {
        console.error('Alert failed', e);
        alert(message);
        callback?.();
    }
}

/**
 * Show a success alert with haptic feedback
 */
export function showSuccess(message: string, callback?: () => void): void {
    haptic.success();
    showAlert(message, callback);
}

/**
 * Show an error alert with haptic feedback
 */
export function showError(message: string, callback?: () => void): void {
    haptic.error();
    showAlert(message, callback);
}

/**
 * Show a warning alert with haptic feedback
 */
export function showWarning(message: string, callback?: () => void): void {
    haptic.warning();
    showAlert(message, callback);
}

/**
 * Show an in-app confirm dialog using Telegram's WebApp.showConfirm
 * Falls back to browser confirm if not in Telegram
 * Returns a Promise that resolves to true/false
 */
export function showConfirm(message: string): Promise<boolean> {
    const WebApp = getWebApp();
    haptic.medium(); // Haptic for confirmation dialogs
    return new Promise((resolve) => {
        try {
            if (WebApp?.showConfirm) {
                WebApp.showConfirm(message, (confirmed: boolean) => {
                    resolve(confirmed);
                });
            } else {
                resolve(confirm(message));
            }
        } catch (e) {
            console.error('Confirm failed', e);
            resolve(confirm(message));
        }
    });
}

/**
 * Open a Telegram link without closing the mini app
 * Falls back to window.open if not in Telegram
 */
export function openTelegramLink(url: string): void {
    const WebApp = getWebApp();
    try {
        if (WebApp?.openTelegramLink) {
            WebApp.openTelegramLink(url);
        } else {
            window.open(url, '_blank');
        }
    } catch (e) {
        console.error('Open Telegram link failed', e);
        window.open(url, '_blank');
    }
}

/**
 * Open an external link (browser)
 */
export function openLink(url: string): void {
    const WebApp = getWebApp();
    try {
        if (WebApp?.openLink) {
            WebApp.openLink(url);
        } else {
            window.open(url, '_blank');
        }
    } catch (e) {
        console.error('Open link failed', e);
        window.open(url, '_blank');
    }
}

