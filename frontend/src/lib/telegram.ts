/**
 * Telegram WebApp utility functions
 * Use these instead of native browser alerts/confirms for better UX in mini apps
 */

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
 * Show an in-app confirm dialog using Telegram's WebApp.showConfirm
 * Falls back to browser confirm if not in Telegram
 * Returns a Promise that resolves to true/false
 */
export function showConfirm(message: string): Promise<boolean> {
    const WebApp = getWebApp();
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
