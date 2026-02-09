import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, X } from "lucide-react"
import { haptic } from "@/utils/haptic"
import { FilterChip } from "@/components/ui/filter-chip"

interface FilterOption<T> {
    label: string;
    value: T;
}

interface FilterDropdownProps<T> {
    /** Label shown on the button */
    label: string;
    /** Currently selected value(s) */
    value: T | T[] | null;
    /** Available options */
    options: FilterOption<T>[];
    /** Called when selection changes */
    onChange: (value: T | null) => void;
    /** For multi-select (like categories, languages) */
    multiSelect?: boolean;
    /** Called when toggling in multi-select mode */
    onToggle?: (value: T) => void;
    /** Format the display value */
    formatValue?: (value: T | T[] | null) => string;
    className?: string;
}

/**
 * FilterDropdown - Inline dropdown for filter selection
 * Shows a popover below the button with filter options
 */
export function FilterDropdown<T>({
    label,
    value,
    options,
    onChange,
    multiSelect = false,
    onToggle,
    formatValue,
    className,
}: FilterDropdownProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: PointerEvent) => {
            const target = event.target as Node;
            if (
                buttonRef.current?.contains(target) ||
                popoverRef.current?.contains(target)
            ) {
                return;
            }
            setIsOpen(false);
        };

        document.addEventListener('pointerdown', handleClickOutside, true);
        return () => {
            document.removeEventListener('pointerdown', handleClickOutside, true);
        };
    }, [isOpen]);

    // Determine if filter has active selection
    const hasValue = multiSelect
        ? Array.isArray(value) && value.length > 0
        : value !== null;

    // Get display text
    const getDisplayText = (): string => {
        if (formatValue) return formatValue(value);
        if (!hasValue) return label;

        if (multiSelect && Array.isArray(value)) {
            if (value.length === 1) {
                const opt = options.find(o => o.value === value[0]);
                return opt?.label || label;
            }
            return `${label} (${value.length})`;
        }

        const opt = options.find(o => o.value === value);
        return opt?.label || label;
    };

    const handleOptionClick = (optValue: T) => {
        haptic.soft();
        if (multiSelect && onToggle) {
            onToggle(optValue);
        } else {
            // Single select - close after selection
            onChange(optValue === value ? null : optValue);
            setIsOpen(false);
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        haptic.soft();
        if (multiSelect && onToggle && Array.isArray(value)) {
            value.forEach(v => onToggle(v));
        } else {
            onChange(null);
        }
    };

    const isSelected = (optValue: T): boolean => {
        if (multiSelect && Array.isArray(value)) {
            return value.includes(optValue);
        }
        return value === optValue;
    };

    return (
        <div className={cn("relative", className)}>
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                type="button"
                onClick={() => {
                    haptic.soft();
                    setIsOpen(!isOpen);
                }}
                className={cn(
                    "flex items-center gap-1.5 px-3 h-[32px] rounded-[10px]",
                    "text-[13px] font-medium whitespace-nowrap",
                    "border transition-all duration-200",
                    "active:scale-[0.96]",
                    hasValue
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-card text-muted-foreground border-border",
                    isOpen && "border-primary/50"
                )}
            >
                <span className="max-w-[100px] truncate">{getDisplayText()}</span>
                {hasValue ? (
                    <X
                        className="w-3 h-3 ml-0.5 hover:text-primary"
                        onClick={handleClear}
                    />
                ) : (
                    <ChevronDown className={cn(
                        "w-3 h-3 transition-transform",
                        isOpen && "rotate-180"
                    )} />
                )}
            </button>

            {/* Popover */}
            <div
                ref={popoverRef}
                className={cn(
                    "absolute top-[calc(100%+6px)] left-0 z-30",
                    "min-w-[200px] max-w-[280px] p-2 rounded-[12px]",
                    "bg-card/95 backdrop-blur-xl",
                    "border border-border shadow-lg",
                    "transition-all duration-200 origin-top-left",
                    isOpen
                        ? "opacity-100 scale-100"
                        : "opacity-0 scale-95 pointer-events-none"
                )}
            >
                <div className="flex flex-wrap gap-1.5">
                    {options.map((opt) => (
                        <FilterChip
                            key={String(opt.value)}
                            label={opt.label}
                            selected={isSelected(opt.value)}
                            onClick={() => handleOptionClick(opt.value)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
