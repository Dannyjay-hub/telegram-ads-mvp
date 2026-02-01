/**
 * Card Components - Telegram Design System
 * Based on official Telegram Mini Apps:
 * - Solid section backgrounds (no glassmorphism)
 * - 14px border radius
 * - Subtle border on dark mode
 */

import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("rounded-[14px] border border-border/50 bg-card text-card-foreground", className)}
            {...props}
        />
    )
)
Card.displayName = "Card"

/**
 * GlassCard - Now uses Telegram Section styling (solid background, no blur)
 * Kept name for backward compatibility
 */
const GlassCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("rounded-[14px] bg-card border border-border/50 text-foreground", className)}
            {...props}
        />
    )
)
GlassCard.displayName = "GlassCard"

/**
 * TelegramSection - Official Telegram section card
 */
const TelegramSection = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("rounded-[14px] bg-card p-4 text-foreground", className)}
            {...props}
        />
    )
)
TelegramSection.displayName = "TelegramSection"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("flex flex-col space-y-1.5 p-4", className)} {...props} />
    )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3 ref={ref} className={cn("text-[17px] font-semibold leading-tight", className)} {...props} />
    )
)
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
    )
)
CardContent.displayName = "CardContent"

export { Card, GlassCard, TelegramSection, CardHeader, CardTitle, CardContent }
