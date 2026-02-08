import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { haptic } from "@/utils/haptic"

export interface FilterChipProps {
    label: string;
    selected?: boolean;
    onClick?: () => void;
    /** Show checkmark when selected (for single-select mode) */
    showCheck?: boolean;
    className?: string;
    disabled?: boolean;
}

/**
 * FilterChip - Toggleable chip for filters
 * Used for category selection, language selection, and preset buttons
 */
const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
    ({ label, selected = false, onClick, showCheck = false, className, disabled = false }, ref) => {
        const handleClick = () => {
            if (disabled) return;
            haptic.soft();
            onClick?.();
        };

        return (
            <button
                ref={ref}
                type="button"
                onClick={handleClick}
                disabled={disabled}
                className={cn(
                    // Base styles
                    "inline-flex items-center gap-1.5 px-3 h-[32px] rounded-[10px]",
                    "text-[13px] font-medium whitespace-nowrap",
                    "border transition-all duration-200",
                    "active:scale-[0.96]",
                    // State styles
                    selected
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-card text-foreground border-border hover:border-primary/20",
                    // Disabled
                    disabled && "opacity-50 pointer-events-none",
                    className
                )}
            >
                {showCheck && selected && (
                    <Check className="w-3 h-3" />
                )}
                {label}
            </button>
        );
    }
);
FilterChip.displayName = "FilterChip";

/**
 * FilterChipGroup - Horizontal scrolling group of chips
 */
interface FilterChipGroupProps {
    children: React.ReactNode;
    className?: string;
}

const FilterChipGroup: React.FC<FilterChipGroupProps> = ({ children, className }) => {
    return (
        <div className={cn(
            "flex gap-2 overflow-x-auto pb-1 -mx-4 px-4",
            "scrollbar-none", // Hide scrollbar
            className
        )}>
            {children}
        </div>
    );
};

export { FilterChip, FilterChipGroup };
