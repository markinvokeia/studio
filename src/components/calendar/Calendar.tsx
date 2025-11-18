
'use client';

import React, { useState, useEffect } from 'react';
import './Calendar.css';

const Calendar = ({ onDateChange, events = [] }) => {
  const [date, setDate] = useState(new Date());
  const [days, setDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    generateCalendarDays();
    if (onDateChange) {
      onDateChange(new Date(currentYear, currentMonth, selectedDay));
    }
  }, [date, currentMonth, currentYear, selectedDay]);

  const generateCalendarDays = () => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const tempDays = [];
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    for (let i = firstDayOfMonth; i > 0; i--) {
      tempDays.push({ day: prevMonthDays - i + 1, month: 'prev', events: [] });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.getDate() === i && eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
      });
      tempDays.push({ day: i, month: 'current', events: dayEvents });
    }

    const remainingDays = 42 - tempDays.length;
    for (let i = 1; i <= remainingDays; i++) {
      tempDays.push({ day: i, month: 'next', events: [] });
    }

    setDays(tempDays);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayClick = (day) => {
    if (day.month === 'current') {
      setSelectedDay(day.day);
    }
  };

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button onClick={handlePrevMonth}>&lt;</button>
        <h2>{new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
        <button onClick={handleNextMonth}>&gt;</button>
      </div>
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="calendar-day-name">{day}</div>
        ))}
        {days.map((day, index) => (
          <div
            key={index}
            className={`calendar-day ${day.month !== 'current' ? 'other-month' : ''} ${day.day === selectedDay && day.month === 'current' ? 'selected' : ''}`}
            onClick={() => handleDayClick(day)}
          >
            <span>{day.day}</span>
            {day.events.map((event, i) => (
              <div key={i} className="event">{event.title}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Calendar;
