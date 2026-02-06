/**
 * Time utilities for post-escrow workflow
 */

/**
 * Display a date/time in the user's local timezone
 */
export function displayTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Format a countdown to a future time
 * Returns "in X hours" or "in X minutes" or "now"
 */
export function formatCountdown(isoString: string): string {
    const target = new Date(isoString).getTime();
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) return 'now';

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) {
        return `in ${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `in ${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `in ${minutes}m`;
    } else {
        return 'soon';
    }
}

/**
 * Format relative time (for "last updated" display)
 */
export function formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / (1000 * 60));

    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    return displayTime(date.toISOString());
}

/**
 * Get minimum valid time for scheduling (now + 1 hour)
 */
export function getMinScheduleTime(): Date {
    return new Date(Date.now() + 60 * 60 * 1000);
}

/**
 * Get maximum valid time for scheduling (now + 30 days)
 */
export function getMaxScheduleTime(): Date {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

/**
 * Format time for input[type="datetime-local"]
 */
export function toDateTimeLocal(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
