
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import './Calendar.css';
import { Skeleton } from '../ui/skeleton';
import { addDays, addMonths, addWeeks, addYears, endOfDay, endOfMonth, endOfWeek, endOfYear, format, getDate, getDay, getDaysInMonth, getHours, getMinutes, isSameDay, startOfDay, startOfMonth, startOfWeek, startOfYear, getYear, set } from 'date-fns';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const GOOGLE_CALENDAR_COLORS = [
    { id: "1", hex: "#a4bdfc" }, // Lavender
    { id: "2", hex: "#7ae7bf" }, // Sage
    { id: "3", hex: "#dbadff" }, // Grape
    { id: "4", hex: "#ff887c" }, // Flamingo
    { id: "5", hex: "#fbd75b" }, // Banana
    { id: "6", hex: "#ffb878" }, // Tangerine
    { id: "7", hex: "#46d6db" }, // Peacock
    { id: "8", hex: "#e1e1e1" }, // Graphite
    { id: "9", hex: "#5484ed" }, // Blueberry
    { id: "10", hex: "#51b749" },// Basil
    { id: "11", hex: "#dc2127" },// Tomato
];


const Calendar = ({ events = [], onDateChange, children, isLoading = false, onEventClick, onViewChange, assignees = [], selectedAssignees = [], onSelectedAssigneesChange, group = false, onGroupChange, onEventColorChange }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);


  const handleDateChange = useCallback((start, end) => {
    if (onDateChange) {
      onDateChange({ start, end });
    }
  }, [onDateChange]);

 useEffect(() => {
    let start, end;
    switch (view) {
      case 'day':
        start = startOfDay(currentDate);
        end = endOfDay(currentDate);
        break;
      case '2-day':
        start = startOfDay(currentDate);
        end = endOfDay(addDays(currentDate, 1));
        break;
      case '3-day':
        start = startOfDay(currentDate);
        end = endOfDay(addDays(currentDate, 2));
        break;
      case 'week':
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        end = endOfWeek(currentDate, { weekStartsOn: 1 });
        break;
      case 'year':
        start = startOfYear(currentDate);
        end = endOfYear(currentDate);
        break;
      case 'month':
      default:
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
        break;
    }
    if (view !== 'year' && start && end) {
        handleDateChange(start, end);
    }
  }, [currentDate, view, handleDateChange]);

  const handlePrev = () => {
    switch(view) {
      case 'day': setCurrentDate(addDays(currentDate, -1)); break;
      case '2-day': setCurrentDate(addDays(currentDate, -2)); break;
      case '3-day': setCurrentDate(addDays(currentDate, -3)); break;
      case 'week': setCurrentDate(addWeeks(currentDate, -1)); break;
      case 'year': setCurrentDate(addYears(currentDate, -1)); break;
      case 'month':
      default: setCurrentDate(addMonths(currentDate, -1));
    }
  };

  const handleNext = () => {
    switch(view) {
      case 'day': setCurrentDate(addDays(currentDate, 1)); break;
      case '2-day': setCurrentDate(addDays(currentDate, 2)); break;
      case '3-day': setCurrentDate(addDays(currentDate, 3)); break;
      case 'week': setCurrentDate(addWeeks(currentDate, 1)); break;
      case 'year': setCurrentDate(addYears(currentDate, 1)); break;
      case 'month':
      default: setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleViewChange = (newView) => {
    setView(newView);
    if(onViewChange) {
        onViewChange(newView);
    }
  }
  
  const headerTitle = useMemo(() => {
    const start = view === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
    switch(view) {
        case 'day': return format(currentDate, 'MMMM d, yyyy');
        case '2-day': return `${format(start, 'MMMM d')} - ${format(addDays(start, 1), 'd, yyyy')}`;
        case '3-day': return `${format(start, 'MMMM d')} - ${format(addDays(start, 2), 'd, yyyy')}`;
        case 'week':
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return `${format(start, 'MMMM d')} - ${format(end, 'd, yyyy')}`;
        case 'year': return format(currentDate, 'yyyy');
        case 'month': 
        default: return format(currentDate, 'MMMM yyyy');
    }
  }, [currentDate, view]);

  const EventComponent = ({ event }) => (
    <ContextMenu onOpenChange={(open) => { if (!open) onEventClick(event.data); }}>
      <ContextMenuTrigger>
        <div
          className="event"
          style={{ backgroundColor: event.color || 'hsl(var(--primary))' }}
          onClick={() => onEventClick(event.data)}
        >
          <span className='mr-2' style={{ backgroundColor: event.color }}>&nbsp;</span>
          {event.title}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <div className="grid grid-cols-4 gap-2 p-2">
          {GOOGLE_CALENDAR_COLORS.map(color => (
            <div
              key={color.id}
              className="w-6 h-6 rounded-full cursor-pointer hover:opacity-80"
              style={{ backgroundColor: color.hex }}
              onClick={() => onEventColorChange(event.data, color.id)}
            />
          ))}
        </div>
      </ContextMenuContent>
    </ContextMenu>
  );

const EventInDayViewComponent = ({ event, style }) => (
    <ContextMenu onOpenChange={(open) => { if (!open) onEventClick(event.data); }}>
        <ContextMenuTrigger>
            <div 
                className="event-in-day-view" 
                style={style}
                onClick={(e) => {
                  e.stopPropagation(); // prevent triggering other click listeners
                  onEventClick(event.data);
                }}
            >
                {event.title}
            </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
             <div className="grid grid-cols-4 gap-2 p-2">
                {GOOGLE_CALENDAR_COLORS.map(color => (
                    <div 
                        key={color.id} 
                        className="w-6 h-6 rounded-full cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: color.hex }}
                        onClick={() => onEventColorChange(event.data, color.id)}
                    />
                ))}
            </div>
        </ContextMenuContent>
    </ContextMenu>
);

    const renderDayOrWeekView = (numDays) => {
        const startDay = view === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
        const days = Array.from({ length: numDays }, (_, i) => addDays(startDay, i));
        
        const timeSlots = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
        
        const columns = group ? assignees.filter((a) => selectedAssignees.includes(a.id)) : [{id: 'all', name: 'All', email: 'all'}];
        const numColumnsPerDay = group ? columns.length : 1;

        const getEventStyle = (event) => {
            const start = new Date(event.start);
            const end = new Date(event.end);
            const top = (getHours(start) + getMinutes(start) / 60) * 60;
            const duration = (end.getTime() - start.getTime()) / (1000 * 60);
            const height = duration;
            return {
                top: `${top}px`,
                height: `${height}px`,
                backgroundColor: event.color || 'hsl(var(--primary))'
            };
        };

        const currentTimePosition = (currentTime.getHours() + currentTime.getMinutes() / 60) * 60;
        const showTimeIndicator = days.some(day => isSameDay(day, currentTime));


        return (
            <div className="day-view-container">
                <div className="day-view-header-wrapper">
                    <div className='day-view-header-dates' style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)`}}>
                         <div className="time-zone-label">GMT-03</div>
                         {days.map(day => (
                            <div key={`date-${format(day, 'yyyy-MM-dd')}`} className="day-view-date-cell">
                                <span className='day-name'>{format(day, 'EEE').toUpperCase()}</span>
                                <span className={cn("day-number", isSameDay(day, new Date()) && "current-day")}>
                                    {format(day, 'd')}
                                </span>
                            </div>
                        ))}
                    </div>
                     {group && (
                        <div className="day-view-header-assignees" style={{ gridTemplateColumns: `60px repeat(${days.length * numColumnsPerDay}, 1fr)`}}>
                             <div/>
                            {days.map(day => (
                                columns.length > 0 ? columns.map(col => (
                                    <div key={`assignee-${format(day, 'yyyy-MM-dd')}-${col.id}`} className="day-view-assignee-cell">
                                        {col.name}
                                    </div>
                                )) : <div key={`assignee-empty-${format(day, 'yyyy-MM-dd')}`} className="day-view-assignee-cell"></div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="day-view-body" style={{ '--num-days': days.length * (group ? columns.length : 1) }}>
                    <div className="time-column">
                        {timeSlots.map(time => {
                            const hour24 = parseInt(time.split(':')[0], 10);
                            if (hour24 === 0) return <div key={time} className="time-slot" />;
                            
                            const isPM = hour24 >= 12;
                            const ampm = isPM ? 'PM' : 'AM';
                            let hour12 = hour24 % 12;
                            if (hour12 === 0) hour12 = 12;

                            return (
                                <div key={time} className="time-slot">
                                    <span className="time-slot-label">{`${hour12} ${ampm}`}</span>
                                </div>
                            )
                        })}
                    </div>
                    {days.map((day, dayIndex) => (
                        group && columns.length > 0 ? columns.map(col => (
                            <div key={`${format(day, 'yyyy-MM-dd')}-${col.id}`} className="day-column">
                                {timeSlots.map(time => <div key={`${time}-${col.id}`} className="time-slot" />)}
                                {events
                                    .filter((e) => isSameDay(new Date(e.start), day) && e.assignee === col.email)
                                    .map((event) => (
                                        <EventInDayViewComponent key={event.id} event={event} style={getEventStyle(event)} />
                                    ))
                                }
                            </div>
                        )) : (
                            <div key={format(day, 'yyyy-MM-dd')} className="day-column">
                                {timeSlots.map(time => <div key={time} className="time-slot" />)}
                                {events
                                    .filter((e) => isSameDay(new Date(e.start), day))
                                    .map((event) => (
                                        <EventInDayViewComponent key={event.id} event={event} style={getEventStyle(event)} />
                                    ))
                                }
                            </div>
                        )
                    ))}
                    {showTimeIndicator && (
                        <div className="current-time-indicator" style={{ top: `${currentTimePosition}px` }}>
                            <div className="current-time-dot"></div>
                            <div className="current-time-line"></div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfWeek = 1; // Monday
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // Sunday is 0
    let dayOffset = (firstDayOfMonth - firstDayOfWeek + 7) % 7;

    const daysInMonth = getDaysInMonth(currentDate);

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const renderDays = () => {
      const dayElements = [];
      
      for (let i = 0; i < dayOffset; i++) {
        dayElements.push(<div key={`empty-prev-${i}`} className="calendar-day other-month"></div>);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayEvents = events.filter((e) => {
            if (!e.start) return false;
            try {
                return isSameDay(new Date(e.start), date);
            } catch (error) {
                console.error("Invalid event start date:", e.start);
                return false;
            }
        });
        
        dayElements.push(
          <div key={day} className="calendar-day">
            <span className={cn('font-semibold w-6 h-6 flex items-center justify-center rounded-full', isSameDay(date, new Date()) && 'current-day-month-view')}>{day}</span>
            <div className='mt-1 space-y-1'>
              {dayEvents.map((event, index) => (
                <EventComponent key={`${event.id}-${index}`} event={event} />
              ))}
            </div>
          </div>
        );
      }
      
      const totalCells = dayElements.length > 35 ? 42 : 35;
      while(dayElements.length < totalCells) {
           dayElements.push(<div key={`empty-next-${dayElements.length}`} className="calendar-day other-month"></div>);
      }

      return dayElements;
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
                <div className="calendar-day-name-grid">
                    {dayNames.map(name => <div key={name}>{name}</div>)}
                </div>
                <div className="calendar-grid month-view">{skeletonDays}</div>
            </>
        );
    }

    return (
        <>
         <div className="calendar-day-name-grid">
            {dayNames.map(name => <div key={name}>{name}</div>)}
          </div>
          <div className="calendar-grid month-view">{renderDays()}</div>
        </>
    )
  };

  const renderYearView = () => {
    const year = getYear(currentDate);
    const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
    const getMonth = (date) => date.getMonth();

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 overflow-y-auto">
        {months.map(month => (
          <div key={format(month, 'yyyy-MM')}>
            <h4 className="font-semibold text-center mb-2">{format(month, 'MMMM')}</h4>
            <div className="grid grid-cols-7 text-xs text-center text-muted-foreground">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <div key={i}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 text-sm text-center">
              {Array.from({length: (getDay(month) + 6) % 7}).map((_, i) => <div key={`empty-${i}`}></div>)}
              {Array.from({length: getDaysInMonth(month)}).map((_, day) => {
                const date = new Date(year, getMonth(month), day + 1);
                const dayEvents = events.filter((e) => isSameDay(new Date(e.start), date));
                return (
                  <div key={day} className={cn("relative rounded-full aspect-square flex items-center justify-center", dayEvents.length > 0 && "bg-primary/20", isSameDay(date, new Date()) && "bg-primary text-primary-foreground")}>
                    {day + 1}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  const renderScheduleView = () => {
      const groupedEvents = events.reduce((acc, event) => {
          if (!event.start) return acc;
          try {
            const date = format(new Date(event.start), 'yyyy-MM-dd');
            if (!acc[date]) acc[date] = [];
            acc[date].push(event);
          } catch (e) {
            console.error("Invalid event start date for schedule view:", event.start);
          }
          return acc;
      }, {});

      const sortedDates = Object.keys(groupedEvents).sort();

      return (
        <div className="overflow-y-auto p-4">
            {sortedDates.map(date => (
                <div key={date} className="mb-4">
                    <h3 className="font-bold text-lg mb-2">{format(new Date(date), 'EEEE, MMMM d, yyyy')}</h3>
                    <div className="space-y-2">
                        {groupedEvents[date].map(event => (
                            <div key={event.id} className="p-2 rounded-md flex items-center gap-4" style={{ backgroundColor: event.color ? `${event.color}20` : 'var(--muted)' }} onClick={() => onEventClick(event.data)}>
                                <div className="flex items-center gap-2 w-28 text-sm font-semibold">
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: event.color || 'hsl(var(--primary))' }} />
                                  {format(new Date(event.start), 'p')}
                                </div>
                                <div className="flex-1 text-sm">{event.title}</div>
                                {event.assignee && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>{assignees.find((a) => a.email === event.assignee)?.name || event.assignee}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      );
  }

  const renderView = () => {
    switch (view) {
      case 'day': return renderDayOrWeekView(1);
      case '2-day': return renderDayOrWeekView(2);
      case '3-day': return renderDayOrWeekView(3);
      case 'week': return renderDayOrWeekView(7);
      case 'year': return renderYearView();
      case 'schedule': return renderScheduleView();
      case 'month':
      default:
        return renderMonthView();
    }
  };

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className='flex items-center gap-4'>
            <h2 className='text-xl font-bold'>Calendar</h2>
            <Button variant="outline" size="sm" onClick={handleToday}>Today</Button>
            <div className='flex items-center gap-1'>
                <Button variant="ghost" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <h3 className='font-semibold'>{headerTitle}</h3>
        </div>
        <div className='flex items-center gap-2'>
            {children}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                        {view.charAt(0).toUpperCase() + view.slice(1)}
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Day</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem onSelect={() => handleViewChange('day')}>Day</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleViewChange('2-day')}>2 Days</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleViewChange('3-day')}>3 Days</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onSelect={() => handleViewChange('week')}>Week</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleViewChange('month')}>Month</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleViewChange('year')}>Year</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleViewChange('schedule')}>Schedule</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
      <div className="calendar-body">
        {renderView()}
      </div>
    </div>
  );
};

export default Calendar;
