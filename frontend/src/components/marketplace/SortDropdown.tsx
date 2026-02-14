import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, Check } from "lucide-react"
import { haptic } from "@/utils/haptic"
import { SORT_OPTIONS, type SortOption } from "@/hooks/useMarketplaceFilters"

interface SortDropdownProps {
    value: SortOption;
    onChange: (value: SortOption) => void;
    className?: string;
}

/**
 * SortDropdown - Dropdown menu for sort options
 * Matches access-tool pattern with checkmark indicators
 */
export const SortDropdown: React.FC<SortDropdownProps> = ({
    value,
    onChange,
    className
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: PointerEvent) => {
            const target = event.target as Node;
            if (
                dropdownRef.current?.contains(target) ||
                buttonRef.current?.contains(target)
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

    const handleSelect = (sortValue: SortOption) => {
        haptic.soft();
        onChange(sortValue);
        setIsOpen(false);
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
                    "text-[13px] font-medium",
                    "bg-[var(--fill-secondary)]",
                    "transition-all duration-200",
                    "active:scale-[0.96]"
                )}
            >
                <span className="text-muted-foreground">Sort</span>
                <ChevronDown className={cn(
                    "w-3.5 h-3.5 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                )} />
            </button>

            {/* Dropdown Menu */}
            <div
                ref={dropdownRef}
                className={cn(
                    "absolute top-[calc(100%+8px)] right-0 z-20",
                    "min-w-[180px] rounded-[10px]",
                    "bg-card/95 backdrop-blur-xl",
                    "border border-border",
                    "shadow-lg",
                    "transition-all duration-200 origin-top-right",
                    isOpen
                        ? "opacity-100 scale-100"
                        : "opacity-0 scale-90 pointer-events-none"
                )}
            >
                <ul className="py-1">
                    {SORT_OPTIONS.map(({ label, value: optValue }) => {
                        const isSelected = optValue === value;
                        return (
                            <li
                                key={optValue}
                                onClick={() => handleSelect(optValue)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 cursor-pointer",
                                    "text-[15px]",
                                    "transition-colors",
                                    "hover:bg-primary/5",
                                    isSelected && "text-primary"
                                )}
                            >
                                <Check
                                    className={cn(
                                        "w-4 h-4 transition-opacity",
                                        isSelected ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <span>{label}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
};
