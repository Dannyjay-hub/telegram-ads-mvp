import * as React from "react"
import { cn } from "@/lib/utils"
import { haptic } from "@/utils/haptic"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'ghost' | 'glass' | 'secondary';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    /** Haptic feedback style. Set to 'none' to disable. Default: 'light' */
    hapticStyle?: 'light' | 'soft' | 'medium' | 'heavy' | 'rigid' | 'none';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", hapticStyle = "light", onClick, ...props }, ref) => {
        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            // Trigger haptic feedback
            if (hapticStyle !== 'none') {
                haptic[hapticStyle]();
            }
            // Call original onClick handler
            onClick?.(e);
        };

        return (
            <button
                ref={ref}
                onClick={handleClick}
                className={cn(
                    "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-95",
                    {
                        "bg-primary text-primary-foreground shadow hover:bg-primary/90": variant === "default",
                        "bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === "secondary",
                        "border border-input bg-background/50 shadow-sm hover:bg-accent hover:text-accent-foreground": variant === "outline",
                        "hover:bg-accent hover:text-accent-foreground": variant === "ghost",
                        "glass hover:bg-white/20 dark:hover:bg-white/10 text-foreground": variant === "glass",
                        "h-9 px-4 py-2": size === "default",
                        "h-8 rounded-md px-3 text-xs": size === "sm",
                        "h-10 rounded-md px-8": size === "lg",
                        "h-9 w-9": size === "icon",
                    },
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }

