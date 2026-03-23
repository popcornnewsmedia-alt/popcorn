import { format } from "date-fns";

export function TopBar() {
  const today = new Date();

  return (
    <div
      className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-5 py-3"
      style={{
        background: 'rgba(10, 14, 11, 0.88)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
      }}
    >
      {/* Brand */}
      <span
        className="font-['Manrope'] font-bold tracking-tight"
        style={{ fontSize: '22px', color: '#ffffff', letterSpacing: '-0.02em' }}
      >
        Bref.
      </span>

      {/* Date */}
      <span
        className="font-['Inter'] font-medium"
        style={{ fontSize: '12px', color: '#ffffff', letterSpacing: '0.03em' }}
      >
        {format(today, 'EEE d MMM').toUpperCase()}
      </span>
    </div>
  );
}
