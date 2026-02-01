import { useCallback } from 'react';
import { useTonConnectUI, useTonAddress, useIsConnectionRestored } from '@tonconnect/ui-react';

/**
 * Hook for TON wallet connection and transactions
 * Enhanced with better error handling and wallet state verification
 */
export function useTonWallet() {
    const [tonConnectUI] = useTonConnectUI();
    const userFriendlyAddress = useTonAddress();
    const rawAddress = useTonAddress(false);
    const connectionRestored = useIsConnectionRestored();

    const isConnected = !!userFriendlyAddress && connectionRestored;
    const isLoading = !connectionRestored;

    /**
     * Open wallet connection modal
     */
    const connectWallet = useCallback(async () => {
        if (tonConnectUI) {
            await tonConnectUI.openModal();
        }
    }, [tonConnectUI]);

    /**
     * Disconnect wallet
     */
    const disconnectWallet = useCallback(async () => {
        if (tonConnectUI) {
            await tonConnectUI.disconnect();
        }
    }, [tonConnectUI]);

    /**
     * Send a transaction with a comment/memo
     * @param toAddress - Recipient wallet address
     * @param amount - Amount in nano TON (1 TON = 1e9 nano)
     * @param comment - Transaction comment/memo for identification
     */
    const sendTransaction = useCallback(async (
        toAddress: string,
        amount: string,
        comment?: string
    ) => {
        console.log('[TON Wallet] sendTransaction called', { toAddress, amount, comment });

        if (!tonConnectUI) {
            console.error('[TON Wallet] TON Connect UI not initialized');
            throw new Error('TON Connect not initialized');
        }

        // Check if wallet is connected
        if (!tonConnectUI.connected) {
            console.error('[TON Wallet] Wallet not connected, opening modal');
            await tonConnectUI.openModal();
            throw new Error('Please connect your wallet first');
        }

        // Verify we have a wallet address
        if (!userFriendlyAddress) {
            console.error('[TON Wallet] No wallet address available');
            throw new Error('No wallet connected. Please reconnect your wallet.');
        }

        console.log('[TON Wallet] Wallet connected:', userFriendlyAddress);

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
            messages: [
                {
                    address: toAddress,
                    amount: amount
                    // Note: payload removed - TON Connect requires BOC format
                    // Payment memo is tracked server-side by deal ID
                }
            ]
        };

        console.log('[TON Wallet] Sending transaction:', transaction);

        try {
            const result = await tonConnectUI.sendTransaction(transaction);
            console.log('[TON Wallet] Transaction result:', result);
            return result;
        } catch (error: any) {
            console.error('[TON Wallet] Transaction failed:', error);

            // Parse specific TON Connect errors
            const errorMessage = error.message?.toLowerCase() || '';

            if (errorMessage.includes('rejected') || errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
                throw new Error('Transaction cancelled by user');
            }

            if (errorMessage.includes('not connected') || errorMessage.includes('not authenticated')) {
                // Try to reconnect
                console.log('[TON Wallet] Attempting to reconnect...');
                throw new Error('Wallet disconnected. Please reconnect and try again.');
            }

            // Re-throw original error
            throw error;
        }
    }, [tonConnectUI, userFriendlyAddress]);

    /**
     * Format wallet address for display (shortened)
     */
    const formatAddress = useCallback((address?: string) => {
        const addr = address || userFriendlyAddress;
        if (!addr) return '';
        return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    }, [userFriendlyAddress]);

    return {
        // State
        isConnected,
        isLoading,
        walletAddress: userFriendlyAddress,
        rawAddress,

        // Actions
        connectWallet,
        disconnectWallet,
        sendTransaction,

        // Utils
        formatAddress,
        tonConnectUI
    };
}
