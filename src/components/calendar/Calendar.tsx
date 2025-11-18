
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu';
import './Calendar.css';
import { Skeleton } from '../ui/skeleton';

const Calendar = ({ events = [], onDateChange, children, isLoading = false, onEventClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'day', 'week', 'month', 'year'
  const [showWeekends, setShowWeekends] = useState(true);

  const handleDateChange = useCallback(() => {
    if (onDateChange) {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      onDateChange({ start, end });
    }
  }, [currentDate, onDateChange]);

  useEffect(() => {
    handleDateChange();
  }, [handleDateChange]);

  const handlePrev = () => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (view === 'week') {
        setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)));
    } else if (view === 'day') {
        setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)));
    } else if (view === 'year') {
        setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1));
    }
  };

  const handleNext = () => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (view === 'week') {
        setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)));
    } else if (view === 'day') {
        setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)));
    } else if (view === 'year') {
        setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const renderHeader = () => (
    <div className="calendar-header">
      <div className='flex items-center gap-4'>
        <h2 className='text-xl font-bold'>Calendar</h2>
        <Button variant="outline" size="sm" onClick={handleToday}>Today</Button>
        <div className='flex items-center gap-1'>
            <Button variant="ghost" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <h3 className='font-semibold'>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
      </div>
      <div className='flex items-center gap-2'>
        {children}
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">{view.charAt(0).toUpperCase() + view.slice(1)}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setView('day')}>Day</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setView('week')}>Week</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setView('month')}>Month</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setView('year')}>Year</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={showWeekends} onCheckedChange={setShowWeekends}>
                    Show Weekends
                </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const renderDays = () => {
      let days = [];
      let startingDay = firstDayOfMonth;

      for (let i = 0; i < startingDay; i++) {
        days.push(<div key={`empty-prev-${i}`} className="calendar-day other-month"></div>);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayEvents = events.filter(e => new Date(e.start).toDateString() === date.toDateString());
        days.push(
          <div key={day} className="calendar-day">
            <span className='font-semibold'>{day}</span>
            <div className='mt-1 space-y-1'>
              {dayEvents.map(event => (
                <div 
                    key={event.id} 
                    style={{ backgroundColor: event.backgroundColor }} 
                    className="event"
                    onClick={() => onEventClick(event)}
                >
                  {event.title}
                </div>
              ))}
            </div>
          </div>
        );
      }

      const totalSlots = days.length;
      const slotsNeededFor6Rows = 42; 
      const remainingSlots = slotsNeededFor6Rows - totalSlots > 0 ? slotsNeededFor6Rows - totalSlots : 0;

      for (let i = 0; i < remainingSlots; i++) {
        days.push(<div key={`empty-next-${i}`} className="calendar-day other-month"></div>);
      }
      return days;
    }
    
    if (isLoading) {
        const skeletonDays = Array.from({ length: 42 }).map((_, i) => (
            <div key={`skel-${i}`} className="calendar-day">
                <Skeleton className="h-4 w-6 mb-2" />
                <Skeleton className="h-5 w-full mt-2" />
                <Skeleton className="h-5 w-full mt-1" />
            </div>
        ));
         return (
             <>
                <div className="calendar-grid-header">
                    {dayNames.map(name => <div key={name} className="calendar-day-name">{name}</div>)}
                </div>
                <div className="calendar-grid month-view">{skeletonDays}</div>
            </>
        );
    }
    
    return (
        <>
         <div className="calendar-grid-header">
            {dayNames.map(name => <div key={name} className="calendar-day-name">{name}</div>)}
          </div>
          <div className="calendar-grid month-view">{renderDays()}</div>
        </>
    )
  };

  const renderWeekView = () => {
    return <div className='p-4'>Week View Not Implemented</div>
  };
  
  const renderDayView = () => {
    return <div className='p-4'>Day View Not Implemented</div>
  };

  const renderYearView = () => {
    return <div className='p-4'>Year View Not Implemented</div>
  };

  const renderView = () => {
    switch (view) {
      case 'day': return renderDayView();
      case 'week': return renderWeekView();
      case 'year': return renderYearView();
      case 'month':
      default:
        return renderMonthView();
    }
  };

  return (
    <div className="calendar">
      {renderHeader()}
      {renderView()}
    </div>
  );
};

export default Calendar;
