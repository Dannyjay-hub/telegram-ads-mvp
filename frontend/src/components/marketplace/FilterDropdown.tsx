import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import { haptic } from '@/utils/haptic'
import {
    CATEGORY_OPTIONS,
    LANGUAGE_OPTIONS,
    SUBSCRIBER_PRESETS,
    PRICE_PRESETS,
} from '@/hooks/useMarketplaceFilters'

interface FilterDropdownProps {
    categories: string[]
    languages: string[]
    subscribers: [number, number] | null
    price: [number, number] | null
    onToggleCategory: (category: string) => void
    onToggleLanguage: (language: string) => void
    onSetSubscribers: (range: [number, number] | null) => void
    onSetPrice: (range: [number, number] | null) => void
    onClearAll: () => void
}

/**
 * FilterDropdown - P2P style filter dropdown with all filter options
 * Opens from a button, shows categories, languages, subscribers, price
 */
export function FilterDropdown({
    categories,
    languages,
    subscribers,
    price,
    onToggleCategory,
    onToggleLanguage,
    onSetSubscribers,
    onSetPrice,
    onClearAll,
}: FilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Count active filters for badge
    const activeCount =
        categories.length +
        languages.length +
        (subscribers ? 1 : 0) +
        (price ? 1 : 0)

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return

        const handleClickOutside = (event: PointerEvent) => {
            const target = event.target as Node
            if (
                triggerRef.current?.contains(target) ||
                dropdownRef.current?.contains(target)
            ) {
                return
            }
            setIsOpen(false)
        }

        document.addEventListener('pointerdown', handleClickOutside, true)
        return () => {
            document.removeEventListener('pointerdown', handleClickOutside, true)
        }
    }, [isOpen])

    // Helper for subscriber key comparison
    const getSubscriberKey = () => {
        if (!subscribers) return null
        return `${subscribers[0]}-${subscribers[1]}`
    }

    const getPriceKey = () => {
        if (!price) return null
        return `${price[0]}-${price[1]}`
    }

    return (
        <div className="relative">
            {/* Trigger Button */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                    haptic.soft()
                    setIsOpen(!isOpen)
                }}
                className={cn(
                    'flex items-center gap-2 px-3 h-[36px] rounded-[10px]',
                    'text-[14px] font-medium',
                    'bg-[--tg-theme-secondary-bg-color] border transition-all duration-200',
                    'active:scale-[0.97]',
                    activeCount > 0
                        ? 'text-[--tg-theme-button-color] border-[--tg-theme-button-color]/30'
                        : 'text-[--tg-theme-text-color] border-transparent',
                    isOpen && 'border-[--tg-theme-button-color]/50'
                )}
            >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filter</span>
                {activeCount > 0 && (
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[--tg-theme-button-color] text-white text-xs font-bold">
                        {activeCount}
                    </span>
                )}
                <ChevronDown
                    className={cn(
                        'w-4 h-4 transition-transform duration-200',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>

            {/* Dropdown Panel */}
            <div
                ref={dropdownRef}
                className={cn(
                    'absolute top-[calc(100%+8px)] left-0',
                    'w-[300px] max-h-[70vh] overflow-y-auto',
                    'rounded-[12px]',
                    'bg-[--tg-theme-secondary-bg-color] border border-[--tg-theme-hint-color]/20',
                    'shadow-xl',
                    'transition-all duration-200 origin-top-left',
                    isOpen
                        ? 'opacity-100 scale-100 z-[100]'
                        : 'opacity-0 scale-[0.95] z-0 pointer-events-none'
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[--tg-theme-hint-color]/10">
                    <span className="text-[16px] font-semibold text-[--tg-theme-text-color]">
                        Filters
                    </span>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 rounded-full hover:bg-[--tg-theme-hint-color]/10"
                    >
                        <X className="w-5 h-5 text-[--tg-theme-hint-color]" />
                    </button>
                </div>

                <div className="p-4 space-y-5">
                    {/* Categories Section */}
                    <FilterSection title="CATEGORIES">
                        <div className="flex flex-wrap gap-2">
                            {CATEGORY_OPTIONS.map(cat => (
                                <FilterChip
                                    key={cat}
                                    label={cat}
                                    selected={categories.includes(cat)}
                                    onClick={() => onToggleCategory(cat)}
                                />
                            ))}
                        </div>
                    </FilterSection>

                    {/* Languages Section */}
                    <FilterSection title="LANGUAGES">
                        <div className="flex flex-wrap gap-2">
                            {LANGUAGE_OPTIONS.map(lang => (
                                <FilterChip
                                    key={lang}
                                    label={lang}
                                    selected={languages.includes(lang)}
                                    onClick={() => onToggleLanguage(lang)}
                                />
                            ))}
                        </div>
                    </FilterSection>

                    {/* Subscribers Section */}
                    <FilterSection title="SUBSCRIBERS">
                        <div className="flex flex-wrap gap-2">
                            {SUBSCRIBER_PRESETS.map(preset => {
                                const key = preset.value
                                    ? `${preset.value[0]}-${preset.value[1]}`
                                    : null
                                const isSelected = getSubscriberKey() === key
                                return (
                                    <FilterChip
                                        key={preset.label}
                                        label={preset.label}
                                        selected={isSelected}
                                        onClick={() => onSetSubscribers(preset.value)}
                                    />
                                )
                            })}
                        </div>
                    </FilterSection>

                    {/* Price Section */}
                    <FilterSection title="PRICE (TON)">
                        <div className="flex flex-wrap gap-2">
                            {PRICE_PRESETS.map(preset => {
                                const key = preset.value
                                    ? `${preset.value[0]}-${preset.value[1]}`
                                    : null
                                const isSelected = getPriceKey() === key
                                return (
                                    <FilterChip
                                        key={preset.label}
                                        label={preset.label}
                                        selected={isSelected}
                                        onClick={() => onSetPrice(preset.value)}
                                    />
                                )
                            })}
                        </div>
                    </FilterSection>
                </div>

                {/* Footer - Clear All */}
                {activeCount > 0 && (
                    <div className="px-4 py-3 border-t border-[--tg-theme-hint-color]/10">
                        <button
                            onClick={() => {
                                haptic.soft()
                                onClearAll()
                            }}
                            className="w-full py-2.5 text-center text-[--tg-theme-button-color] font-medium rounded-lg hover:bg-[--tg-theme-button-color]/10 transition-colors"
                        >
                            Clear All
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============ Helper Components ============

function FilterSection({
    title,
    children,
}: {
    title: string
    children: React.ReactNode
}) {
    return (
        <div>
            <p className="text-[11px] font-semibold text-[--tg-theme-hint-color] tracking-wider mb-2">
                {title}
            </p>
            {children}
        </div>
    )
}

function FilterChip({
    label,
    selected,
    onClick,
}: {
    label: string
    selected: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={() => {
                haptic.soft()
                onClick()
            }}
            className={cn(
                'px-3 py-1.5 rounded-full text-[13px] font-medium',
                'border transition-all duration-150',
                'active:scale-[0.95]',
                selected
                    ? 'bg-[--tg-theme-button-color]/15 text-[--tg-theme-button-color] border-[--tg-theme-button-color]/40'
                    : 'bg-transparent text-[--tg-theme-text-color] border-[--tg-theme-hint-color]/30'
            )}
        >
            {label}
        </button>
    )
}

// ============ Active Filter Chips (shown below filter bar) ============

interface ActiveFilterChipsProps {
    categories: string[]
    languages: string[]
    subscribers: [number, number] | null
    price: [number, number] | null
    onRemoveCategory: (category: string) => void
    onRemoveLanguage: (language: string) => void
    onClearSubscribers: () => void
    onClearPrice: () => void
}

export function ActiveFilterChips({
    categories,
    languages,
    subscribers,
    price,
    onRemoveCategory,
    onRemoveLanguage,
    onClearSubscribers,
    onClearPrice,
}: ActiveFilterChipsProps) {
    const hasAny =
        categories.length > 0 ||
        languages.length > 0 ||
        subscribers !== null ||
        price !== null

    if (!hasAny) return null

    // Find labels for subscriber/price
    const subscriberLabel = subscribers
        ? SUBSCRIBER_PRESETS.find(
            p => p.value && p.value[0] === subscribers[0] && p.value[1] === subscribers[1]
        )?.label
        : null

    const priceLabel = price
        ? PRICE_PRESETS.find(
            p => p.value && p.value[0] === price[0] && p.value[1] === price[1]
        )?.label
        : null

    return (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map(cat => (
                <RemovableChip
                    key={cat}
                    label={cat}
                    onRemove={() => onRemoveCategory(cat)}
                />
            ))}
            {languages.map(lang => (
                <RemovableChip
                    key={lang}
                    label={lang}
                    onRemove={() => onRemoveLanguage(lang)}
                />
            ))}
            {subscriberLabel && (
                <RemovableChip
                    label={subscriberLabel}
                    onRemove={onClearSubscribers}
                />
            )}
            {priceLabel && (
                <RemovableChip
                    label={`${priceLabel} TON`}
                    onRemove={onClearPrice}
                />
            )}
        </div>
    )
}

function RemovableChip({
    label,
    onRemove,
}: {
    label: string
    onRemove: () => void
}) {
    return (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[--tg-theme-button-color]/15 text-[--tg-theme-button-color] text-[12px] font-medium whitespace-nowrap">
            <span>{label}</span>
            <button
                onClick={() => {
                    haptic.soft()
                    onRemove()
                }}
                className="p-0.5 rounded-full hover:bg-[--tg-theme-button-color]/20"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    )
}
