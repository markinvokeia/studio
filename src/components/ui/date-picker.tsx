"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CalendarIcon } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { useLocale, useTranslations } from "next-intl"
import { enUS, es } from 'date-fns/locale'
import { format, parse, setMonth } from "date-fns"
import { Locale } from "date-fns"

import { cn, formatDate, formatDisplayDate } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const LOCALES = {
  en: enUS,
  es: es,
}

type DatePickerView = "days" | "months" | "years"

export type DatePickerProps = React.ComponentProps<typeof DayPicker> & {
  translationsNamespace?: string
  placeholder?: string
}

function CustomCaption({
  view,
  setView,
  currentMonth,
  setCurrentMonth,
  monthNames,
  t,
}: {
  view: DatePickerView
  setView: React.Dispatch<React.SetStateAction<DatePickerView>>
  currentMonth: Date
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>
  monthNames: string[]
  t: (key: string) => string
}) {
  const decadeStart = Math.floor(currentMonth.getFullYear() / 10) * 10
  const decadeEnd = decadeStart + 9

  const handlePrevious = () => {
    const newDate = new Date(currentMonth)
    if (view === "days") {
      newDate.setMonth(newDate.getMonth() - 1)
    } else if (view === "months") {
      newDate.setFullYear(newDate.getFullYear() - 1)
    } else if (view === "years") {
      newDate.setFullYear(newDate.getFullYear() - 10)
    }
    setCurrentMonth(newDate)
  }

  const handleNext = () => {
    const newDate = new Date(currentMonth)
    if (view === "days") {
      newDate.setMonth(newDate.getMonth() + 1)
    } else if (view === "months") {
      newDate.setFullYear(newDate.getFullYear() + 1)
    } else if (view === "years") {
      newDate.setFullYear(newDate.getFullYear() + 10)
    }
    setCurrentMonth(newDate)
  }

  const handleViewChange = () => {
    if (view === "days") setView("months")
    else if (view === "months") setView("years")
    else setView("days")
  }

  return (
    <div className="flex justify-center pt-1 relative items-center">
      <button
        type="button"
        onClick={handlePrevious}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={handleViewChange}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 px-2 text-sm font-medium hover:bg-accent"
        )}
      >
        {view === "days" && `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`}
        {view === "months" && currentMonth.getFullYear().toString()}
        {view === "years" && `${decadeStart}-${decadeEnd}`}
      </button>

      <button
        type="button"
        onClick={handleNext}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function DatePicker({
  className,
  classNames,
  showOutsideDays = true,
  translationsNamespace = "DatePicker",
  placeholder,
  ...props
}: DatePickerProps) {
  const locale = useLocale()
  const t = useTranslations(translationsNamespace)
  const dateLocale = LOCALES[locale as keyof typeof LOCALES] || enUS

  const [view, setView] = React.useState<DatePickerView>("days")
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => {
    if (props.selected instanceof Date) return props.selected
    return new Date()
  })

  const monthLocale = locale === "es" ? es : enUS

  // Nombres de meses
  const monthNames = React.useMemo(() => {
    const baseDate = new Date(2024, 0, 1)
    return Array.from({ length: 12 }, (_, i) => {
      return format(setMonth(baseDate, i), "MMMM", { locale: monthLocale as Locale })
    })
  }, [monthLocale])

  // Década para vista de años
  const decadeStart = Math.floor(currentMonth.getFullYear() / 10) * 10
  const decadeEnd = decadeStart + 9

  // Años de la década actual
  const decadeYears = React.useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => decadeStart + i)
  }, [decadeStart])

  // Función para cambiar el mes/año
  const handleMonthChange = (newMonth: Date) => {
    setCurrentMonth(newMonth)
  }

  // Seleccionar mes y volver a vista de días
  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(currentMonth)
    newDate.setMonth(monthIndex)
    handleMonthChange(newDate)
    setView("days")
  }

  // Seleccionar año y volver a vista de meses
  const handleYearSelect = (year: number) => {
    const newDate = new Date(currentMonth)
    newDate.setFullYear(year)
    handleMonthChange(newDate)
    setView("months")
  }

  return (
    <div className="flex flex-col">
      {/* Caption siempre visible */}
      <CustomCaption
        view={view}
        setView={setView}
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        monthNames={monthNames}
        t={t}
      />

      {/* Contenido según la vista */}
      {view === "days" && (
        <DayPicker
          showOutsideDays={showOutsideDays}
          month={currentMonth}
          onMonthChange={handleMonthChange}
          className={cn("p-3 w-full", className)}
          locale={dateLocale}
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4 w-full",
            caption: "hidden",
            caption_label: "text-sm font-medium",
            nav: "hidden",
            nav_button: cn(
              buttonVariants({ variant: "outline" }),
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex w-full",
            head_cell:
              "text-muted-foreground rounded-md w-full font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "flex-1 h-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: cn(
              buttonVariants({ variant: "ghost" }),
              "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
            ),
            day_range_end: "day-range-end",
            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside:
              "day-outside text-muted-foreground opacity-75 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            day_disabled: "text-muted-foreground opacity-50",
            day_range_middle:
              "aria-selected:bg-accent aria-selected:text-accent-foreground",
            ...classNames,
          }}
          components={{
            IconLeft: ({ className, ...props }) => (
              <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
            ),
            IconRight: ({ className, ...props }) => (
              <ChevronRight className={cn("h-4 w-4", className)} {...props} />
            ),
          }}
          labels={{
            labelPrevious: () => t("labelPrevious"),
            labelNext: () => t("labelNext"),
            labelMonthDropdown: () => t("labelMonthDropdown"),
            labelYearDropdown: () => t("labelYearDropdown"),
          }}
          {...props}
        />
      )}

      {view === "months" && (
        <div className="p-3 w-full min-w-[280px]">
          <div className="grid grid-cols-3 gap-2">
            {monthNames.map((monthName, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleMonthSelect(index)}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-14 w-full text-sm px-2 capitalize",
                  currentMonth.getMonth() === index && "bg-accent"
                )}
              >
                {monthName}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "years" && (
        <div className="p-3 w-full min-w-[280px]">
          <div className="grid grid-cols-4 gap-2">
            {decadeYears.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => handleYearSelect(year)}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-14 w-full text-sm px-2",
                  currentMonth.getFullYear() === year && "bg-accent"
                )}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer "Ir a hoy" solo en vista de días */}
      {view === "days" && props.mode === "single" && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground mt-2 mb-3 cursor-pointer bg-transparent border-0 p-0"
          onClick={(e) => {
            e.preventDefault()
            if (props.onSelect) {
              (props.onSelect as (date: Date | undefined) => void)(new Date())
            }
          }}
        >
          {t("labelToday")}
        </button>
      )}
    </div>
  )
}

