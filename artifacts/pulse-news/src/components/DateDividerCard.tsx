import { useEffect, useRef } from "react";
import { isToday, isYesterday, format } from "date-fns";
import { GrainBackground } from "./GrainBackground";

interface DateDividerCardProps {
  date: Date;
  dateId: string;
  onEnter?: (date: Date) => void;
}

export function DateDividerCard({ date, dateId, onEnter }: DateDividerCardProps) {
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

  return (
    <div
      id={dateId}
      ref={ref}
      className="h-[100dvh] w-full snap-start snap-always relative overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "#204a52" }}
    >
      <GrainBackground />

      <div className="relative z-10 flex flex-col items-center gap-4 px-8 text-center">
        <div style={{ width: 40, height: 1, background: "rgba(255,243,211,0.3)" }} />
        <div className="flex flex-col items-center gap-1">
          <span
            style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "38px", lineHeight: 1.1, color: "#fff3d3", letterSpacing: "0.03em", textTransform: "uppercase" }}
          >
            {label}
          </span>
          <span
            style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "15px", color: "rgba(255,243,211,0.6)", letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            {sub}
          </span>
        </div>
        <div style={{ width: 40, height: 1, background: "rgba(255,243,211,0.3)" }} />

        <p
          className="font-['Inter'] mt-3"
          style={{ fontSize: "12px", color: "rgba(255,243,211,0.45)", letterSpacing: "0.06em" }}
        >
          SCROLL TO CONTINUE
        </p>
      </div>
    </div>
  );
}
