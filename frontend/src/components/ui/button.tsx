import * as React from "react"
import { cn } from "@/lib/utils"
import { haptic } from "@/utils/haptic"

/**
 * Button Component - Telegram Design System
 * Based on official Telegram Mini Apps styling:
 * - Default height: 50px (tg-standard) or 44px (compact)
 * - Border radius: 14px
 * - Font: 17px semibold
 */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'accent';
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
                    // Base styles - Telegram design system
                    "inline-flex items-center justify-center rounded-[14px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
                    {
                        // Primary - Telegram Blue solid button
                        "bg-primary text-primary-foreground hover:bg-primary/90": variant === "default",
                        // Secondary/Accent - 10% of primary color fill
                        "bg-primary/10 text-primary hover:bg-primary/20": variant === "secondary" || variant === "accent",
                        // Outline - Subtle border
                        "border border-border bg-transparent hover:bg-card text-foreground": variant === "outline",
                        // Ghost - No background
                        "hover:bg-card text-foreground": variant === "ghost",
                        // Destructive - Red 10% fill with red text
                        "bg-destructive/10 text-destructive hover:bg-destructive/20": variant === "destructive",
                        // Sizes - Telegram standard
                        "h-[50px] px-4 text-[17px]": size === "default", // Telegram standard button
                        "h-[44px] px-3 text-[15px]": size === "sm", // Compact button
                        "h-[56px] px-6 text-[17px]": size === "lg", // Large button
                        "h-[44px] w-[44px] rounded-[12px]": size === "icon", // Icon button
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
