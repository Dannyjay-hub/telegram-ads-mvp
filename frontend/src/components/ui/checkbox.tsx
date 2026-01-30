import * as React from "react"
import { cn } from "@/lib/utils"
import { haptic } from "@/utils/haptic"

// Simplified Checkbox for MVP without Radix dependency if possible, 
// using vanilla React state or just styling an input type=checkbox hidden? 
// actually let's just make a stylized wrapper around input or a button.
// For speed and robustness without installing @radix-ui/react-checkbox:

const Checkbox = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(({ className, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        haptic.soft(); // Soft haptic for toggle-like interactions
        onChange?.(e);
    };

    return (
        <input
            type="checkbox"
            ref={ref}
            onChange={handleChange}
            className={cn(
                "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground accent-primary",
                className
            )}
            {...props}
        />
    );
})
Checkbox.displayName = "Checkbox"

export { Checkbox }

