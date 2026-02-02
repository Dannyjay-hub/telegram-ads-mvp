import { useCallback } from 'react';
import { useTonConnectUI, useTonAddress, useIsConnectionRestored } from '@tonconnect/ui-react';
import { type JettonToken, isNativeToken, toSmallestUnit } from '@/lib/jettons';
import { beginCell, Address } from '@ton/core';

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
     * Get user's Jetton wallet address for a specific Jetton
     * The Jetton wallet is derived from user wallet + Jetton master contract
     */
    const getJettonWalletAddress = async (jettonMasterAddress: string, ownerAddress: string): Promise<string> => {
        // Use TON API to get the Jetton wallet address
        const response = await fetch(
            `https://tonapi.io/v2/accounts/${ownerAddress}/jettons/${jettonMasterAddress}`
        );

        if (!response.ok) {
            throw new Error('Failed to get Jetton wallet address. You may not have a USDT wallet yet.');
        }

        const data = await response.json();
        // TON API returns raw address, convert to user-friendly format for TON Connect
        const rawAddress = data.wallet_address.address;
        return Address.parse(rawAddress).toString({ bounceable: true, urlSafe: true });
    };

    /**
     * Send a Jetton (token) transfer using TEP-74 standard
     * @param jettonMasterAddress - The Jetton master contract address
     * @param recipientAddress - Where to send the tokens (final recipient)
     * @param amount - Amount in smallest unit (e.g., micro-USDT for USDT)
     * @param forwardPayload - Optional comment/memo for the transfer
     */
    const sendJettonTransaction = useCallback(async (
        jettonMasterAddress: string,
        recipientAddress: string,
        amount: bigint,
        forwardPayload?: string
    ) => {
        console.log('[TON Wallet] sendJettonTransaction called', {
            jettonMasterAddress,
            recipientAddress,
            amount: amount.toString(),
            forwardPayload
        });

        if (!tonConnectUI || !userFriendlyAddress) {
            throw new Error('Wallet not connected');
        }

        // 1. Get sender's Jetton wallet address
        const senderJettonWallet = await getJettonWalletAddress(jettonMasterAddress, userFriendlyAddress);
        console.log('[TON Wallet] Sender Jetton wallet:', senderJettonWallet);

        // 2. Build forward payload (comment/memo) if provided
        let forwardPayloadCell = beginCell().endCell();
        if (forwardPayload) {
            forwardPayloadCell = beginCell()
                .storeUint(0, 32) // op = 0 for text comment
                .storeStringTail(forwardPayload)
                .endCell();
        }

        // 3. Build TEP-74 Jetton transfer body
        // See: https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md
        const jettonTransferBody = beginCell()
            .storeUint(0xf8a7ea5, 32) // op code: jetton transfer
            .storeUint(0, 64) // query_id
            .storeCoins(amount) // amount of jettons to send
            .storeAddress(Address.parse(recipientAddress)) // destination
            .storeAddress(Address.parse(userFriendlyAddress)) // response_destination (excess goes back here)
            .storeBit(0) // no custom_payload
            .storeCoins(1n) // forward_ton_amount (1 nanoton for notification, minimal)
            .storeBit(1) // forward_payload in reference
            .storeRef(forwardPayloadCell) // the comment/memo
            .endCell();

        // 4. Build the transaction
        // We send TON to our Jetton wallet with the transfer body as payload
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
            messages: [
                {
                    address: senderJettonWallet,
                    amount: '50000000', // 0.05 TON for gas
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
            throw error;
        }
    }, [tonConnectUI, userFriendlyAddress]);

    /**
     * Unified payment function
     * Supports both native TON and Jetton (USDT) payments
     * @param token - The token to pay with
     * @param recipientAddress - Where to send the payment
     * @param amount - Amount in decimal (e.g., 10.5 for 10.5 TON or 10.5 USDT)
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
            // Jetton payment (USDT, etc.)
            if (!token.masterAddress) {
                throw new Error(`${token.symbol} master address not configured`);
            }

            const amountInSmallestUnit = toSmallestUnit(amount, token);
            return sendJettonTransaction(
                token.masterAddress,
                recipientAddress,
                amountInSmallestUnit,
                memo
            );
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
        sendJettonTransaction, // For Jetton transfers
        sendPayment, // Unified payment function

        // Utils
        formatAddress,
        tonConnectUI
    };
}
