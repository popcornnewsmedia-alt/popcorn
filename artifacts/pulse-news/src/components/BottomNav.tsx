import { Sparkles, Bookmark, User } from "lucide-react";

type Tab = "feed" | "saved" | "profile";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; Icon: typeof Sparkles }[] = [
  { id: "feed",    label: "For You",  Icon: Sparkles },
  { id: "saved",   label: "Saved",    Icon: Bookmark },
  { id: "profile", label: "Profile",  Icon: User     },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 flex pb-safe"
      style={{
        background: 'rgba(236, 243, 239, 0.94)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        borderTop: '1px solid rgba(26,68,48,0.10)',
      }}
    >
      {tabs.map(({ id, label, Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-3 relative transition-all duration-150"
          >
            {/* Active indicator line */}
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                style={{
                  width: '24px',
                  height: '2px',
                  background: '#0f2a1a',
                }}
              />
            )}

            <Icon
              style={{
                width: '20px',
                height: '20px',
                color: active ? '#0f2a1a' : 'rgba(15,42,26,0.28)',
                strokeWidth: active ? 2.1 : 1.6,
                transition: 'all 0.15s',
              }}
            />
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: active ? 700 : 500,
                letterSpacing: '0.02em',
                color: active ? '#0f2a1a' : 'rgba(15,42,26,0.28)',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
