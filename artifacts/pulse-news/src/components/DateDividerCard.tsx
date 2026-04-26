import { useEffect, useRef } from "react";
import { isToday, isYesterday, format } from "date-fns";
import { GrainBackground } from "./GrainBackground";

interface DateDividerCardProps {
  date: Date;
  dateId: string;
  onEnter?: (date: Date) => void;
  viewportHeight?: number;
  // Horizontal day-nav affordances. All optional — left undefined the divider
  // renders exactly as before (keeps the legacy FeedPage identical).
  showDayNav?: boolean;
  hasPrevDay?: boolean;   // swipe right → older day
  hasNextDay?: boolean;   // swipe left → newer day
  // dayIndex / daysLoaded were used by the old multi-dot rail; the new
  // 3-dot (prev/current/next) rail only needs hasPrevDay / hasNextDay.
  // Kept as optional accepts so existing callers don't break.
  dayIndex?: number;
  daysLoaded?: number;
  // The neighbour day Dates — used to label the inline nav pills with
  // the actual weekday name (mirrors DayCompletionCard's pattern). When
  // omitted, the pills render with a generic chevron only.
  prevDate?: Date | null;
  nextDate?: Date | null;
  // Click handlers — when provided, chevrons become clickable buttons
  // (useful on desktop where there's no touch swipe).
  onPrev?: () => void;
  onNext?: () => void;
}

// Same 1-px editorial chevrons used in DayCompletionCard so the two
// slides share the same arrow grammar. Stroke weight intentionally light
// so the arrow reads as editorial typography rather than a UI icon.
function ChevLeft({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="10" height="16" viewBox="0 0 14 22" fill="none" style={style} aria-hidden="true">
      <path d="M10 3 L3 11 L10 19" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevRight({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="10" height="16" viewBox="0 0 14 22" fill="none" style={style} aria-hidden="true">
      <path d="M4 3 L11 11 L4 19" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Same literal weekday formatting as DayCompletionCard so the divider's
// nav pills read "SUNDAY" / "MONDAY" rather than relative shorthand.
function dayLabel(d: Date): string {
  return format(d, "EEEE");
}

export function DateDividerCard({
  date,
  dateId,
  onEnter,
  viewportHeight,
  showDayNav = false,
  hasPrevDay = false,
  hasNextDay = false,
  prevDate,
  nextDate,
  onPrev,
  onNext,
}: DateDividerCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onEnter || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onEnter(date); },
      { threshold: 0.6 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [date, onEnter]);

  const label = isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "EEEE");
  const sub = format(date, "do MMMM yyyy");

  // The dots visualise position relative to the current slide only:
  // one dim dot for the previous day (if it exists), the active dot for
  // today, one dim dot for the next day (if it exists). Always 2 or 3 dots
  // total — never the full loaded-day count.
  const showPrevDot = showDayNav && hasPrevDay;
  const showNextDot = showDayNav && hasNextDay;
  const showDots = showPrevDot || showNextDot;

  // Pill enable flags mirror DayCompletionCard's. We render a pill only
  // when there's a navigable neighbour AND a click handler; otherwise the
  // slot collapses to a zero-width spacer so the dots stay centred.
  const prevPillEnabled = showDayNav && hasPrevDay && !!onPrev;
  const nextPillEnabled = showDayNav && hasNextDay && !!onNext;
  const showNavRow = showDots || prevPillEnabled || nextPillEnabled;

  return (
    <div
      id={dateId}
      ref={ref}
      className="w-full snap-start snap-always relative overflow-hidden flex flex-col items-center justify-center"
      style={{ height: viewportHeight ?? '100%', background: "#053980" }}
    >
      <GrainBackground />

      <div className="relative z-10 flex flex-col items-center gap-4 px-8 text-center">
        <div style={{ width: 40, height: 1, background: "rgba(255,241,205,0.3)" }} />
        <div className="flex flex-col items-center gap-1">
          <span
            style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "30px", lineHeight: 1.1, color: "#fff1cd", letterSpacing: "0.04em", textTransform: "uppercase" }}
          >
            {label}
          </span>
          <span
            style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "14px", color: "rgba(255,241,205,0.6)", letterSpacing: "0.07em", textTransform: "uppercase" }}
          >
            {sub}
          </span>
        </div>
        <div style={{ width: 40, height: 1, background: "rgba(255,241,205,0.3)" }} />

        <p
          className="font-['Inter'] mt-3"
          style={{ fontSize: "12px", color: "rgba(255,241,205,0.45)", letterSpacing: "0.06em" }}
        >
          SCROLL TO CONTINUE
        </p>

        {showNavRow && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 6,
            }}
          >
            {/* Previous (older) day — pill on the LEFT of the dots row,
                same chevron + uppercase weekday recipe as DayCompletionCard.
                Collapses to a zero-width spacer when unavailable so the
                dots remain visually centred relative to the slide. */}
            {prevPillEnabled && prevDate ? (
              <button
                type="button"
                onClick={onPrev}
                aria-label={`Go to ${dayLabel(prevDate)}, ${format(prevDate, "d MMMM")}`}
                style={{
                  color: "#fff1cd",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  background: "transparent",
                  border: "1px solid rgba(255,241,205,0.14)",
                  borderRadius: 999,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                  transition: "background 180ms ease, border-color 180ms ease",
                }}
              >
                <ChevLeft style={{ color: "rgba(255,241,205,0.55)" }} />
                <span
                  className="font-['Inter']"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "rgba(255,241,205,0.85)",
                    fontWeight: 500,
                  }}
                >
                  {dayLabel(prevDate)}
                </span>
              </button>
            ) : (
              <span aria-hidden="true" style={{ width: 0, height: 0 }} />
            )}

            {showDots && (
              <div
                aria-hidden="true"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {/* Spatial order: oldest on the left, newest on the right.
                    Prev day = older = left dim dot; current = middle active dot;
                    next day = newer = right dim dot. */}
                {showPrevDot && (
                  <span
                    key="prev"
                    style={{
                      display: "inline-block",
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "rgba(255,241,205,0.3)",
                    }}
                  />
                )}
                <span
                  key="current"
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#fff1cd",
                  }}
                />
                {showNextDot && (
                  <span
                    key="next"
                    style={{
                      display: "inline-block",
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "rgba(255,241,205,0.3)",
                    }}
                  />
                )}
              </div>
            )}

            {/* Next (newer) day — pill on the RIGHT of the dots row. */}
            {nextPillEnabled && nextDate ? (
              <button
                type="button"
                onClick={onNext}
                aria-label={`Go to ${dayLabel(nextDate)}, ${format(nextDate, "d MMMM")}`}
                style={{
                  color: "#fff1cd",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  background: "transparent",
                  border: "1px solid rgba(255,241,205,0.14)",
                  borderRadius: 999,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                  transition: "background 180ms ease, border-color 180ms ease",
                }}
              >
                <span
                  className="font-['Inter']"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "rgba(255,241,205,0.85)",
                    fontWeight: 500,
                  }}
                >
                  {dayLabel(nextDate)}
                </span>
                <ChevRight style={{ color: "rgba(255,241,205,0.55)" }} />
              </button>
            ) : (
              <span aria-hidden="true" style={{ width: 0, height: 0 }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
