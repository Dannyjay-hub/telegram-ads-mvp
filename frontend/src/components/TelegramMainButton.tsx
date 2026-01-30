/**
 * Telegram Main Button Component
 * 
 * Renders Telegram's native MainButton at the bottom of the screen.
 * This is the primary action button that appears above the keyboard.
 * 
 * Benefits over regular buttons:
 * - Native Telegram look and feel
 * - Consistent positioning across all mini apps
 * - Built-in loading state with spinner
 * - Always visible above keyboard
 * 
 * Usage:
 *   <TelegramMainButton
 *     text="Continue"
 *     onClick={handleSubmit}
 *     disabled={!isValid}
 *     loading={isSubmitting}
 *   />
 */

import { useEffect, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { haptic } from '@/utils/haptic';

interface TelegramMainButtonProps {
    /** Button text */
    text: string;
    /** Click handler */
    onClick: () => void;
    /** Whether button is disabled */
    disabled?: boolean;
    /** Whether to show loading spinner */
    loading?: boolean;
    /** Button background color (hex) */
    color?: string;
    /** Button text color (hex) */
    textColor?: string;
    /** Whether button is visible */
    isVisible?: boolean;
}

const getWebApp = () => (window as any)?.Telegram?.WebApp;

export const TelegramMainButton = memo(({
    text,
    onClick,
    disabled = false,
    loading = false,
    color,
    textColor,
    isVisible = true,
}: TelegramMainButtonProps) => {
    const webApp = getWebApp();
    const location = useLocation();

    // Handle click with haptic feedback
    const handleClick = () => {
        haptic.light();
        onClick();
    };

    // Setup button on mount and route changes
    useEffect(() => {
        if (!webApp?.MainButton) return;

        webApp.MainButton.setParams({
            text: text || 'Continue',
            color,
            text_color: textColor,
        });

        webApp.MainButton.onClick(handleClick);

        if (isVisible && text) {
            webApp.MainButton.show();
        } else {
            webApp.MainButton.hide();
        }

        return () => {
            webApp.MainButton.offClick(handleClick);
            webApp.MainButton.hide();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    // Handle disabled/loading state changes
    useEffect(() => {
        if (!webApp?.MainButton) return;

        webApp.MainButton.setParams({
            text: text || 'Continue',
            color,
            text_color: textColor,
        });

        if (disabled || loading) {
            webApp.MainButton.disable();
        } else {
            webApp.MainButton.enable();
        }

        if (loading) {
            webApp.MainButton.showProgress();
        } else {
            webApp.MainButton.hideProgress();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disabled, loading, text, color, textColor]);

    // Handle onClick updates
    useEffect(() => {
        if (webApp?.MainButton) {
            webApp.MainButton.onClick(handleClick);

            return () => {
                if (webApp.MainButton) {
                    webApp.MainButton.offClick(handleClick);
                }
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onClick]);

    // Fallback for development/desktop (when not in Telegram)
    // Only show fallback if WebApp MainButton is not available
    if (!webApp?.MainButton && isVisible) {
        return (
            <button
                onClick={handleClick}
                disabled={disabled || loading}
                style={{
                    width: '100%',
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    height: '56px',
                    backgroundColor: color || '#007aff',
                    color: textColor || '#ffffff',
                    border: 'none',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                }}
            >
                {loading ? 'Loading...' : text}
            </button>
        );
    }

    // Renders nothing - Telegram handles the UI
    return null;
});

TelegramMainButton.displayName = 'TelegramMainButton';

export default TelegramMainButton;
