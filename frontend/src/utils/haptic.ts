/**
 * Haptic Feedback Utility
 * 
 * Provides native haptic feedback for Telegram Mini App interactions.
 * Makes the app feel native by providing tactile feedback on user actions.
 * 
 * Usage:
 *   haptic.light()    - Button taps, tab switches
 *   haptic.soft()     - Toggle switches, gentle interactions
 *   haptic.medium()   - Confirmations
 *   haptic.heavy()    - Delete actions, important confirmations
 *   haptic.rigid()    - Error states, blocked actions
 *   haptic.success()  - Operation completed successfully
 *   haptic.warning()  - Warning state
 *   haptic.error()    - Error state
 *   haptic.selection() - Picker/slider changes
 */

type HapticNotificationType = 'success' | 'warning' | 'error';
type HapticImpactType = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';

// Extend Window type for Telegram WebApp
declare global {
    interface Window {
        Telegram?: {
            WebApp?: {
                HapticFeedback?: {
                    impactOccurred: (style: HapticImpactType) => void;
                    notificationOccurred: (type: HapticNotificationType) => void;
                    selectionChanged: () => void;
                };
            };
        };
    }
}

const getWebApp = () => {
    return typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
};

const impactOccurred = (style: HapticImpactType): void => {
    try {
        const webApp = getWebApp();
        webApp?.HapticFeedback?.impactOccurred(style);
    } catch (e) {
        // Silently fail - haptic feedback is not critical
    }
};

const notificationOccurred = (type: HapticNotificationType): void => {
    try {
        const webApp = getWebApp();
        webApp?.HapticFeedback?.notificationOccurred(type);
    } catch (e) {
        // Silently fail
    }
};

const selectionChanged = (): void => {
    try {
        const webApp = getWebApp();
        webApp?.HapticFeedback?.selectionChanged();
    } catch (e) {
        // Silently fail
    }
};

/**
 * Haptic feedback API
 */
export const haptic = {
    /** Light impact - for button taps, tab switches */
    light: () => impactOccurred('light'),

    /** Soft impact - for toggles, gentle interactions */
    soft: () => impactOccurred('soft'),

    /** Medium impact - for confirmations */
    medium: () => impactOccurred('medium'),

    /** Heavy impact - for delete actions, important confirmations */
    heavy: () => impactOccurred('heavy'),

    /** Rigid impact - for errors, blocked actions */
    rigid: () => impactOccurred('rigid'),

    /** Success notification - operation completed */
    success: () => notificationOccurred('success'),

    /** Warning notification */
    warning: () => notificationOccurred('warning'),

    /** Error notification - operation failed */
    error: () => notificationOccurred('error'),

    /** Selection changed - for pickers, sliders */
    selection: () => selectionChanged(),
};

export default haptic;
