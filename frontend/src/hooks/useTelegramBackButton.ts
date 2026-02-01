import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Hook to control Telegram's native BackButton in the header
 * Shows "< Back" in Telegram's native header instead of "X Close" when navigating deeper
 */
export function useTelegramBackButton() {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const WebApp = (window as any)?.Telegram?.WebApp;
        if (!WebApp?.BackButton) return;

        const BackButton = WebApp.BackButton;

        // Root paths where we should NOT show back button
        const rootPaths = ['/', '/advertiser', '/channel-owner'];
        const isRootPage = rootPaths.includes(location.pathname);

        if (isRootPage) {
            // On root pages, hide back button (show X Close)
            BackButton.hide();
        } else {
            // On sub-pages, show back button
            BackButton.show();

            // Handle back button click
            const handleBack = () => {
                navigate(-1);
            };

            BackButton.onClick(handleBack);

            // Cleanup listener on unmount or path change
            return () => {
                BackButton.offClick(handleBack);
            };
        }
    }, [location.pathname, navigate]);
}

/**
 * Initialize Telegram viewport CSS variables for safe area insets
 * Call this once at app startup
 */
export function initTelegramViewport() {
    const WebApp = (window as any)?.Telegram?.WebApp;
    if (!WebApp) return;

    // Signal that app is ready
    WebApp.ready?.();
    WebApp.expand?.();

    // Set CSS custom properties for Telegram safe areas
    const updateSafeAreas = () => {
        const root = document.documentElement;

        // Get safe area values from Telegram WebApp
        const safeAreaInsets = WebApp.safeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 };
        const contentSafeAreaInsets = WebApp.contentSafeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 };

        root.style.setProperty('--tg-viewport-safe-area-inset-top', `${safeAreaInsets.top}px`);
        root.style.setProperty('--tg-viewport-safe-area-inset-bottom', `${safeAreaInsets.bottom}px`);
        root.style.setProperty('--tg-viewport-content-safe-area-inset-top', `${contentSafeAreaInsets.top}px`);
        root.style.setProperty('--tg-viewport-content-safe-area-inset-bottom', `${contentSafeAreaInsets.bottom}px`);

        // Fallback: if no safe area values, use reasonable defaults
        // Telegram header is typically ~56px
        if (safeAreaInsets.top === 0 && contentSafeAreaInsets.top === 0) {
            root.style.setProperty('--tg-header-height', '56px');
        } else {
            root.style.setProperty('--tg-header-height',
                `calc(${safeAreaInsets.top}px + ${contentSafeAreaInsets.top}px)`);
        }
    };

    updateSafeAreas();

    // Listen for viewport changes
    WebApp.onEvent?.('viewportChanged', updateSafeAreas);
}
