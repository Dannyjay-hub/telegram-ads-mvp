import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, Check } from 'lucide-react'
import { haptic } from '@/utils/haptic'

interface Option {
    label: string
    value: string
}

interface SelectFilterProps {
    label: string
    options: Option[]
    value: string | null
    onChange: (value: string | null) => void
    className?: string
}

/**
 * SelectFilter - Native-feeling dropdown filter matching Telegram's design
 * Based on access-tool's Dropdown component
 */
export function SelectFilter({
    label,
    options,
    value,
    onChange,
    className,
}: SelectFilterProps) {
    const [isOpen, setIsOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

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

    const selectedOption = options.find(o => o.value === value)
    const displayLabel = selectedOption ? selectedOption.label : label

    const handleSelect = (optionValue: string) => {
        haptic.soft()
        // Toggle off if same value selected
        if (value === optionValue) {
            onChange(null)
        } else {
            onChange(optionValue)
        }
        setIsOpen(false)
    }

    return (
        <div className={cn('relative', className)}>
            {/* Trigger Button */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                    haptic.soft()
                    setIsOpen(!isOpen)
                }}
                className={cn(
                    'flex items-center gap-1.5 px-3 h-[34px] rounded-[10px]',
                    'text-[14px] font-medium whitespace-nowrap',
                    'border transition-all duration-200',
                    'active:scale-[0.97]',
                    value
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-[--tg-theme-secondary-bg-color] text-[--tg-theme-text-color] border-transparent',
                    isOpen && 'border-primary/50'
                )}
            >
                <span className="max-w-[120px] truncate">{displayLabel}</span>
                <ChevronDown
                    className={cn(
                        'w-4 h-4 transition-transform duration-200',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>

            {/* Dropdown */}
            <div
                ref={dropdownRef}
                className={cn(
                    'absolute top-[calc(100%+8px)] left-0',
                    'min-w-[180px] max-w-[280px]',
                    'rounded-[12px] overflow-hidden',
                    'bg-[--tg-theme-secondary-bg-color]/95 backdrop-blur-[25px]',
                    'shadow-[0_4px_40px_rgba(0,0,0,0.2)]',
                    'transition-all duration-200 origin-top-left',
                    isOpen
                        ? 'opacity-100 scale-100 z-50'
                        : 'opacity-0 scale-[0.3] z-0 pointer-events-none'
                )}
            >
                <ul className="list-none m-0 p-0">
                    {options.map(({ label: optLabel, value: optValue }) => {
                        const isSelected = value === optValue

                        return (
                            <li
                                key={optValue}
                                onClick={() => handleSelect(optValue)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-[11px]',
                                    'cursor-pointer whitespace-nowrap',
                                    'border-b border-[--tg-theme-hint-color]/10 last:border-b-0',
                                    'active:bg-[--tg-theme-hint-color]/10'
                                )}
                            >
                                <Check
                                    className={cn(
                                        'w-4 h-4 text-[--tg-theme-link-color]',
                                        'transition-opacity duration-150',
                                        isSelected ? 'opacity-100' : 'opacity-0'
                                    )}
                                />
                                <span
                                    className={cn(
                                        'text-[15px]',
                                        isSelected
                                            ? 'text-[--tg-theme-link-color] font-medium'
                                            : 'text-[--tg-theme-text-color]'
                                    )}
                                >
                                    {optLabel}
                                </span>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </div>
    )
}

interface MultiSelectFilterProps {
    label: string
    options: Option[]
    value: string[]
    onToggle: (value: string) => void
    className?: string
}

/**
 * MultiSelectFilter - Multi-select dropdown for categories/languages
 */
export function MultiSelectFilter({
    label,
    options,
    value,
    onToggle,
    className,
}: MultiSelectFilterProps) {
    const [isOpen, setIsOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

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

    const hasSelection = value.length > 0
    const displayLabel = hasSelection
        ? value.length === 1
            ? options.find(o => o.value === value[0])?.label || label
            : `${label} (${value.length})`
        : label

    const handleToggle = (optionValue: string) => {
        haptic.soft()
        onToggle(optionValue)
        // Don't close - allow multiple selections
    }

    return (
        <div className={cn('relative', className)}>
            {/* Trigger Button */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                    haptic.soft()
                    setIsOpen(!isOpen)
                }}
                className={cn(
                    'flex items-center gap-1.5 px-3 h-[34px] rounded-[10px]',
                    'text-[14px] font-medium whitespace-nowrap',
                    'border transition-all duration-200',
                    'active:scale-[0.97]',
                    hasSelection
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-[--tg-theme-secondary-bg-color] text-[--tg-theme-text-color] border-transparent',
                    isOpen && 'border-primary/50'
                )}
            >
                <span className="max-w-[120px] truncate">{displayLabel}</span>
                <ChevronDown
                    className={cn(
                        'w-4 h-4 transition-transform duration-200',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>

            {/* Dropdown */}
            <div
                ref={dropdownRef}
                className={cn(
                    'absolute top-[calc(100%+8px)] left-0',
                    'min-w-[180px] max-w-[280px] max-h-[300px] overflow-y-auto',
                    'rounded-[12px]',
                    'bg-[--tg-theme-secondary-bg-color]/95 backdrop-blur-[25px]',
                    'shadow-[0_4px_40px_rgba(0,0,0,0.2)]',
                    'transition-all duration-200 origin-top-left',
                    isOpen
                        ? 'opacity-100 scale-100 z-50'
                        : 'opacity-0 scale-[0.3] z-0 pointer-events-none'
                )}
            >
                <ul className="list-none m-0 p-0">
                    {options.map(({ label: optLabel, value: optValue }) => {
                        const isSelected = value.includes(optValue)

                        return (
                            <li
                                key={optValue}
                                onClick={() => handleToggle(optValue)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-[11px]',
                                    'cursor-pointer whitespace-nowrap',
                                    'border-b border-[--tg-theme-hint-color]/10 last:border-b-0',
                                    'active:bg-[--tg-theme-hint-color]/10'
                                )}
                            >
                                <div
                                    className={cn(
                                        'w-5 h-5 rounded-md border-2 flex items-center justify-center',
                                        'transition-all duration-150',
                                        isSelected
                                            ? 'bg-primary border-primary'
                                            : 'border-[--tg-theme-hint-color]/40'
                                    )}
                                >
                                    {isSelected && (
                                        <Check className="w-3 h-3 text-white" />
                                    )}
                                </div>
                                <span
                                    className={cn(
                                        'text-[15px]',
                                        isSelected
                                            ? 'text-[--tg-theme-text-color] font-medium'
                                            : 'text-[--tg-theme-text-color]'
                                    )}
                                >
                                    {optLabel}
                                </span>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </div>
    )
}
