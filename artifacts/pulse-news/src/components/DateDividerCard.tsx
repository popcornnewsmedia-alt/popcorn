import { useEffect, useRef } from "react";
import { isToday, isYesterday, format } from "date-fns";

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
      style={{ background: "#ecf3ef" }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(26,68,48,0.28) 0%, transparent 50%),
            radial-gradient(circle at 78% 70%, rgba(44,82,62,0.22) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(26,68,48,0.08) 0%, transparent 65%)
          `,
          filter: "blur(56px)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-4 px-8 text-center">
        <div style={{ width: 40, height: 1, background: "rgba(0,0,0,0.18)" }} />
        <div className="flex flex-col items-center gap-1">
          <span
            className="font-['Manrope'] font-bold tracking-tight"
            style={{ fontSize: "32px", lineHeight: 1.1, color: "#000" }}
          >
            {label}
          </span>
          <span
            className="font-['Inter']"
            style={{ fontSize: "14px", color: "rgba(0,0,0,0.4)", letterSpacing: "0.04em" }}
          >
            {sub}
          </span>
        </div>
        <div style={{ width: 40, height: 1, background: "rgba(0,0,0,0.18)" }} />

        <p
          className="font-['Inter'] mt-3"
          style={{ fontSize: "12px", color: "rgba(0,0,0,0.3)", letterSpacing: "0.06em" }}
        >
          SCROLL TO CONTINUE
        </p>
      </div>
    </div>
  );
}
