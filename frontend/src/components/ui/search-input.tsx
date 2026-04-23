import * as React from "react"
import { cn } from "@/lib/utils"
import { Search, X } from "lucide-react"

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value: string;
    onChange: (value: string) => void;
    onClear?: () => void;
}

/**
 * SearchInput - Telegram-style search input
 * Uses fill-secondary background with search icon and clear button
 */
const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
    ({ className, value, onChange, onClear, placeholder = "Search...", ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange(e.target.value);
        };

        const handleClear = () => {
            onChange('');
            onClear?.();
        };

        return (
            <div className={cn(
                "relative flex items-center",
                className
            )}>
                <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                    ref={ref}
                    type="text"
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className={cn(
                        "w-full h-[36px] pl-9 pr-9 rounded-[10px] text-[15px]",
                        "bg-[var(--fill-secondary)] border-0",
                        "text-foreground placeholder:text-muted-foreground",
                        "focus:outline-none focus:ring-2 focus:ring-primary/30",
                        "transition-all duration-200"
                    )}
                    {...props}
                />
                {value && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                )}
            </div>
        );
    }
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
