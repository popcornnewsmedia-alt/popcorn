import { useState, useRef, useLayoutEffect } from "react";
import { format, subDays, addDays, isSameDay, startOfDay } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { isStandalone } from "@/lib/utils";

interface TopBarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  showDatePicker?: boolean;
  /** Ref forwarded to the progress fill div — caller updates style.right directly for zero-lag scroll tracking */
  fillRef?: React.RefObject<HTMLDivElement | null>;
  /** Ref forwarded to the compact date span — caller updates textContent directly during scroll for zero-lag updates (bypasses React commit which lags on iOS Safari momentum scroll) */
  dateRef?: React.RefObject<HTMLSpanElement | null>;
  /** Ref forwarded to the expanded "Today / weekday, date" span in the picker */
  expandedDateRef?: React.RefObject<HTMLSpanElement | null>;
  minDate?: Date;
  /** When provided, the forward chevron is clamped to this date (the newest
   *  loaded feed day). Without it, "today" (the literal calendar date) is
   *  used — which can sit ahead of the newest feed day if today's feed
   *  hasn't been published yet. */
  maxDate?: Date;
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
  /** Scroll the underlying feed to the top of the current day's section (the DateDivider) */
  onScrollToDayTop?: () => void;
}

export function TopBar({ selectedDate, onDateChange, showDatePicker = true, fillRef, dateRef, expandedDateRef, minDate, maxDate, pickerOpen: controlledPickerOpen, onPickerOpenChange, onScrollToDayTop }: TopBarProps) {
  const [internalPickerOpen, setInternalPickerOpen] = useState(false);
  const isControlled = controlledPickerOpen !== undefined;
  const pickerOpen = isControlled ? controlledPickerOpen! : internalPickerOpen;
  const setPickerOpen = (v: boolean) => {
    if (!isControlled) setInternalPickerOpen(v);
    onPickerOpenChange?.(v);
  };
  const barRef = useRef<HTMLDivElement>(null);
  // Keep --pn-topbar-h CSS custom property up-to-date with the TopBar's
  // exact bottom edge (viewport-relative). ArticleCard reads this to
  // position the hero image flush with the progress bar on every device,
  // including when the hover-media-query button vs hint changes the height.
  useLayoutEffect(() => {
    const update = () => {
      const bottom = barRef.current?.getBoundingClientRect().bottom ?? 0;
      if (bottom > 0) {
        document.documentElement.style.setProperty('--pn-topbar-h', `${bottom}px`);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (barRef.current) ro.observe(barRef.current);
    return () => ro.disconnect();
  }, []);

  const today = startOfDay(new Date());
  const isAtToday = isSameDay(selectedDate, today);
  const isAtMin = minDate ? isSameDay(selectedDate, minDate) || selectedDate <= minDate : false;
  // Forward clamp: when a maxDate is supplied, stop there (the newest feed
  // day). Otherwise fall back to literal today so existing callers without
  // maxDate behave as before.
  const isAtMax = maxDate
    ? isSameDay(selectedDate, maxDate) || selectedDate >= maxDate
    : isAtToday;

  const goBack = () => { if (!isAtMin) onDateChange(subDays(selectedDate, 1)); };
  const goForward = () => { if (!isAtMax) onDateChange(addDays(selectedDate, 1)); };

  return (
    <>
      {/* In standalone PWA the blur covers the status bar area too (top:0 + padding).
          In browser mode we keep the transparent spacer so raw images show behind the status bar. */}
      {!isStandalone && (
        <div className="fixed top-0 inset-x-0" style={{ zIndex: 40, height: 'env(safe-area-inset-top)' }} />
      )}

      <div
        ref={barRef}
        className="fixed inset-x-0 z-40 flex flex-col"
        style={{
          top: isStandalone ? 0 : 'env(safe-area-inset-top)',
          paddingTop: isStandalone ? 'env(safe-area-inset-top)' : undefined,
          background: 'rgba(0,0,0,0.12)',
          backdropFilter: 'blur(18px) saturate(2.2) brightness(0.58)',
          WebkitBackdropFilter: 'blur(18px) saturate(2.2) brightness(0.58)',
          boxShadow: pickerOpen ? 'none' : '0 1px 0 rgba(26,68,48,0.08)',
        }}
      >
        {/* Brand + date row.
            Mobile: the whole row is a tap zone for onScrollToDayTop (matches
              iOS "tap status bar to scroll to top" convention — no visible
              affordance needed, discoverable via touch).
            Web: we add an explicit ChevronUp icon button next to the date
              picker (visible only on hover-capable pointers) so the action is
              discoverable to mouse users who don't expect invisible tap zones. */}
        <div
          className="relative flex items-center justify-between px-5 py-3"
          onClick={onScrollToDayTop}
          style={{ cursor: onScrollToDayTop ? 'pointer' : 'default' }}
        >
          <span
            style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '17px', color: '#fff1cd', letterSpacing: '0.03em', lineHeight: 1 }}
          >
            POPCORN
          </span>

          <div className="flex items-center gap-2.5">
            {/* Desktop-only visible scroll-to-day-top affordance */}
            {onScrollToDayTop && (
              <button
                onClick={(e) => { e.stopPropagation(); onScrollToDayTop(); }}
                className="pn-day-top-btn hidden items-center justify-center transition-all duration-150 hover:opacity-100 active:scale-90"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: 'rgba(255,241,205,0.09)',
                  border: '1px solid rgba(255,241,205,0.14)',
                  opacity: 0.75,
                }}
                aria-label="Scroll to top of day"
              >
                <ChevronUp style={{ width: 14, height: 14, color: '#fff1cd', strokeWidth: 2 }} />
              </button>
            )}

            {/* Mobile-only: tiny circled chevron hint. Same shape language
                as the desktop button but scaled down and dimmed so it reads
                as hint, not primary action. Pointer-events off so the tap
                bubbles to the row's onClick. */}
            {onScrollToDayTop && (
              <span
                className="pn-day-top-hint items-center justify-center"
                aria-hidden="true"
                style={{
                  pointerEvents: 'none',
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  border: '1px solid rgba(255,241,205,0.22)',
                }}
              >
                <ChevronUp
                  style={{
                    width: 9,
                    height: 9,
                    color: 'rgba(255,241,205,0.42)',
                    strokeWidth: 2.25,
                  }}
                />
              </span>
            )}

            {showDatePicker ? (
              <button
                onClick={(e) => { e.stopPropagation(); setPickerOpen(!pickerOpen); }}
                className="flex items-center gap-1.5 transition-opacity hover:opacity-75"
              >
                <span
                  ref={dateRef}
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
        </div>

        {/* Progress bar — fill div controlled imperatively via fillRef for zero-lag scroll tracking */}
        {showDatePicker && (
          <div className="relative" style={{ height: '3px', width: '100%', background: 'rgba(255,241,205,0.18)', contain: 'strict' }}>
            <div
              ref={fillRef}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(255,241,205,0.62)',
                transform: 'scaleX(0)',
                transformOrigin: 'left center',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
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
                  ref={expandedDateRef}
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
                  opacity: isAtMax ? 0.25 : 1,
                  cursor: isAtMax ? 'default' : 'pointer',
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
