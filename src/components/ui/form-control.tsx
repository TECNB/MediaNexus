import * as React from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { cn } from '@/lib/utils'

type SelectControlProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string
  leadingIcon?: React.ReactNode
  leadingIconClassName?: string
  chevronClassName?: string
}

const selectClassName =
  'peer h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm font-medium text-slate-800 outline-none transition hover:border-slate-300 hover:bg-slate-50 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200/70 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400'

type SelectControlOption = {
  disabled: boolean
  label: string
  value: string
}

function getOptionLabel(children: React.ReactNode) {
  return React.Children.toArray(children)
    .map((child) =>
      typeof child === 'string' || typeof child === 'number' ? child : '',
    )
    .join('')
    .trim()
}

function getSelectOptions(children: React.ReactNode): SelectControlOption[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) {
      return []
    }

    if (child.type === React.Fragment) {
      return getSelectOptions(child.props.children)
    }

    if (child.type !== 'option') {
      return []
    }

    const label = getOptionLabel(child.props.children)
    return [
      {
        disabled: Boolean(child.props.disabled),
        label,
        value: String(child.props.value ?? label),
      },
    ]
  })
}

function getMenuPosition(trigger: HTMLButtonElement, optionCount: number) {
  const rect = trigger.getBoundingClientRect()
  const viewportGap = 12
  const menuHeight = Math.min(Math.max(optionCount * 36 + 18, 44), 260)
  const belowSpace = window.innerHeight - rect.bottom - viewportGap
  const openAbove = belowSpace < menuHeight && rect.top > belowSpace
  const maxHeight = Math.max(
    160,
    Math.min(
      menuHeight,
      openAbove
        ? rect.top - viewportGap * 2
        : window.innerHeight - rect.bottom - viewportGap * 2,
    ),
  )

  return {
    left: Math.min(
      Math.max(viewportGap, rect.left),
      window.innerWidth - rect.width - viewportGap,
    ),
    maxHeight,
    top: openAbove
      ? Math.max(viewportGap, rect.top - menuHeight - 6)
      : rect.bottom + 6,
    width: rect.width,
  }
}

const SelectControl = React.forwardRef<HTMLButtonElement, SelectControlProps>(
  (
    {
      className,
      wrapperClassName,
      leadingIcon,
      leadingIconClassName,
      chevronClassName,
      children,
      ...props
    },
    ref,
  ) => {
    const options = React.useMemo(() => getSelectOptions(children), [children])
    const controlledValue = props.value ?? props.defaultValue ?? ''
    const selectedOption =
      options.find((option) => option.value === String(controlledValue)) ??
      options[0]
    const [isOpen, setIsOpen] = React.useState(false)
    const [menuPosition, setMenuPosition] = React.useState<{
      left: number
      maxHeight: number
      top: number
      width: number
    } | null>(null)
    const triggerRef = React.useRef<HTMLButtonElement | null>(null)

    React.useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement)

    const updateMenuPosition = React.useCallback(() => {
      if (triggerRef.current) {
        setMenuPosition(getMenuPosition(triggerRef.current, options.length))
      }
    }, [options.length])

    React.useEffect(() => {
      if (!isOpen) {
        return
      }

      updateMenuPosition()

      const handlePointerDown = (event: PointerEvent) => {
        if (
          event.target instanceof Node &&
          !triggerRef.current?.parentElement?.contains(event.target) &&
          !document
            .getElementById(`${props.id ?? props.name ?? 'select'}-menu`)
            ?.contains(event.target)
        ) {
          setIsOpen(false)
        }
      }

      window.addEventListener('resize', updateMenuPosition)
      window.addEventListener('scroll', updateMenuPosition, true)
      document.addEventListener('pointerdown', handlePointerDown)

      return () => {
        window.removeEventListener('resize', updateMenuPosition)
        window.removeEventListener('scroll', updateMenuPosition, true)
        document.removeEventListener('pointerdown', handlePointerDown)
      }
    }, [isOpen, props.id, props.name, updateMenuPosition])

    const selectOption = React.useCallback(
      (value: string) => {
        const event = {
          currentTarget: { value },
          target: { value },
        } as React.ChangeEvent<HTMLSelectElement>

        props.onChange?.(event)
        setIsOpen(false)
        triggerRef.current?.focus()
      },
      [props],
    )

    const menuId = `${props.id ?? props.name ?? 'select'}-menu`

    return (
      <span className={cn('relative block', wrapperClassName)}>
        {leadingIcon ? (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-slate-400',
              leadingIconClassName,
            )}
          >
            {leadingIcon}
          </span>
        ) : null}
        <button
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={props['aria-label'] ?? selectedOption?.label}
          className={cn(
            selectClassName,
            leadingIcon ? 'pl-9' : null,
            className,
          )}
          disabled={props.disabled}
          id={props.id}
          name={props.name}
          onBlur={props.onBlur as React.FocusEventHandler<HTMLButtonElement>}
          onClick={() => {
            if (!props.disabled) {
              setIsOpen((value) => !value)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false)
              return
            }

            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setIsOpen(true)
            }
          }}
          ref={triggerRef}
          role="combobox"
          type="button"
        >
          <span className="block truncate text-left">
            {selectedOption?.label ?? ''}
          </span>
        </button>
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-slate-400 transition peer-disabled:text-slate-300',
            chevronClassName,
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </span>
        {isOpen && menuPosition
          ? createPortal(
              <div
                className="z-50 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-[0_18px_45px_rgb(15_23_42/0.16),0_1px_2px_rgb(15_23_42/0.08)]"
                id={menuId}
                role="listbox"
                style={{
                  left: menuPosition.left,
                  maxHeight: menuPosition.maxHeight,
                  position: 'fixed',
                  top: menuPosition.top,
                  width: menuPosition.width,
                }}
              >
                <div
                  className="max-h-[inherit] overflow-y-auto py-1"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {options.map((option) => {
                    const isSelected = option.value === selectedOption?.value

                    return (
                      <button
                        aria-selected={isSelected}
                        className={cn(
                          'flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300',
                          isSelected && 'bg-slate-100 text-slate-950',
                        )}
                        disabled={option.disabled}
                        key={option.value}
                        onClick={() => selectOption(option.value)}
                        role="option"
                        type="button"
                      >
                        <Check
                          className={cn(
                            'h-4 w-4 text-transparent',
                            isSelected && 'text-slate-950',
                          )}
                        />
                        <span className="truncate">{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>,
              document.body,
            )
          : null}
      </span>
    )
  },
)

SelectControl.displayName = 'SelectControl'

type DateControlProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  type?: 'date' | 'month'
  wrapperClassName?: string
  icon?: React.ReactNode
  iconClassName?: string
}

const dateInputClassName =
  'relative h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-left text-sm font-medium text-slate-950 outline-none transition hover:border-slate-300 hover:bg-slate-50 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200/70 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400'

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(
    date.getDate(),
  )}`
}

function formatMonthValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}`
}

