import { useState } from "react";
import { format, subDays, addDays, isSameDay, startOfDay } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

interface TopBarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  showDatePicker?: boolean;
  /** Ref forwarded to the progress fill div — caller updates style.right directly for zero-lag scroll tracking */
  fillRef?: React.RefObject<HTMLDivElement>;
  minDate?: Date;
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}

export function TopBar({ selectedDate, onDateChange, showDatePicker = true, fillRef, minDate, pickerOpen: controlledPickerOpen, onPickerOpenChange }: TopBarProps) {
  const [internalPickerOpen, setInternalPickerOpen] = useState(false);
  const isControlled = controlledPickerOpen !== undefined;
  const pickerOpen = isControlled ? controlledPickerOpen! : internalPickerOpen;
  const setPickerOpen = (v: boolean) => {
    if (!isControlled) setInternalPickerOpen(v);
    onPickerOpenChange?.(v);
  };
  const today = startOfDay(new Date());
  const isAtToday = isSameDay(selectedDate, today);
  const isAtMin = minDate ? isSameDay(selectedDate, minDate) || selectedDate <= minDate : false;

  const goBack = () => { if (!isAtMin) onDateChange(subDays(selectedDate, 1)); };
  const goForward = () => { if (!isAtToday) onDateChange(addDays(selectedDate, 1)); };

  return (
    <>
      {/* Safe-area zone — transparent, no blur → raw grain / page image shows behind the iOS status bar */}
      <div className="fixed top-0 inset-x-0" style={{ zIndex: 40, height: 'env(safe-area-inset-top)' }} />

      {/* TopBar content — starts below status bar, carries the frosted blur */}
      <div
        className="fixed inset-x-0 z-40 flex flex-col"
        style={{
          top: 'env(safe-area-inset-top)',
          background: 'rgba(0,0,0,0)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: pickerOpen ? 'none' : '0 1px 0 rgba(26,68,48,0.08)',
        }}
      >
        {/* Brand + date row */}
        <div className="relative flex items-center justify-between px-5 py-3">
          <span
            style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '17px', color: '#fff1cd', letterSpacing: '0.03em', lineHeight: 1 }}
          >
            POPCORN
          </span>

          {showDatePicker ? (
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-75"
            >
              <span
                style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '11px', color: '#fff1cd', letterSpacing: '0.05em' }}
              >
                {format(selectedDate, 'do MMMM').toUpperCase()}
              </span>
              <ChevronDown
                className="transition-transform duration-200"
                style={{
                  width: '13px',
                  height: '13px',
                  color: 'rgba(255,241,205,0.6)',
                  transform: pickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>
          ) : (
            <span
              style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '14px', color: 'rgba(255,241,205,0.6)', letterSpacing: '0.05em' }}
            >
              {format(selectedDate, 'do MMMM').toUpperCase()}
            </span>
          )}
        </div>

        {/* Progress bar — fill div controlled imperatively via fillRef for zero-lag scroll tracking */}
        {showDatePicker && (
          <div className="relative progress-liquid" style={{ height: '3px', width: '100%', background: 'rgba(255,241,205,0.18)' }}>
            <div
              ref={fillRef}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0, // full-width; scaled via transform instead of right %
                background: 'rgba(255,241,205,0.62)',
                transform: 'scaleX(0)', // updated via ref.style.transform = scaleX(n)
                transformOrigin: 'left center',
                willChange: 'transform', // hints compositor to promote to own layer
              }}
            />
          </div>
        )}

        {/* Collapsible date picker */}
        {showDatePicker && (
          <div
            className="relative"
            style={{
              maxHeight: pickerOpen ? '56px' : '0px',
              opacity: pickerOpen ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.25s ease, opacity 0.20s ease',
              borderTop: pickerOpen ? '1px solid rgba(255,241,205,0.12)' : 'none',
            }}
          >
            <div className="flex items-center justify-between px-5 py-3">
              <button
                onClick={goBack}
                className="p-1.5 rounded-full transition-opacity active:opacity-50"
                style={{
                  background: 'rgba(255,241,205,0.12)',
                  opacity: isAtMin ? 0.25 : 1,
                  cursor: isAtMin ? 'default' : 'pointer',
                }}
              >
                <ChevronLeft className="w-4 h-4" style={{ color: '#fff1cd' }} />
              </button>

              <div className="text-center">
                <span
                  style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '13px', letterSpacing: '0.04em', color: '#fff1cd', textTransform: 'uppercase' }}
                >
                  {isAtToday ? 'Today' : format(selectedDate, 'EEEE, do MMMM')}
                </span>
              </div>

              <button
                onClick={goForward}
                className="p-1.5 rounded-full transition-opacity active:opacity-50"
                style={{
                  background: 'rgba(255,241,205,0.12)',
                  opacity: isAtToday ? 0.25 : 1,
                  cursor: isAtToday ? 'default' : 'pointer',
                }}
              >
                <ChevronRight className="w-4 h-4" style={{ color: '#fff1cd' }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
