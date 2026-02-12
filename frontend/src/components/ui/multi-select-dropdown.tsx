import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { Label } from '@/components/ui/label'

interface MultiSelectDropdownProps {
    label: string
    required?: boolean
    options: string[]
    selected: string[]
    onToggle: (value: string) => void
    onRemove: (value: string) => void
}

export function MultiSelectDropdown({ label, required, options, selected, onToggle, onRemove }: MultiSelectDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    return (
        <div className="space-y-2" ref={dropdownRef}>
            <Label>
                {label} {required && <span className="text-red-400">*</span>}
            </Label>

            {/* Selected chips */}
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selected.map(item => (
                        <span
                            key={item}
                            className="inline-flex items-center gap-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-medium px-2.5 py-1 rounded-full"
                        >
                            {item}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onRemove(item)
                                }}
                                className="hover:text-foreground transition-colors ml-0.5"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Dropdown trigger */}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary border border-border hover:border-border/80 transition-colors text-sm"
                >
                    <span className="text-muted-foreground">
                        {selected.length === 0
                            ? `Select ${label.toLowerCase()}...`
                            : `${selected.length} selected`
                        }
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown menu */}
                {isOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-popover border border-border shadow-xl">
                        {options.map(option => {
                            const isSelected = selected.includes(option)
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => onToggle(option)}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${isSelected
                                        ? 'bg-blue-600/20 text-blue-400'
                                        : 'text-foreground/80 hover:bg-accent'
                                        }`}
                                >
                                    <span className="flex items-center justify-between">
                                        {option}
                                        {isSelected && (
                                            <span className="text-blue-400 text-xs">✓</span>
                                        )}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
