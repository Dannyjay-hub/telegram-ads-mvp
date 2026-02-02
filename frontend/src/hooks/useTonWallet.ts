import { useCallback } from 'react';
import { useTonConnectUI, useTonAddress, useIsConnectionRestored } from '@tonconnect/ui-react';
import { type JettonToken, isNativeToken, toSmallestUnit } from '@/lib/jettons';
import { beginCell } from '@ton/core';

/**
 * Hook for TON wallet connection and transactions
 * Note: Currently only supports native TON transfers
 * Jetton transfers require backend payload building (WIP)
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
     * Encode a comment as BOC payload using @ton/core
     * This is the proper format for TON Connect SDK
     */
    const encodeComment = (comment: string): string => {
        // Build a Cell with op=0 (text comment) and the comment text
        const body = beginCell()
            .storeUint(0, 32) // op = 0 for text comment
            .storeStringTail(comment)
            .endCell();

        // Convert to base64 BOC
        return body.toBoc().toString('base64');
    };

    /**
     * Send a native TON transaction with a comment/memo
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

        if (!tonConnectUI.connected) {
            console.error('[TON Wallet] Wallet not connected, opening modal');
            await tonConnectUI.openModal();
            throw new Error('Please connect your wallet first');
        }

        if (!userFriendlyAddress) {
            console.error('[TON Wallet] No wallet address available');
            throw new Error('No wallet connected. Please reconnect your wallet.');
        }

        console.log('[TON Wallet] Wallet connected:', userFriendlyAddress);

        // Build simple payload with comment if provided
        let payload: string | undefined;
        if (comment) {
            payload = encodeComment(comment);
        }

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
            messages: [
                {
                    address: toAddress,
                    amount: amount,
                    ...(payload && { payload })
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
            const errorMessage = error.message?.toLowerCase() || '';

            if (errorMessage.includes('rejected') || errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
                throw new Error('Transaction cancelled by user');
            }

            if (errorMessage.includes('not connected') || errorMessage.includes('not authenticated')) {
                throw new Error('Wallet disconnected. Please reconnect and try again.');
            }

            throw error;
        }
    }, [tonConnectUI, userFriendlyAddress]);

    /**
     * Unified payment function
     * Currently only supports native TON - USDT support coming via backend integration
     * @param token - The token to pay with
     * @param recipientAddress - Where to send the payment
     * @param amount - Amount in decimal (e.g., 10.5 for 10.5 TON)
     * @param memo - Payment memo for identification
     */
    const sendPayment = useCallback(async (
        token: JettonToken,
        recipientAddress: string,
        amount: number,
        memo?: string
    ) => {
        console.log('[TON Wallet] sendPayment called', { token: token.symbol, recipientAddress, amount, memo });

        if (!isNativeToken(token)) {
            // For now, force TON for non-native tokens until backend Jetton payload is ready
            console.warn('[TON Wallet] Jetton transfers not yet supported, using TON');
            throw new Error('USDT payments coming soon! Please use TON for now.');
        }

        // Native TON payment
        const amountInNano = toSmallestUnit(amount, token).toString();
        return sendTransaction(recipientAddress, amountInNano, memo);
    }, [sendTransaction]);

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
        sendPayment, // Unified payment function

        // Utils
        formatAddress,
        tonConnectUI
    };
}
