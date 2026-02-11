# Telegram Design System Analysis Report

## Executive Summary

This report analyzes the design systems used across 4 official Telegram mini apps to extract the consistent design tokens, patterns, and styling conventions used throughout the Telegram ecosystem.

---

## Color Palette

### Primary Colors (Consistent Across All Apps)

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| **Primary Blue** | `#007AFF` | `#0A84FF` | Primary buttons, links, accents |
| **Destructive Red** | `#FF3B30` | `#FF453A` | Delete, error, destructive actions |
| **Success Green** | `#34C759` | `#30D158` | Success states, confirmations |
| **Warning Orange** | `#FF9500` | `#FF9F0A` | Warning states |

### Grey Scale (iOS System Colors)

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| **Grey 1** | `#8E8E93` | `#8E8E93` |
| **Grey 2** | `#AEAEB2` | `#636366` |
| **Grey 3** | `#C7C7CC` | `#48484A` |
| **Grey 4** | `#D1D1D6` | `#3A3A3C` |
| **Grey 5** | `#E5E5EA` | `#2C2C2E` |
| **Grey 6** | `#F2F2F7` | `#1C1C1E` |

### Background Colors

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| **Background Base** | `#FFFFFF` | `#000000` |
| **Background Secondary** | `#F2F2F7` (Grey 6) | `#1C1C1E` |
| **Section Background** | `#FFFFFF` | `#1C1C1D` |
| **Fill Secondary** | `rgba(116,116,128,0.16)` | Same |
| **Fill Tertiary** | `rgba(116,116,128,0.12)` | Same |
| **Fill Quaternary** | `rgba(116,116,128,0.08)` | Same |

### Semantic Colors

| Purpose | Value |
|---------|-------|
| **Button Confirm** | `#2FB250` (Green) |
| **Toast Link** | `#5AC8FA` (Light Blue) |
| **Toast Background** | `rgba(45,45,45,0.8)` |
| **Border Separator Light** | `rgba(198,198,200,1)` |
| **Border Separator Dark** | `rgba(58,58,60,1)` |

---

## Typography

### Font Families

```css
--font-base: -apple-system, "SF Pro Text", "SF UI Text", system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif;
--font-rounded: "SF Pro Rounded"; /* Used for bold numbers/titles */
```

### Font Sizes

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| **XS** | 11px | 13px | Labels, captions |
| **SM** | 13px | 18px | Secondary text |
| **SM Bold** | 15px | 20px | Subheadlines |
| **Base** | 17px | 22px | Body text (primary) |
| **Title** | 28px | 38px | Page titles |
| **Big Title** | 64px | 72px | Hero numbers |

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Regular | 400 | Body text |
| Medium | 500 | Emphasized text |
| Semibold | 590-600 | Buttons |
| Bold | 700 | Titles |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| **rounded-sm** | 4px | Small elements |
| **rounded-md** | 6px | Inputs, small buttons |
| **rounded-lg** | 9px | Cards, sections |
| **rounded-button** | 14px | Primary buttons |
| **rounded-full** | 30px | Pill buttons |

---

## Spacing & Sizing

### Button Sizes

| Size | Height | Padding | Font |
|------|--------|---------|------|
| **Standard** | 50px | 16px horizontal | 17px |
| **Compact** | 44px | 12px horizontal | 15px |

### Common Spacing

| Token | Value |
|-------|-------|
| **padding-page** | 16px (horizontal) |
| **padding-section** | 24px (vertical) |
| **gap-items** | 8px - 12px |

---

## Button Styles

### Primary Button
```css
background-color: var(--tg-theme-button-color, #007AFF);
color: var(--tg-theme-button-text-color, #FFFFFF);
border-radius: 14px;
height: 50px;
font-size: 17px;
font-weight: 590;
```

### Secondary Button
```css
background-color: rgba(0, 122, 255, 0.1); /* 10% of primary */
color: #007AFF;
border-radius: 14px;
height: 50px;
```

### Destructive Button
```css
background-color: rgba(255, 59, 48, 0.1);
color: #FF3B30;
border-radius: 14px;
```

### Pill Button (Wallet, etc.)
```css
background-color: rgba(116, 116, 128, 0.16);
border-radius: 30px;
padding: 5px 10px;
backdrop-filter: blur(15px);
```

---

## Z-Index Hierarchy

| Layer | Z-Index |
|-------|---------|
| Base | 0 |
| Content | 1 |
| Overlay | 10 |
| Dropdown | 100 |
| Tooltip | 200 |
| Modal | 300 |
| Sheet | 400 |
| Toast | 500 |
| Loading | 1000 |
| Navigation | 1100 |
| Fullscreen | 2000 |

---

## Shadows & Effects

### Tab Shadow
```css
box-shadow: 0px 3px 8px rgba(0, 0, 0, 0.12), 0px 3px 1px rgba(0, 0, 0, 0.04);
```

### Quick Menu Shadow
```css
box-shadow: 0px 4px 24px rgba(0, 0, 0, 0.16);
backdrop-filter: blur(15px);
```

### Elevation (Cards)
```css
/* Light */
box-shadow: 0px 10px 60px rgba(0, 0, 0, 0.1);
/* Dark */
box-shadow: 0px 10px 60px rgba(0, 0, 0, 0.7);
```

---

## Key Design Patterns

### 1. Solid Colors Over Gradients
All reference apps use **solid, flat colors** for buttons and UI elements. Gradients are only used for:
- Timer text (decorative)
- Special promotional elements

### 2. Telegram Theme Variables
All apps leverage Telegram's native theme variables:
```css
var(--tg-theme-button-color)      /* Primary accent */
var(--tg-theme-button-text-color) /* Button text */
var(--tg-theme-accent-text-color) /* Links */
var(--tg-theme-hint-color)        /* Secondary text */
var(--tg-theme-destructive-text-color) /* Errors */
```

### 3. iOS Human Interface Guidelines
The apps follow iOS design conventions:
- 50px button heights
- 14px border radius for buttons
- SF Pro system font
- Semi-transparent fill backgrounds

### 4. Dark Mode Implementation
Using `[data-theme="dark"]` attribute on body with CSS variable overrides.

---

## Recommendations for Our App

### Immediate Changes
1. **Replace gradient text** with solid blue (`#007AFF`)
2. **Update buttons** to 14px radius, 50px height
3. **Remove glassmorphism** - use solid section backgrounds
4. **Adopt Telegram theme variables** for dynamic theming
5. **Update color palette** to match iOS system colors

### CSS Variable Migration
Replace our current variables with Telegram-compatible tokens that fall back to our defaults if not in Telegram context.
