import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { GrainBackground } from "./GrainBackground";

interface DayCompletionCardProps {
  /** The day that has just been completed (same date as the opening divider). */
  date: Date;
  /** Stable id for the snap slide (useful for imperative scrollTo). */
  id: string;
  /** Full-viewport height passed down from the feed page. */
  viewportHeight?: number;
  /** Fires when the slide scrolls into view — mirrors DateDividerCard.onEnter. */
  onEnter?: (date: Date) => void;

  /** True when a chronologically-earlier day is loaded & navigable. */
  hasPrevDay?: boolean;
  /** True when a chronologically-later day is loaded & navigable. */
  hasNextDay?: boolean;
  /** The older day's Date (for label + sub-label). */
  prevDate?: Date | null;
  /** The newer day's Date (for label + sub-label). */
  nextDate?: Date | null;
  /** Jump to the older day's opening divider. */
  onGoToPrev?: () => void;
  /** Jump to the newer day's opening divider. */
  onGoToNext?: () => void;
}

// Same 1-px editorial chevrons as DateDividerCard — kept as typography, not UI.
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

// Always return the literal weekday name — this slide and its nav pills
// intentionally use concrete day names rather than relative shorthand, so
// Saturday's closing card nav says "SUNDAY" (not "YESTERDAY") and the
// supporting copy always reads "…for Saturday, 18th April 2026."
function dayLabel(d: Date): string {
  return format(d, "EEEE");
}

/**
 * Closing slide that appears at the bottom of each day's feed. Visually rhymes
 * with DateDividerCard (same dark-blue + cream + grain identity) but swaps the
 * "SCROLL TO CONTINUE" cue for two editorial day-nav pills so the user can
 * step forward / backward through loaded days without pulling the app-wide
 * date picker.
 *
 * When either pill is tapped the parent calls `landOnDay(idx)` which already
 * forces the target day's scrollTop to 0 — so the reader always lands on the
 * next day's opening DateDividerCard, as requested.
 */
export function DayCompletionCard({
  date,
  id,
  viewportHeight,
  onEnter,
  hasPrevDay = false,
  hasNextDay = false,
  prevDate,
  nextDate,
  onGoToPrev,
  onGoToNext,
}: DayCompletionCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onEnter || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onEnter(date); },
      { threshold: 0.6 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [date, onEnter]);

  const sub = format(date, "do MMMM yyyy");
  // Supporting line always names the weekday + full date (e.g. "Saturday,
  // 18th April 2026") — no Today/Yesterday shorthand, so the closing card
  // always reads as a concrete moment the user just finished.
  const supportingSubject = `${dayLabel(date)}, ${sub}`;

  const prevEnabled = hasPrevDay && !!prevDate && !!onGoToPrev;
  const nextEnabled = hasNextDay && !!nextDate && !!onGoToNext;

  return (
    <div
      id={id}
      ref={ref}
      className="w-full snap-start snap-always relative overflow-hidden flex flex-col items-center justify-center"
      style={{ height: viewportHeight ?? "100%", background: "#053980" }}
    >
      <GrainBackground />

      {/* Slide-local keyframes — match the subtle grammar of DateDividerCard's
          chevron breathing but applied as staggered fade-ups for the closing
          moment. Kept inline so the component is drop-in. */}
      <style>{`
        @keyframes pn-comp-fadeup {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pn-comp-kernel-pulse {
          0%, 100% { opacity: 0.42; transform: scale(1); }
          50%      { opacity: 0.72; transform: scale(1.18); }
        }
        .pn-comp-reveal { animation: pn-comp-fadeup 0.55s cubic-bezier(0.16,1,0.3,1) both; }
        .pn-comp-reveal-1 { animation-delay: 0.00s; }
        .pn-comp-reveal-2 { animation-delay: 0.10s; }
        .pn-comp-reveal-3 { animation-delay: 0.22s; }
        .pn-comp-reveal-4 { animation-delay: 0.36s; }
        .pn-comp-kernel   { animation: pn-comp-kernel-pulse 3.2s cubic-bezier(0.5,0,0.5,1) infinite; }
        .pn-comp-nav-btn:active { transform: scale(0.975); }
      `}</style>

      <div
        className="relative z-10 flex flex-col items-center text-center"
        style={{ gap: 18, paddingLeft: 28, paddingRight: 28, width: "100%", maxWidth: 440 }}
      >
        {/* Eyebrow — dash-dot-dash row removed per design pass; the eyebrow
            alone is enough vertical rhythm above the headline. */}
        <p
          className="font-['Inter'] pn-comp-reveal pn-comp-reveal-1"
          style={{
            fontSize: 10,
            letterSpacing: "0.26em",
            color: "rgba(255,241,205,0.48)",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          End of Day
        </p>

        {/* Main headline — tuned down from the opening divider's 38px so the
            closing moment feels like a quiet exhale rather than a second peak. */}
        <div
          className="flex flex-col items-center pn-comp-reveal pn-comp-reveal-2"
          style={{ marginTop: 2 }}
        >
          <span
            style={{
              fontFamily: "'Macabro', 'Anton', sans-serif",
              fontSize: 24,
              lineHeight: 1.02,
              color: "#fff1cd",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            All Caught Up
          </span>
        </div>

        {/* Supporting line — italic Lora, now carrying the full date reference
            so the slide only has one typographic beat after the headline. */}
        <p
          className="font-['Lora'] pn-comp-reveal pn-comp-reveal-3"
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "#fff1cd",
            fontStyle: "italic",
            maxWidth: 300,
          }}
        >
          That's every story we curated for {supportingSubject}.
        </p>

        {/* Day-nav pair — stripped back to single-line editorial pills so the
            closing moment stays quiet. Pills are content-width (auto-sized to
            their weekday label) so they don't sprawl into empty space; the
            row centres them as a pair, mirroring the divider's nav row. */}
        <div
          className="pn-comp-reveal pn-comp-reveal-4"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 14,
            marginTop: 18,
          }}
        >
          {/* Previous (older) */}
          {prevEnabled ? (
            <button
              type="button"
              onClick={onGoToPrev}
              className="pn-comp-nav-btn transition-colors"
              aria-label={`Go to ${dayLabel(prevDate!)}, ${format(prevDate!, "d MMMM")}`}
              style={{
                color: "#fff1cd",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 8,
                padding: "7px 10px",
                background: "transparent",
                border: "1px solid rgba(255,241,205,0.14)",
                borderRadius: 999,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                transitionDuration: "180ms",
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
                {dayLabel(prevDate!)}
              </span>
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          {/* Next (newer) */}
          {nextEnabled ? (
            <button
              type="button"
              onClick={onGoToNext}
              className="pn-comp-nav-btn transition-colors"
              aria-label={`Go to ${dayLabel(nextDate!)}, ${format(nextDate!, "d MMMM")}`}
              style={{
                color: "#fff1cd",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8,
                padding: "7px 10px",
                background: "transparent",
                border: "1px solid rgba(255,241,205,0.14)",
                borderRadius: 999,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                transitionDuration: "180ms",
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
                {dayLabel(nextDate!)}
              </span>
              <ChevRight style={{ color: "rgba(255,241,205,0.55)" }} />
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}
