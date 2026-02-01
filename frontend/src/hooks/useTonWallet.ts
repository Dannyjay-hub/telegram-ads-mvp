import { useCallback } from 'react';
import { useTonConnectUI, useTonAddress, useIsConnectionRestored } from '@tonconnect/ui-react';
import { beginCell, Address, toNano } from '@ton/core';
import { type JettonToken, isNativeToken, toSmallestUnit } from '@/lib/jettons';

// TON API for fetching Jetton wallet addresses
const TON_API_URL = 'https://tonapi.io/v2';

/**
 * Hook for TON wallet connection and transactions
 * Supports both native TON and Jetton (USDT/USDC) transfers
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
     * Get user's Jetton wallet address for a specific token
     * @param jettonMasterAddress - The Jetton master contract address
     * @param ownerAddress - The owner's wallet address
     */
    const getJettonWalletAddress = useCallback(async (
        jettonMasterAddress: string,
        ownerAddress: string
    ): Promise<string> => {
        const response = await fetch(
            `${TON_API_URL}/accounts/${ownerAddress}/jettons/${jettonMasterAddress}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch Jetton wallet address');
        }

        const data = await response.json();
        return data.wallet_address?.address || '';
    }, []);

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

        // Build payload with comment if provided
        let payload: string | undefined;
        if (comment) {
            const body = beginCell()
                .storeUint(0, 32) // op = 0 for simple text comment
                .storeStringTail(comment)
                .endCell();
            payload = body.toBoc().toString('base64');
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
     * Send a Jetton (token) transaction
     * @param jettonMasterAddress - The Jetton master contract address
     * @param recipientAddress - Final recipient of the tokens
     * @param amount - Amount in smallest unit (e.g., micro for USDT with 6 decimals)
     * @param comment - Forward payload comment/memo
     */
    const sendJettonTransaction = useCallback(async (
        jettonMasterAddress: string,
        recipientAddress: string,
        amount: bigint,
        comment?: string
    ) => {
        console.log('[TON Wallet] sendJettonTransaction called', {
            jettonMasterAddress, recipientAddress, amount: amount.toString(), comment
        });

        if (!tonConnectUI || !userFriendlyAddress) {
            throw new Error('Wallet not connected');
        }

        // Get user's Jetton wallet address
        const jettonWalletAddress = await getJettonWalletAddress(
            jettonMasterAddress,
            userFriendlyAddress
        );

        if (!jettonWalletAddress) {
            throw new Error('Could not find your token wallet. You may not have this token.');
        }

        console.log('[TON Wallet] User Jetton wallet:', jettonWalletAddress);

        // Build forward payload with comment
        let forwardPayload = beginCell().endCell();
        if (comment) {
            forwardPayload = beginCell()
                .storeUint(0, 32) // op = 0 for text comment
                .storeStringTail(comment)
                .endCell();
        }

        // Build TEP-74 Jetton transfer message
        // https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md
        const jettonTransferBody = beginCell()
            .storeUint(0xf8a7ea5, 32) // op: jetton_transfer
            .storeUint(0, 64) // query_id
            .storeCoins(amount) // amount of jettons
            .storeAddress(Address.parse(recipientAddress)) // destination
            .storeAddress(Address.parse(userFriendlyAddress)) // response_destination (for excess)
            .storeBit(false) // no custom_payload
            .storeCoins(toNano('0.05')) // forward_ton_amount for notification
            .storeBit(true) // has forward_payload
            .storeRef(forwardPayload) // forward_payload with comment
            .endCell();

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 300,
            messages: [
                {
                    address: jettonWalletAddress, // Send to user's Jetton wallet
                    amount: toNano('0.1').toString(), // Gas for the transfer
                    payload: jettonTransferBody.toBoc().toString('base64')
                }
            ]
        };

        console.log('[TON Wallet] Sending Jetton transaction:', transaction);

        try {
            const result = await tonConnectUI.sendTransaction(transaction);
            console.log('[TON Wallet] Jetton transaction result:', result);
            return result;
        } catch (error: any) {
            console.error('[TON Wallet] Jetton transaction failed:', error);
            const errorMessage = error.message?.toLowerCase() || '';

            if (errorMessage.includes('rejected') || errorMessage.includes('cancelled')) {
                throw new Error('Transaction cancelled by user');
            }

            if (errorMessage.includes('insufficient')) {
                throw new Error('Insufficient token balance');
            }

            throw error;
        }
    }, [tonConnectUI, userFriendlyAddress, getJettonWalletAddress]);

    /**
     * Unified payment function - routes to TON or Jetton based on token type
     * @param token - The token to pay with
     * @param recipientAddress - Where to send the payment
     * @param amount - Amount in decimal (e.g., 10.5 for 10.5 USDT)
     * @param memo - Payment memo for identification
     */
    const sendPayment = useCallback(async (
        token: JettonToken,
        recipientAddress: string,
        amount: number,
        memo?: string
    ) => {
        console.log('[TON Wallet] sendPayment called', { token: token.symbol, recipientAddress, amount, memo });

        if (isNativeToken(token)) {
            // Native TON payment
            const amountInNano = toSmallestUnit(amount, token).toString();
            return sendTransaction(recipientAddress, amountInNano, memo);
        } else {
            // Jetton payment
            const amountInSmallest = toSmallestUnit(amount, token);
            return sendJettonTransaction(token.masterAddress, recipientAddress, amountInSmallest, memo);
        }
    }, [sendTransaction, sendJettonTransaction]);

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
        sendJettonTransaction,
        sendPayment, // Unified payment function

        // Utils
        formatAddress,
        getJettonWalletAddress,
        tonConnectUI
    };
}

