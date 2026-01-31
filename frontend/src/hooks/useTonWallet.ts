import { useCallback } from 'react';
import { useTonConnectUI, useTonAddress, useIsConnectionRestored } from '@tonconnect/ui-react';

/**
 * Hook for TON wallet connection and transactions
 */
export function useTonWallet() {
    const [tonConnectUI] = useTonConnectUI();
    const userFriendlyAddress = useTonAddress();
    const rawAddress = useTonAddress(false);
    const connectionRestored = useIsConnectionRestored();

    const isConnected = !!userFriendlyAddress;
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
        if (!tonConnectUI) {
            throw new Error('TON Connect not initialized');
        }

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
            messages: [
                {
                    address: toAddress,
                    amount: amount,
                    // Add comment as payload if provided
                    ...(comment && {
                        payload: buildCommentPayload(comment)
                    })
                }
            ]
        };

        const result = await tonConnectUI.sendTransaction(transaction);
        return result;
    }, [tonConnectUI]);

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

/**
 * Build a comment payload for TON transaction
 * Comment is encoded as a Cell with 0x00000000 prefix
 */
function buildCommentPayload(comment: string): string {
    // For simple text comments, we use base64 encoding
    // The comment will be visible in the transaction
    const encoder = new TextEncoder();
    const commentBytes = encoder.encode(comment);

    // Create payload: 0x00000000 (4 bytes) + comment
    const payload = new Uint8Array(4 + commentBytes.length);
    // First 4 bytes are zeros (text comment indicator)
    payload.set(commentBytes, 4);

    // Convert to base64
    return btoa(String.fromCharCode(...payload));
}
