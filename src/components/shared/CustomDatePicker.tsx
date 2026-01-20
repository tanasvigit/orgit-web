import React, { useState, useEffect } from 'react';

interface CustomDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  title: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  onClose,
  title,
}) => {
  const [tempDate, setTempDate] = useState(new Date(value));
  const [currentView, setCurrentView] = useState<'calendar' | 'time'>('calendar');

  useEffect(() => {
    setTempDate(new Date(value));
  }, [value]);

  const getDaysInMonth = (year: number, month: number) => {
    // month is 1-based (1-12), convert to 0-based for JavaScript Date
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const currentYear = tempDate.getFullYear();
  const currentMonth = tempDate.getMonth() + 1;
  const currentDay = tempDate.getDate();
  const currentHour = tempDate.getHours();
  const currentMinute = tempDate.getMinutes();

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const days: (number | null)[] = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleDayClick = (day: number) => {
    const newDate = new Date(tempDate);
    newDate.setDate(day);
    setTempDate(newDate);
    setCurrentView('time');
  };

  const handleTimeChange = (field: 'hour' | 'minute', val: number) => {
    const newDate = new Date(tempDate);
    if (field === 'hour') {
      newDate.setHours(val);
    } else {
      newDate.setMinutes(val);
    }
    setTempDate(newDate);
  };

  const handlePreviousMonth = () => {
    const newDate = new Date(tempDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setTempDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(tempDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setTempDate(newDate);
  };

  const handleYearChange = (delta: number) => {
    const newDate = new Date(tempDate);
    newDate.setFullYear(newDate.getFullYear() + delta);
    setTempDate(newDate);
  };

  const handleConfirm = () => {
    onChange(tempDate);
    onClose();
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth === today.getMonth() + 1 &&
      currentYear === today.getFullYear()
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-300 font-medium hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={handleConfirm}
            className="text-primary font-semibold hover:text-primary/80 transition-colors"
          >
            Done
          </button>
        </div>

        {/* Calendar View */}
        {currentView === 'calendar' && (
          <div className="p-6">
            {/* Month/Year Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePreviousMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">chevron_left</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleYearChange(-1)}
                  className="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-semibold text-gray-900 dark:text-white"
                >
                  {currentYear}
                </button>
                <button className="px-3 py-1 bg-primary/10 text-primary rounded-lg font-semibold min-w-[120px]">
                  {monthNames[currentMonth - 1]}
                </button>
              </div>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">chevron_right</span>
              </button>
            </div>

            {/* Week Days Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const isSelected = day === currentDay;
                const isTodayDay = isToday(day);

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary text-white shadow-md'
                        : isTodayDay
                        ? 'bg-primary/20 text-primary border-2 border-primary'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Time Selection Toggle */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setCurrentView('time')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Time</span>
                <span className="text-sm text-gray-900 dark:text-white font-semibold">
                  {currentHour.toString().padStart(2, '0')}:{currentMinute.toString().padStart(2, '0')}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Time Selection View */}
        {currentView === 'time' && (
          <div className="p-6">
            <button
              onClick={() => setCurrentView('calendar')}
              className="mb-4 flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span className="text-sm font-medium">Back to Calendar</span>
            </button>

            <div className="mb-4 text-center">
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                {tempDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{currentYear}</div>
            </div>

            <div className="flex gap-6">
              {/* Hour Column */}
              <div className="flex-1">
                <div className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                  Hour
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 max-h-[200px] overflow-y-auto">
                  {hours.map((hour) => (
                    <button
                      key={hour}
                      onClick={() => handleTimeChange('hour', hour)}
                      className={`w-full py-2 text-center rounded-md transition-colors mb-1 ${
                        currentHour === hour
                          ? 'bg-primary text-white font-semibold'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {hour.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minute Column */}
              <div className="flex-1">
                <div className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                  Minute
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 max-h-[200px] overflow-y-auto">
                  {minutes.map((minute) => (
                    <button
                      key={minute}
                      onClick={() => handleTimeChange('minute', minute)}
                      className={`w-full py-2 text-center rounded-md transition-colors mb-1 ${
                        currentMinute === minute
                          ? 'bg-primary text-white font-semibold'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {minute.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
