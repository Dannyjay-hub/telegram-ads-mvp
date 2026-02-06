import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/card';
import { X, Calendar, Clock, AlertCircle } from 'lucide-react';
import { haptic } from '@/utils/haptic';
import { displayTime, getMinScheduleTime, getMaxScheduleTime, toDateTimeLocal } from '@/utils/time';

interface TimePickerModalProps {
    open: boolean;
    onClose: () => void;
    dealId: string;
    existingProposal?: {
        proposedTime: string;
        proposedBy: 'advertiser' | 'channel_owner';
    } | null;
    userRole: 'advertiser' | 'channel_owner';
    onPropose: (time: Date) => Promise<void>;
    onAccept?: () => Promise<void>;
}

export function TimePickerModal({
    open,
    onClose,
    existingProposal,
    userRole,
    onPropose,
    onAccept
}: TimePickerModalProps) {
    const [selectedTime, setSelectedTime] = useState<string>(
        toDateTimeLocal(getMinScheduleTime())
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open) return null;

    const minTime = getMinScheduleTime();
    const maxTime = getMaxScheduleTime();

    const handlePropose = async () => {
        setError(null);
        const time = new Date(selectedTime);

        if (time < minTime) {
            setError('Post time must be at least 1 hour from now');
            haptic.error();
            return;
        }

        if (time > maxTime) {
            setError('Post time must be within 30 days');
            haptic.error();
            return;
        }

        setIsSubmitting(true);
        haptic.light();

        try {
            await onPropose(time);
            haptic.success();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Failed to propose time');
            haptic.error();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAccept = async () => {
        if (!onAccept) return;
        setIsSubmitting(true);
        haptic.light();

        try {
            await onAccept();
            haptic.success();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Failed to accept time');
            haptic.error();
        } finally {
            setIsSubmitting(false);
        }
    };

    const isCounterPartyProposal = existingProposal && existingProposal.proposedBy !== userRole;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center">
            <GlassCard className="w-full max-w-md p-6 relative rounded-t-3xl animate-in slide-in-from-bottom">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-400" />
                        Schedule Post
                    </h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="text-muted-foreground"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Existing Proposal */}
                {isCounterPartyProposal && (
                    <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-sm text-blue-400 mb-1">
                            {existingProposal.proposedBy === 'advertiser' ? 'Advertiser' : 'Channel Owner'} proposed:
                        </p>
                        <p className="text-lg font-semibold">
                            {displayTime(existingProposal.proposedTime)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Your local time
                        </p>
                    </div>
                )}

                {/* Time Picker */}
                <div className="mb-6">
                    <label className="block text-sm text-muted-foreground mb-2 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {isCounterPartyProposal ? 'Or suggest a different time:' : 'Select posting time:'}
                    </label>
                    <input
                        type="datetime-local"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        min={toDateTimeLocal(minTime)}
                        max={toDateTimeLocal(maxTime)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                        Your local time • Must be 1h-30d from now
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    {isCounterPartyProposal && onAccept && (
                        <Button
                            onClick={handleAccept}
                            disabled={isSubmitting}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                            {isSubmitting ? 'Accepting...' : 'Accept This Time'}
                        </Button>
                    )}
                    <Button
                        onClick={handlePropose}
                        disabled={isSubmitting}
                        className={`flex-1 ${isCounterPartyProposal ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                        {isSubmitting ? 'Submitting...' : isCounterPartyProposal ? 'Suggest Different Time' : 'Propose This Time'}
                    </Button>
                </div>

                {/* Confirmation note */}
                <p className="text-xs text-center text-muted-foreground mt-4">
                    The post will go live automatically at the agreed time
                </p>
            </GlassCard>
        </div>
    );
}
