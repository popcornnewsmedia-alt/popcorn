import { useState } from "react";
import { format, subDays, addDays, isSameDay, startOfDay } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

interface TopBarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  showDatePicker?: boolean;
}

export function TopBar({ selectedDate, onDateChange, showDatePicker = true }: TopBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const today = startOfDay(new Date());
  const isAtToday = isSameDay(selectedDate, today);

  const goBack = () => onDateChange(subDays(selectedDate, 1));
  const goForward = () => { if (!isAtToday) onDateChange(addDays(selectedDate, 1)); };

  const barStyle = {
    background: 'rgba(10, 14, 11, 0.92)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
  };

  return (
    <>
      {/* Main bar */}
      <div
        className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-5 py-3"
        style={{
          ...barStyle,
          borderBottom: pickerOpen ? 'none' : '1px solid rgba(255,255,255,0.06)',
          boxShadow: pickerOpen ? 'none' : '0 2px 16px rgba(0,0,0,0.18)',
        }}
      >
        {/* Brand */}
        <span
          className="font-['Manrope'] font-bold tracking-tight"
          style={{ fontSize: '22px', color: '#ffffff', letterSpacing: '-0.02em' }}
        >
          Bref.
        </span>

        {/* Date button */}
        {showDatePicker && (
          <button
            onClick={() => setPickerOpen(o => !o)}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-75"
          >
            <span
              className="font-['Inter'] font-medium"
              style={{ fontSize: '12px', color: '#ffffff', letterSpacing: '0.03em' }}
            >
              {format(selectedDate, 'do MMMM').toUpperCase()}
            </span>
            <ChevronDown
              className="transition-transform duration-200"
              style={{
                width: '13px',
                height: '13px',
                color: 'rgba(255,255,255,0.60)',
                transform: pickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>
        )}
      </div>

      {/* Date picker panel */}
      {showDatePicker && <div
        className="fixed inset-x-0 z-39 overflow-hidden"
        style={{
          top: '48px',
          maxHeight: pickerOpen ? '56px' : '0px',
          opacity: pickerOpen ? 1 : 0,
          transition: 'max-height 0.25s ease, opacity 0.20s ease',
          ...barStyle,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: pickerOpen ? '0 4px 20px rgba(0,0,0,0.22)' : 'none',
        }}
      >
        <div className="flex items-center justify-between px-5 py-3">
          {/* Back */}
          <button
            onClick={goBack}
            className="p-1.5 rounded-full transition-opacity hover:opacity-70 active:opacity-50"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>

          {/* Current date */}
          <div className="text-center">
            <span
              className="font-['Inter'] font-semibold text-white"
              style={{ fontSize: '14px', letterSpacing: '0.01em' }}
            >
              {isAtToday ? 'Today' : format(selectedDate, 'EEEE, do MMMM')}
            </span>
          </div>

          {/* Forward — disabled when at today */}
          <button
            onClick={goForward}
            className="p-1.5 rounded-full transition-opacity active:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.08)',
              opacity: isAtToday ? 0.25 : 1,
              cursor: isAtToday ? 'default' : 'pointer',
            }}
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>}

      {/* Tap-outside dismiss overlay */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-38"
          onClick={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
