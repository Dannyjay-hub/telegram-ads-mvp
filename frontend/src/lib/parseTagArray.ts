/**
 * Safely parse a category or language field that may come in various formats:
 * - null/undefined → []
 * - "Crypto" (plain string) → ["Crypto"]
 * - ["Crypto", "Gaming"] (proper array) → ["Crypto", "Gaming"]
 * - '["Crypto","Gaming"]' (JSON string) → ["Crypto", "Gaming"]
 * - ['["Crypto"]'] (double-wrapped) → ["Crypto"]
 */
export function parseTagArray(value: unknown): string[] {
    if (!value) return [];

    // Already a proper array
    if (Array.isArray(value)) {
        // Flatten any double-wrapped items
        const result: string[] = [];
        for (const item of value) {
            if (typeof item === 'string') {
                // Check if the string is itself a JSON array
                if (item.startsWith('[')) {
                    try {
                        const parsed = JSON.parse(item);
                        if (Array.isArray(parsed)) {
                            result.push(...parsed.map(String));
                        } else {
                            result.push(String(parsed));
                        }
                    } catch {
                        result.push(item);
                    }
                } else {
                    result.push(item);
                }
            } else if (item != null) {
                result.push(String(item));
            }
        }
        return result;
    }

    // String value
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    // Recurse to handle nested arrays
                    return parseTagArray(parsed);
                }
                return [String(parsed)];
            } catch {
                return [trimmed];
            }
        }
        return trimmed ? [trimmed] : [];
    }

    return [];
}
