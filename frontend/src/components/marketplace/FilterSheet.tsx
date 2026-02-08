import * as React from "react"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { X, SlidersHorizontal } from "lucide-react"
import { haptic } from "@/utils/haptic"
import { FilterChip } from "@/components/ui/filter-chip"
import { Button } from "@/components/ui/button"
import {
    LANGUAGE_OPTIONS,
    SUBSCRIBER_PRESETS,
    PRICE_PRESETS,
    RATING_PRESETS,
    type FilterState
} from "@/hooks/useMarketplaceFilters"

interface FilterSheetProps {
    isOpen: boolean;
    onClose: () => void;
    filters: FilterState;
    onToggleLanguage: (lang: string) => void;
    onSetSubscribers: (range: [number, number] | null) => void;
    onSetPrice: (range: [number, number] | null) => void;
    onSetRating: (rating: number | null) => void;
    onClearAll: () => void;
    activeCount: number;
}

/**
 * FilterSheet - Bottom sheet with advanced filter options
 * Uses preset chips for all options, instant filtering
 */
export const FilterSheet: React.FC<FilterSheetProps> = ({
    isOpen,
    onClose,
    filters,
    onToggleLanguage,
    onSetSubscribers,
    onSetPrice,
    onSetRating,
    onClearAll,
    activeCount,
}) => {
    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            haptic.soft();
            onClose();
        }
    };

    // Check if arrays are equal for range comparison
    const isRangeEqual = (
        a: [number, number] | null,
        b: [number, number] | null
    ): boolean => {
        if (a === null && b === null) return true;
        if (a === null || b === null) return false;
        return a[0] === b[0] && a[1] === b[1];
    };

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={handleBackdropClick}
                className={cn(
                    "fixed inset-0 z-40 bg-black/50",
                    "transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
            />

            {/* Sheet */}
            <div
                className={cn(
                    "fixed inset-x-0 bottom-0 z-50",
                    "bg-background rounded-t-[20px]",
                    "max-h-[85vh] overflow-y-auto",
                    "transition-transform duration-300 ease-out",
                    isOpen ? "translate-y-0" : "translate-y-full"
                )}
            >
                {/* Handle */}
                <div className="flex justify-center pt-2 pb-1">
                    <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h2 className="text-[17px] font-semibold">Filters</h2>
                    <button
                        onClick={() => {
                            haptic.soft();
                            onClose();
                        }}
                        className="p-1 rounded-full hover:bg-muted transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-6 pb-safe">
                    {/* Languages */}
                    <section>
                        <h3 className="text-xs uppercase text-muted-foreground font-medium mb-3 px-1">
                            Languages
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {LANGUAGE_OPTIONS.map(lang => (
                                <FilterChip
                                    key={lang}
                                    label={lang}
                                    selected={filters.languages.includes(lang)}
                                    onClick={() => onToggleLanguage(lang)}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Subscribers */}
                    <section>
                        <h3 className="text-xs uppercase text-muted-foreground font-medium mb-3 px-1">
                            Subscribers
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {SUBSCRIBER_PRESETS.map(preset => (
                                <FilterChip
                                    key={preset.label}
                                    label={preset.label}
                                    selected={isRangeEqual(filters.subscribers, preset.value)}
                                    onClick={() => onSetSubscribers(preset.value)}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Price */}
                    <section>
                        <h3 className="text-xs uppercase text-muted-foreground font-medium mb-3 px-1">
                            Price (TON)
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {PRICE_PRESETS.map(preset => (
                                <FilterChip
                                    key={preset.label}
                                    label={preset.label}
                                    selected={isRangeEqual(filters.price, preset.value)}
                                    onClick={() => onSetPrice(preset.value)}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Rating */}
                    <section>
                        <h3 className="text-xs uppercase text-muted-foreground font-medium mb-3 px-1">
                            Rating
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {RATING_PRESETS.map(preset => (
                                <FilterChip
                                    key={preset.label}
                                    label={preset.label}
                                    selected={filters.minRating === preset.value}
                                    onClick={() => onSetRating(preset.value)}
                                />
                            ))}
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 p-4 border-t border-border bg-background pb-safe">
                    <Button
                        variant="secondary"
                        onClick={() => {
                            haptic.soft();
                            onClearAll();
                        }}
                        disabled={activeCount === 0}
                        className="w-full"
                    >
                        Clear All {activeCount > 0 && `(${activeCount})`}
                    </Button>
                </div>
            </div>
        </>
    );
};

/**
 * FilterButton - Trigger button to open filter sheet
 */
interface FilterButtonProps {
    onClick: () => void;
    activeCount: number;
    className?: string;
}

export const FilterButton: React.FC<FilterButtonProps> = ({
    onClick,
    activeCount,
    className
}) => {
    return (
        <button
            type="button"
            onClick={() => {
                haptic.soft();
                onClick();
            }}
            className={cn(
                "flex items-center gap-1.5 px-3 h-[32px] rounded-[10px]",
                "text-[13px] font-medium",
                "bg-card border transition-all duration-200",
                "active:scale-[0.96]",
                activeCount > 0
                    ? "border-primary/30 text-primary"
                    : "border-border text-muted-foreground",
                className
            )}
        >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 text-[10px] rounded-full bg-primary text-primary-foreground">
                    {activeCount}
                </span>
            )}
        </button>
    );
};
