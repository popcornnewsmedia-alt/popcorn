import { format } from "date-fns";

export function TopBar() {
  const today = new Date();

  return (
    <div
      className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-5 py-3"
      style={{
        background: 'rgba(236, 243, 239, 0.82)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        borderBottom: '1px solid rgba(26,68,48,0.10)',
        boxShadow: '0 2px 16px rgba(26,68,48,0.08)',
      }}
    >
      {/* Brand */}
      <span
        className="font-['Manrope'] font-bold tracking-tight"
        style={{ fontSize: '22px', color: '#0f2a1a', letterSpacing: '-0.02em' }}
      >
        Bref.
      </span>

      {/* Date */}
      <span
        className="font-['Inter'] font-medium"
        style={{ fontSize: '12px', color: 'rgba(15,42,26,0.45)', letterSpacing: '0.03em' }}
      >
        {format(today, 'EEE d MMM').toUpperCase()}
      </span>
    </div>
  );
}
