import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Get the logical parent route for a given path
 * This is used for explicit navigation instead of browser history
 */
function getParentRoute(pathname: string): string | null {
    // Exact matches first
    // Return 'SKIP' for routes that handle their own back button
    const exactParents: Record<string, string | null> = {
        '/': null, // Root has no parent (hide back button)
        '/advertiser': '/',
        '/channel-owner': '/',
        '/channels/my': '/channel-owner',
        '/channels/new': '/channels/my',
        '/channels/dashboard': '/channel-owner',
        '/channels/partnerships': '/channel-owner',
        '/create': 'SKIP', // CampaignWizard handles its own back button
        '/campaign/create': 'SKIP', // CampaignWizard (alternate route)
        '/campaigns': '/advertiser',
        '/partnerships': '/advertiser',
        '/marketplace': '/', // Could be reached from either dashboard
        '/marketplace/requests': '/marketplace',
    };

    // Check exact match
    if (pathname in exactParents) {
        return exactParents[pathname];
    }

    // Pattern matches for dynamic routes
    if (pathname.match(/^\/channels\/[^/]+\/view$/)) {
        // /channels/:id/view -> My Channels
        return '/channels/my';
    }
    if (pathname.match(/^\/channels\/edit\/[^/]+$/)) {
        // /channels/edit/:id -> My Channels
        return '/channels/my';
    }
    if (pathname.match(/^\/channels\/[^/]+\/settings$/)) {
        // /channels/:id/settings -> Channel View
        const id = pathname.split('/')[2];
        return `/channels/${id}/view`;
    }
    if (pathname.match(/^\/marketplace\/channel\/[^/]+$/)) {
        // /marketplace/channel/:id -> Marketplace
        return '/marketplace';
    }

    // Default fallback - go to main dashboard
    return '/';
}

/**
 * Hook to control Telegram's native BackButton in the header
 * Uses explicit parent navigation instead of browser history for predictable UX
 */
export function useTelegramBackButton() {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const WebApp = (window as any)?.Telegram?.WebApp;
        if (!WebApp?.BackButton) return;

        const BackButton = WebApp.BackButton;
        const parentRoute = getParentRoute(location.pathname);

        if (parentRoute === null) {
            // Root page has no parent - hide back button (show X Close)
            BackButton.hide();
        } else if (parentRoute === 'SKIP') {
            // Component handles its own back button - just show it, don't register handler
            BackButton.show();
        } else {
            // Has a parent - show back button
            BackButton.show();

            // Handle back button click - go to explicit parent
            const handleBack = () => {
                navigate(parentRoute, { replace: true });
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