DatePicker.displayName = "DatePicker"

export { DatePicker }

type DatePickerInputProps = {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  disabledDays?: (date: Date) => boolean
}

const DATE_FORMAT = 'dd/MM/yyyy'
const DATE_FORMAT_REGEX = /^\d{2}\/\d{2}\/\d{4}$/

function isValidDate(day: number, month: number, year: number): boolean {
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function isValidFormattedDate(value: string): boolean {
  if (!DATE_FORMAT_REGEX.test(value)) return false
  
  const [day, month, year] = value.split('/').map(Number)
  return isValidDate(day, month, year)
}

function isWithinRange(date: Date, disabledDays?: (date: Date) => boolean): boolean {
  const minDate = new Date('1900-01-01')
  if (date < minDate) return false
  if (disabledDays?.(date)) return false
  return true
}

function parseFormattedDate(value: string, disabledDays?: (date: Date) => boolean): Date | null {
  if (!isValidFormattedDate(value)) return null
  
  const [day, month, year] = value.split('/').map(Number)
  const date = new Date(year, month - 1, day)
  
  if (!isWithinRange(date, disabledDays)) return null
  
  return date
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  disabled = false,
  className,
  disabledDays,
}: DatePickerInputProps) {
  const [inputValue, setInputValue] = React.useState<string>(() => {
    if (!value) return ''
    const displayed = formatDisplayDate(value)
    return displayed === 'N/A' || displayed === 'Invalid Date' ? '' : displayed
  })
  
  const [isOpen, setIsOpen] = React.useState(false)
  const [error, setError] = React.useState(false)
  
  // Sync with external value changes
  React.useEffect(() => {
    if (!value) {
      setInputValue('')
      return
    }
    const displayed = formatDisplayDate(value)
    if (displayed !== 'N/A' && displayed !== 'Invalid Date') {
      setInputValue(displayed)
      setError(false)
    }
  }, [value])
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    
    // Allow only digits and slashes
    const filtered = rawValue.replace(/[^\d/]/g, '')
    
    // Auto-format: add slashes automatically
    let formatted = filtered
    if (filtered.length === 2 && !filtered.includes('/')) {
      formatted = filtered + '/'
    } else if (filtered.length === 5 && filtered.split('/').length === 2) {
      formatted = filtered + '/'
    }
    
    // Limit to 10 characters (dd/MM/yyyy)
    if (formatted.length <= 10) {
      setInputValue(formatted)
      setError(false)
    }
  }
  
  const handleBlur = () => {
    if (!inputValue) {
      onChange?.('')
      setError(false)
      return
    }
    
    const parsedDate = parseFormattedDate(inputValue, disabledDays)
    
    if (!parsedDate) {
      setError(true)
      return
    }
    
    // Valid date - update parent
    const isoValue = format(parsedDate, 'yyyy-MM-dd')
    onChange?.(isoValue)
    setInputValue(format(parsedDate, DATE_FORMAT))
    setError(false)
  }
  
  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) {
      onChange?.('')
      setInputValue('')
      return
    }
    
    const isoValue = format(date, 'yyyy-MM-dd')
    onChange?.(isoValue)
    setInputValue(format(date, DATE_FORMAT))
    setError(false)
    setIsOpen(false)
  }
  
  const selectedDate = value ? (() => {
    const datePart = formatDate(value)
    if (!datePart || datePart === 'N/A' || datePart === 'Invalid Date') return undefined
    return parse(datePart, 'yyyy-MM-dd', new Date())
  })() : undefined
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'pr-10',
              error && 'border-destructive focus-visible:ring-destructive',
              className
            )}
            inputMode="numeric"
            maxLength={10}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
              disabled={disabled}
              onClick={(e) => {
                e.preventDefault()
                setIsOpen(!isOpen)
              }}
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="sr-only">Open calendar</span>
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-auto p-0" align="start">
        <DatePicker
          mode="single"
          selected={selectedDate}
          onSelect={handleCalendarSelect}
          disabled={disabledDays}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