function parseDateValue(value: unknown, type: 'date' | 'month') {
  if (typeof value !== 'string' || !value) {
    return new Date()
  }

  const parts = value.split('-').map(Number)
  if (parts.length < 2 || parts.some((part) => Number.isNaN(part))) {
    return new Date()
  }

  return new Date(parts[0], parts[1] - 1, type === 'date' ? parts[2] ?? 1 : 1)
}

function getDatePopoverPosition(
  trigger: HTMLButtonElement,
  type: 'date' | 'month',
) {
  const rect = trigger.getBoundingClientRect()
  const viewportGap = 12
  const width = type === 'date' ? 320 : 280
  const height = type === 'date' ? 368 : 300
  const belowSpace = window.innerHeight - rect.bottom - viewportGap
  const openAbove = belowSpace < height && rect.top > belowSpace

  return {
    left: Math.min(
      Math.max(viewportGap, rect.left),
      window.innerWidth - width - viewportGap,
    ),
    top: openAbove
      ? Math.max(viewportGap, rect.top - height - 6)
      : rect.bottom + 6,
    width,
  }
}

function getCalendarDays(viewDate: Date) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const start = new Date(year, month, 1 - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

const DateControl = React.forwardRef<HTMLButtonElement, DateControlProps>(
  (
    {
      className,
      wrapperClassName,
      icon,
      iconClassName,
      type = 'date',
      ...props
    },
    ref,
  ) => {
    const triggerRef = React.useRef<HTMLButtonElement | null>(null)
    const [isOpen, setIsOpen] = React.useState(false)
    const [viewDate, setViewDate] = React.useState(() =>
      parseDateValue(props.value ?? props.defaultValue, type),
    )
    const [popoverPosition, setPopoverPosition] = React.useState<{
      left: number
      top: number
      width: number
    } | null>(null)

    React.useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement)

    React.useEffect(() => {
      setViewDate(parseDateValue(props.value ?? props.defaultValue, type))
    }, [props.defaultValue, props.value, type])

    const updatePopoverPosition = React.useCallback(() => {
      if (triggerRef.current) {
        setPopoverPosition(getDatePopoverPosition(triggerRef.current, type))
      }
    }, [type])

    React.useEffect(() => {
      if (!isOpen) {
        return
      }

      updatePopoverPosition()

      const handlePointerDown = (event: PointerEvent) => {
        if (
          event.target instanceof Node &&
          !triggerRef.current?.parentElement?.contains(event.target) &&
          !document
            .getElementById(`${props.id ?? props.name ?? type}-picker`)
            ?.contains(event.target)
        ) {
          setIsOpen(false)
        }
      }

      window.addEventListener('resize', updatePopoverPosition)
      window.addEventListener('scroll', updatePopoverPosition, true)
      document.addEventListener('pointerdown', handlePointerDown)

      return () => {
        window.removeEventListener('resize', updatePopoverPosition)
        window.removeEventListener('scroll', updatePopoverPosition, true)
        document.removeEventListener('pointerdown', handlePointerDown)
      }
    }, [isOpen, props.id, props.name, type, updatePopoverPosition])

    const emitChange = React.useCallback(
      (value: string) => {
        const event = {
          currentTarget: { value },
          target: { value },
        } as React.ChangeEvent<HTMLInputElement>

        props.onChange?.(event)
      },
      [props],
    )

    const commitValue = React.useCallback(
      (value: string) => {
        emitChange(value)
        setIsOpen(false)
        triggerRef.current?.focus()
      },
      [emitChange],
    )

    const selectedValue =
      typeof props.value === 'string' && props.value
        ? props.value
        : typeof props.defaultValue === 'string' && props.defaultValue
          ? props.defaultValue
          : type === 'month'
            ? '选择月份'
            : '选择日期'
    const pickerId = `${props.id ?? props.name ?? type}-picker`

    return (
      <span className={cn('relative block', wrapperClassName)}>
        <button
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={props['aria-label'] ?? selectedValue}
          className={cn(dateInputClassName, className)}
          disabled={props.disabled}
          id={props.id}
          name={props.name}
          onBlur={props.onBlur as React.FocusEventHandler<HTMLButtonElement>}
          onClick={() => {
            if (!props.disabled) {
              setIsOpen((value) => !value)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false)
            }
          }}
          ref={triggerRef}
          type="button"
        >
          {selectedValue}
        </button>
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-slate-400',
            iconClassName,
          )}
        >
          {icon ?? <CalendarDays className="h-4 w-4" />}
        </span>
        {isOpen && popoverPosition
          ? createPortal(
              <div
                className="z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgb(15_23_42/0.16),0_1px_2px_rgb(15_23_42/0.08)]"
                id={pickerId}
                role="dialog"
                style={{
                  left: popoverPosition.left,
                  position: 'fixed',
                  top: popoverPosition.top,
                  width: popoverPosition.width,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="h-8 rounded-lg px-2 text-sm font-semibold text-slate-950 hover:bg-slate-100"
                    onClick={() =>
                      setViewDate((current) =>
                        new Date(
                          current.getFullYear() - (type === 'month' ? 1 : 0),
                          current.getMonth() - (type === 'date' ? 1 : 0),
                          1,
                        ),
                      )
                    }
                    type="button"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-sm font-semibold text-slate-950">
                    {type === 'month'
                      ? `${viewDate.getFullYear()} 年`
                      : `${viewDate.getFullYear()} 年 ${viewDate.getMonth() + 1} 月`}
                  </div>
                  <button
                    className="h-8 rounded-lg px-2 text-sm font-semibold text-slate-950 hover:bg-slate-100"
                    onClick={() =>
                      setViewDate((current) =>
                        new Date(
                          current.getFullYear() + (type === 'month' ? 1 : 0),
                          current.getMonth() + (type === 'date' ? 1 : 0),
                          1,
                        ),
                      )
                    }
                    type="button"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {type === 'date' ? (
                  <>
                    <div className="mt-3 grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
                      {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
                        <span className="py-2" key={day}>
                          {day}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {getCalendarDays(viewDate).map((date) => {
                        const value = formatDateValue(date)
                        const isSelected = value === props.value
                        const isMuted = date.getMonth() !== viewDate.getMonth()

                        return (
                          <button
                            className={cn(
                              'h-9 rounded-lg text-sm font-medium text-slate-700 transition hover:bg-slate-100',
                              isMuted && 'text-slate-300',
                              isSelected &&
                                'bg-slate-950 text-white hover:bg-slate-900',
                            )}
                            key={value}
                            onClick={() => commitValue(value)}
                            type="button"
                          >
                            {date.getDate()}
                          </button>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {Array.from({ length: 12 }, (_, index) => {
                      const date = new Date(viewDate.getFullYear(), index, 1)
                      const value = formatMonthValue(date)
                      const isSelected = value === props.value

                      return (
                        <button
                          className={cn(
                            'h-10 rounded-lg text-sm font-medium text-slate-700 transition hover:bg-slate-100',
                            isSelected &&
                              'bg-slate-950 text-white hover:bg-slate-900',
                          )}
                          key={value}
                          onClick={() => commitValue(value)}
                          type="button"
                        >
                          {index + 1} 月
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <button
                    className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                    onClick={() => commitValue('')}
                    type="button"
                  >
                    清除
                  </button>
                  <button
                    className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-950 hover:bg-slate-100"
                    onClick={() => {
                      const today = new Date()
                      commitValue(
                        type === 'month'
                          ? formatMonthValue(today)
                          : formatDateValue(today),
                      )
                    }}
                    type="button"
                  >
                    今天
                  </button>
                </div>
              </div>,
              document.body,
            )
          : null}
      </span>
    )
  },
)

DateControl.displayName = 'DateControl'

export { DateControl, SelectControl }
