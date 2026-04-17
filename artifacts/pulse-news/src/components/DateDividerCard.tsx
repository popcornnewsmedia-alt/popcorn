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
  dayIndex?: number;      // 0-based index into the newest-first dayGroups array
  daysLoaded?: number;
  // Click handlers — when provided, chevrons become clickable buttons
  // (useful on desktop where there's no touch swipe).
  onPrev?: () => void;
  onNext?: () => void;
}

// Custom 1-px stroke chevrons matching the existing hairline rules.
// Stroke weight intentionally light so the arrow reads as editorial
// typography rather than a UI icon.
function ChevLeft({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="14" height="22" viewBox="0 0 14 22" fill="none" style={style} aria-hidden="true">
      <path d="M10 3 L3 11 L10 19" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevRight({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="14" height="22" viewBox="0 0 14 22" fill="none" style={style} aria-hidden="true">
      <path d="M4 3 L11 11 L4 19" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DateDividerCard({
  date,
  dateId,
  onEnter,
  viewportHeight,
  showDayNav = false,
  hasPrevDay = false,
  hasNextDay = false,
  dayIndex,
  daysLoaded,
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

  // The dots visualise where this day sits in the loaded-day sequence.
  // Spatial order matches the rail (oldest on the left, today on the right),
  // so the active-dot index is the MIRROR of dayIndex in the newest-first list.
  const showDots = showDayNav && typeof dayIndex === "number" && typeof daysLoaded === "number" && daysLoaded > 1;
  const activeDotIdx = showDots ? (daysLoaded! - 1 - dayIndex!) : -1;

  return (
    <div
      id={dateId}
      ref={ref}
      className="w-full snap-start snap-always relative overflow-hidden flex flex-col items-center justify-center"
      style={{ height: viewportHeight ?? '100%', background: "#053980" }}
    >
      <GrainBackground />

      {/* Chevron hints — absolute, vertically centred. Edge-to-edge positioning
          keeps them discreet; a slow horizontal "breathe" nudges the eye
          without being noisy. pointer-events: none so the rail swallows
          the gesture itself. */}
      {showDayNav && (
        <>
          <style>{`
            @keyframes pn-div-chev-l {
              0%,100% { transform: translateX(0); opacity: 0.42; }
              50%      { transform: translateX(-3px); opacity: 0.68; }
            }
            @keyframes pn-div-chev-r {
              0%,100% { transform: translateX(0); opacity: 0.42; }
              50%      { transform: translateX(3px);  opacity: 0.68; }
            }
            .pn-chev-l { animation: pn-div-chev-l 2.4s cubic-bezier(0.5,0,0.5,1) infinite; }
            .pn-chev-r { animation: pn-div-chev-r 2.4s cubic-bezier(0.5,0,0.5,1) infinite; }
          `}</style>

          <button
            type="button"
            aria-label="Previous day"
            onClick={onPrev}
            disabled={!hasPrevDay || !onPrev}
            style={{
              position: "absolute",
              left: 0,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#fff1cd",
              // pointer-events lives on the <button>; the touch swipe still
              // works because the gesture listener is on a parent and the
              // button only fires `click` on tap (no drag).
              pointerEvents: (hasPrevDay && onPrev) ? "auto" : "none",
              zIndex: 3,
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "18px 18px 18px 14px",
              background: "transparent",
              border: "none",
              cursor: (hasPrevDay && onPrev) ? "pointer" : "default",
              opacity: hasPrevDay ? 1 : 0,
              transition: "opacity 0.35s ease",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <ChevLeft style={{ opacity: 0.42 }} />
            <span className="pn-chev-l" style={{ display: "inline-block" }}>
              <ChevLeft style={{ opacity: 0.42 }} />
            </span>
          </button>
          <button
            type="button"
            aria-label="Next day"
            onClick={onNext}
            disabled={!hasNextDay || !onNext}
            style={{
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#fff1cd",
              pointerEvents: (hasNextDay && onNext) ? "auto" : "none",
              zIndex: 3,
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "18px 14px 18px 18px",
              background: "transparent",
              border: "none",
              cursor: (hasNextDay && onNext) ? "pointer" : "default",
              opacity: hasNextDay ? 1 : 0,
              transition: "opacity 0.35s ease",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span className="pn-chev-r" style={{ display: "inline-block" }}>
              <ChevRight style={{ opacity: 0.42 }} />
            </span>
            <ChevRight style={{ opacity: 0.42 }} />
          </button>
        </>
      )}

      <div className="relative z-10 flex flex-col items-center gap-4 px-8 text-center">
        <div style={{ width: 40, height: 1, background: "rgba(255,241,205,0.3)" }} />
        <div className="flex flex-col items-center gap-1">
          <span
            style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "38px", lineHeight: 1.1, color: "#fff1cd", letterSpacing: "0.03em", textTransform: "uppercase" }}
          >
            {label}
          </span>
          <span
            style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "15px", color: "rgba(255,241,205,0.6)", letterSpacing: "0.06em", textTransform: "uppercase" }}
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

        {showDots && (
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 6,
            }}
          >
            {Array.from({ length: Math.min(daysLoaded!, 9) }).map((_, i) => {
              // When daysLoaded > 9 we show the first 8 + a trailing ellipsis marker.
              const shownCount = Math.min(daysLoaded!, 9);
              const isEllipsis = daysLoaded! > 9 && i === shownCount - 1;
              // The rail is rendered with oldest on the left, so dot index i
              // spatially corresponds to dataIdx = (daysLoaded - 1 - i).
              const isActive = i === activeDotIdx;
              if (isEllipsis) {
                return (
                  <span
                    key={`ell-${i}`}
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: "10px",
                      color: "rgba(255,241,205,0.35)",
                      letterSpacing: "0.08em",
                      lineHeight: 1,
                    }}
                  >
                    ···
                  </span>
                );
              }
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    width: isActive ? 6 : 4,
                    height: isActive ? 6 : 4,
                    borderRadius: "50%",
                    background: isActive ? "#fff1cd" : "rgba(255,241,205,0.3)",
                    transition: "width 0.25s ease, height 0.25s ease, background 0.25s ease",
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
