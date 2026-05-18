'use client';

import { useState } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isBefore,
  startOfDay,
  isSameMonth,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarSelectorProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

export default function CalendarSelector({
  selectedDate,
  onSelectDate,
}: CalendarSelectorProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = startOfDay(new Date());

  const handlePrevMonth = () => {
    const prevMonth = subMonths(currentMonth, 1);
    if (!isBefore(endOfMonth(prevMonth), today)) {
      setCurrentMonth(prevMonth);
    }
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start week on Monday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
  const isPrevDisabled = isBefore(endOfMonth(subMonths(currentMonth, 1)), today);

  return (
    <div className="w-full bg-[#FCFAF7] rounded-2xl border border-warm-border p-5 shadow-sm">
      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-bold text-charcoal capitalize select-none tracking-tight">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h4>
        <div className="flex space-x-1">
          <button
            type="button"
            disabled={isPrevDisabled}
            onClick={handlePrevMonth}
            className={`p-1.5 rounded-lg border border-warm-border transition-colors duration-200 ${
              isPrevDisabled
                ? 'opacity-30 cursor-not-allowed bg-warm-bg/50'
                : 'hover:bg-gold-light text-charcoal hover:border-gold/30'
            }`}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-warm-border hover:bg-gold-light text-charcoal hover:border-gold/30 transition-colors duration-200"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-[10px] font-bold text-warm-muted py-1 uppercase select-none tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isPast = isBefore(day, today);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const isToday = isSameDay(day, today);
          
          // Disable past days, days outside of currently browsed month, and weekends (Sat/Sun)
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const isDisabled = isPast || !isCurrentMonth || isWeekend;

          return (
            <div key={day.toString()} className="aspect-square p-0.5 relative">
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => onSelectDate(day)}
                className={`w-full h-full rounded-full flex flex-col items-center justify-center text-xs font-semibold transition-all duration-300 relative ${
                  isSelected
                    ? 'bg-gold text-white shadow-sm gold-glow'
                    : isDisabled
                    ? 'text-warm-border/50 cursor-not-allowed bg-transparent'
                    : isToday
                    ? 'border border-gold text-charcoal hover:bg-gold-light'
                    : 'text-charcoal hover:bg-gold-light/40 hover:text-gold-hover'
                }`}
              >
                <span>{format(day, 'd')}</span>
                {isToday && !isSelected && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-gold" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
