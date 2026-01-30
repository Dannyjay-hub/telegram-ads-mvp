/**
 * Closing Confirmation Utility
 * 
 * Prevents accidental app closure during important operations.
 * Use this during payment flows, form submissions, or any action where
 * data loss would be problematic.
 * 
 * Usage:
 *   enableClosingConfirmation();   // Shows "Are you sure?" on close
 *   disableClosingConfirmation();  // Allows closing without confirmation
 * 
 * Or use the hook:
 *   useClosingConfirmation(true);  // Enable while component is mounted
 */

import { useEffect } from 'react';

const getWebApp = () => (window as any)?.Telegram?.WebApp;

/**
 * Enable closing confirmation - shows "Are you sure?" dialog when user tries to close
 */
export function enableClosingConfirmation(): void {
    try {
        const webApp = getWebApp();
        if (webApp?.enableClosingConfirmation) {
            webApp.enableClosingConfirmation();
        }
    } catch (e) {
        console.error('Failed to enable closing confirmation:', e);
    }
}

/**
 * Disable closing confirmation - allows user to close without confirmation
 */
export function disableClosingConfirmation(): void {
    try {
        const webApp = getWebApp();
        if (webApp?.disableClosingConfirmation) {
            webApp.disableClosingConfirmation();
        }
    } catch (e) {
        console.error('Failed to disable closing confirmation:', e);
    }
}

/**
 * Hook to enable closing confirmation while a component is mounted
 * 
 * @param enabled - Whether closing confirmation should be enabled
 * 
 * @example
 * // In a payment form component:
 * function PaymentForm() {
 *   useClosingConfirmation(true);
 *   return <form>...</form>;
 * }
 */
export function useClosingConfirmation(enabled: boolean = true): void {
    useEffect(() => {
        if (enabled) {
            enableClosingConfirmation();
            return () => {
                disableClosingConfirmation();
            };
        }
    }, [enabled]);
}

export default useClosingConfirmation;
