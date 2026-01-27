import crypto from 'crypto';

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    allows_write_to_pm?: boolean;
    photo_url?: string;
}

interface InitDataParsed {
    query_id?: string;
    user?: TelegramUser;
    auth_date: string;
    hash: string;
    [key: string]: any;
}

/**
 * Validates the Telegram initData string using the Bot Token.
 * @param initData The raw initData string received from the frontend (window.Telegram.WebApp.initData)
 * @param botToken The Telegram Bot Token (from BotFather)
 * @returns The parsed data if valid, throws error if invalid
 */
export const validateTelegramData = (initData: string, botToken: string): InitDataParsed => {
    if (!botToken) {
        throw new Error('BOT_TOKEN is not defined');
    }

    // Parse the query string into an object
    const urlParams = new URLSearchParams(initData);
    const data: Record<string, string> = {};

    for (const [key, value] of urlParams.entries()) {
        data[key] = value;
    }

    // Check if hash is present
    if (!data.hash) {
        throw new Error('Hash is missing from initData');
    }

    const hash = data.hash; // The signature provided by Telegram
    delete data.hash; // Remove hash from data for sorting and signing

    // Sort keys alphabetically
    const keys = Object.keys(data).sort();

    // Create data-check-string
    // key=value\nkey2=value2
    const dataCheckString = keys.map(key => `${key}=${data[key]}`).join('\n');

    // Create secret key (HMAC-SHA256 of "WebAppData" with botToken)
    // Note: The key for the final HMAC is the HEX representation of this HMAC, OR the raw bytes?
    // According to docs: secret_key = HMAC_SHA256(bot_token, "WebAppData")
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

    // Create validation hash (HMAC-SHA256 of dataCheckString with secretKey)
    const validationHash = crypto.createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

    // Compare validationHash with the hash provided by Telegram
    if (validationHash !== hash) {
        throw new Error('Invalid signature');
    }

    // Check auth_date for expiration (e.g. 24h) to prevent replay attacks
    const authDate = parseInt(data.auth_date);
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = now - authDate;

    if (timeDiff > 86400) { // 24 hours in seconds
        throw new Error('Data is outdated');
    }

    // Parse user JSON if present
    let user: TelegramUser | undefined;
    if (data.user) {
        try {
            user = JSON.parse(data.user);
        } catch (e) {
            console.error('Failed to parse user object', e);
        }
    }

    return {
        ...data,
        user,
        auth_date: data.auth_date,
        hash
    };
};
