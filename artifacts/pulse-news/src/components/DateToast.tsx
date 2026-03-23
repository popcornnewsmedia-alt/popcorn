import { useEffect, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";

interface DateToastProps {
  triggerKey: number;
  date: Date | null;
}

export function DateToast({ triggerKey, date }: DateToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!date || triggerKey === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [triggerKey]);

  if (!date) return null;

  const label = isToday(date)
    ? "Today"
    : isYesterday(date)
    ? "Yesterday"
    : format(date, "EEEE, do MMMM");

  return (
    <div
      className="fixed z-40 left-1/2 pointer-events-none"
      style={{
        top: '72px',
        transform: `translateX(-50%) translateY(${visible ? '0px' : '-6px'})`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.28s ease, transform 0.28s ease',
      }}
    >
      <div
        className="flex items-center gap-2 px-5 py-2.5 rounded-full"
        style={{
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.30)',
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: '#4ade80' }}
        />
        <span
          className="font-['Inter'] font-semibold text-white"
          style={{ fontSize: '13px', letterSpacing: '0.01em' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
