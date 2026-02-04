import * as React from 'react'
import { cn } from '@/lib/utils'

interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onCheckedChange, disabled = false, className }, ref) => {
    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        data-state={checked ? 'checked' : 'unchecked'}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-inner transition-all duration-300 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'hover:shadow-md',
          checked ? 'bg-teal-500 shadow-teal-500/20' : 'bg-slate-200',
          className
        )}
      >
        <span
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-all duration-300 ease-out',
            checked ? 'translate-x-5 scale-100' : 'translate-x-0 scale-95',
            checked && 'shadow-teal-600/20'
          )}
        >
          {/* Checkmark inside thumb when checked */}
          <svg
            className={cn(
              'w-full h-full p-1 transition-all duration-200',
              checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" className="text-teal-500" />
          </svg>
        </span>
      </button>
    )
  }
)
Switch.displayName = 'Switch'

export { Switch }
