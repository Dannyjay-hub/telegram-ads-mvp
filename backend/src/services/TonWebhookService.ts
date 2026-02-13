/**
 * TonWebhookService - Manages webhook subscriptions with TonAPI
 * Registers webhooks on server start for instant payment detection
 */

import { TON_CONFIG } from '../config/tonConfig';

// TonAPI Webhook API
const TONAPI_WEBHOOK_URL = TON_CONFIG.tonapiWebhookUrl;

// USDT Master Address (network-aware)
const USDT_MASTER_ADDRESS = TON_CONFIG.usdtMasterAddress;

export class TonWebhookService {
    private apiKey: string;
    private webhookUrl: string;
    private platformWallet: string;
    private webhookId: string | null = null;

    constructor() {
        this.apiKey = process.env.TONAPI_KEY || '';
        this.webhookUrl = process.env.WEBHOOK_URL || '';
        this.platformWallet = TON_CONFIG.masterWalletAddress;
    }

    /**
     * Check if service is configured
     */
    isConfigured(): boolean {
        return !!(this.apiKey && this.webhookUrl && this.platformWallet);
    }

    /**
     * Register webhooks on server start
     */
    async registerWebhooks(): Promise<void> {
        if (!this.isConfigured()) {
            console.log('[TonWebhookService] Not configured, skipping webhook registration');
            console.log('[TonWebhookService] Need: TONAPI_KEY, WEBHOOK_URL, MASTER_WALLET_ADDRESS');
            return;
        }

        console.log('[TonWebhookService] Registering webhooks...');
        console.log('[TonWebhookService] Platform wallet:', this.platformWallet);
        console.log('[TonWebhookService] Webhook URL:', this.webhookUrl);

        try {
            // Step 1: Create webhook endpoint
            const webhookId = await this.createWebhook();
            this.webhookId = webhookId;

            // Step 2: Subscribe to platform wallet transactions (TON)
            await this.subscribeToAccount(webhookId, this.platformWallet);
            console.log('[TonWebhookService] ✅ Subscribed to TON transactions');

            // Step 3: Get Jetton wallet and subscribe (USDT)
            const jettonWallet = await this.getJettonWalletAddress();
            if (jettonWallet) {
                await this.subscribeToAccount(webhookId, jettonWallet);
                console.log('[TonWebhookService] ✅ Subscribed to USDT transactions');
            }

            console.log('[TonWebhookService] ✅ Webhook registration complete');

        } catch (error: any) {
            console.error('[TonWebhookService] Registration failed:', error.message);
            // Don't throw - polling will still work as backup
        }
    }

    /**
     * Create a new webhook endpoint
     */
    private async createWebhook(): Promise<string> {
        const response = await fetch(TONAPI_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                endpoint: this.webhookUrl
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to create webhook: ${response.status} ${text}`);
        }

        const data = await response.json();
        console.log('[TonWebhookService] Created webhook:', data.webhook_id);
        return data.webhook_id;
    }

    /**
     * Subscribe to account transactions
     */
    private async subscribeToAccount(webhookId: string, accountId: string): Promise<void> {
        const response = await fetch(
            `${TONAPI_WEBHOOK_URL}/${webhookId}/account-tx/subscribe`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                // TonAPI expects accounts as array of objects with account_id field
                body: JSON.stringify({
                    accounts: [{ account_id: accountId }]
                })
            }
        );

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to subscribe: ${response.status} ${text}`);
        }
    }

    /**
     * Get platform's Jetton wallet address for USDT
     */
    private async getJettonWalletAddress(): Promise<string | null> {
        try {
            const response = await fetch(
                `https://tonapi.io/v2/accounts/${this.platformWallet}/jettons/${USDT_MASTER_ADDRESS}`,
                {
                    headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}
                }
            );

            if (!response.ok) {
                console.log('[TonWebhookService] No USDT wallet found (will create on first deposit)');
                return null;
            }

            const data = await response.json();
            return data.wallet_address?.address || null;
        } catch (error) {
            console.error('[TonWebhookService] Error getting Jetton wallet:', error);
            return null;
        }
    }

    /**
     * Unregister webhooks (cleanup)
     */
    async unregisterWebhooks(): Promise<void> {
        if (!this.webhookId) return;

        try {
            await fetch(`${TONAPI_WEBHOOK_URL}/${this.webhookId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            console.log('[TonWebhookService] Webhook unregistered');
        } catch (error) {
            console.error('[TonWebhookService] Failed to unregister:', error);
        }
    }
}

// Singleton instance
export const tonWebhookService = new TonWebhookService();
