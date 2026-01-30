/**
 * Content Moderation Service
 * 
 * Checks text content against blacklisted words.
 * Server-side only - never expose to frontend.
 */

import { BLACKLIST_SET, BLACKLIST_PHRASES } from '../config/blacklist';

interface ModerationResult {
    isClean: boolean;
    reason?: string;
}

interface MultiFieldResult {
    isClean: boolean;
    violatedFields: string[];
}

class ContentModerationService {

    /**
     * Check if text contains blacklisted content
     * @param text - The text to check
     * @returns Object with isClean boolean and optional reason
     */
    checkContent(text: string): ModerationResult {
        if (!text || typeof text !== 'string') {
            return { isClean: true };
        }

        const textLower = text.toLowerCase();

        // 1. Check multi-word phrases first (substring match)
        for (const phrase of BLACKLIST_PHRASES) {
            if (textLower.includes(phrase.toLowerCase())) {
                console.log(`🚫 Blacklist phrase detected: "${phrase}"`);
                return {
                    isClean: false,
                    reason: 'Content violates community guidelines'
                };
            }
        }

        // 2. Check individual words
        // Split by whitespace and common punctuation
        const words = textLower.split(/[\s,.\-_!?()[\]{}:;'"\/\\<>@#$%^&*+=|~`]+/);

        for (const word of words) {
            const cleanWord = word.trim();
            if (cleanWord.length > 0 && BLACKLIST_SET.has(cleanWord)) {
                console.log(`🚫 Blacklist word detected: "${cleanWord}"`);
                return {
                    isClean: false,
                    reason: 'Content violates community guidelines'
                };
            }
        }

        return { isClean: true };
    }

    /**
     * Check multiple text fields at once
     * @param fields - Object with field names as keys and text as values
     * @returns Object with isClean boolean and array of violated field names
     */
    checkMultipleFields(fields: Record<string, string | undefined | null>): MultiFieldResult {
        const violatedFields: string[] = [];

        for (const [fieldName, text] of Object.entries(fields)) {
            if (text) {
                const result = this.checkContent(text);
                if (!result.isClean) {
                    violatedFields.push(fieldName);
                }
            }
        }

        return {
            isClean: violatedFields.length === 0,
            violatedFields
        };
    }

    /**
     * Get a user-friendly error message (generic, doesn't reveal trigger)
     */
    getErrorMessage(): string {
        return 'Your content contains words or phrases that violate our community guidelines. Please review and revise your submission.';
    }
}

// Export singleton instance
export const contentModerationService = new ContentModerationService();
export default contentModerationService;
