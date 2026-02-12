import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import WebApp from '@twa-dev/sdk';
import { authenticateWithTelegram, setAuthToken, type User } from '@/api';

interface TelegramContextType {
    user: User | null;
    isLoading: boolean;
    error: string | null;
    isMock: boolean;
}

const TelegramContext = createContext<TelegramContextType>({
    user: null,
    isLoading: true,
    error: null,
    isMock: false
});

export const useTelegram = () => useContext(TelegramContext);

export function TelegramProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMock, setIsMock] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                console.log('Initializing Telegram WebApp...');

                // 1. ready()
                WebApp.ready();

                // 2. Expand
                WebApp.expand();

                let initData = WebApp.initData;

                // Mock Mode Detection
                // If no initData (e.g., opened in browser), use Mock Data IF we are in Dev mode
                if (!initData && import.meta.env.DEV) {
                    console.warn('⚠️ using Mock Telegram Data');
                    setIsMock(true);
                    // Hardcode a mock initData string that the backend (if configured to skip validation) or a wrapper validation logic accepts.
                    // Or, better, we just bypass the auth call for visual testing? 
                    // No, we should try to simulate the flow. 
                    // For now, I will NOT send mock initData to backend because backend validation will fail.
                    // Instead, I will set a "Mock User" directly in frontend state for UI testing.

                    setUser({
                        id: 'mock-user-id',
                        telegramId: 704124192,
                        firstName: 'Mock User',
                        username: 'mock_user',
                        role: 'advertiser'
                    });
                    setIsLoading(false);
                    return;
                }

                if (!initData) {
                    setError('Please open this app inside Telegram.');
                    setIsLoading(false);
                    return;
                }

                // 3. Authenticate with Backend
                const { token, user: authenticatedUser } = await authenticateWithTelegram(initData);

                // 4. Set Token
                setAuthToken(token);
                sessionStorage.removeItem('auth_401_reload');
                setUser(authenticatedUser);

            } catch (err: any) {
                console.error('Telegram Auth Failed:', err);
                setError(err.message || 'Authentication failed');
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, []);

    return (
        <TelegramContext.Provider value={{ user, isLoading, error, isMock }}>
            {children}
        </TelegramContext.Provider>
    );
}
