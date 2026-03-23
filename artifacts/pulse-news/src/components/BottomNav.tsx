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
    <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none pb-safe">
      <div
        className="pointer-events-auto flex items-center gap-1 p-1.5 rounded-full"
        style={{
          background: 'rgba(236, 243, 239, 0.88)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(255,255,255,0.70)',
          boxShadow: '0 8px 40px rgba(26,68,48,0.18), 0 2px 8px rgba(26,68,48,0.10), inset 0 1px 0 rgba(255,255,255,0.90)',
        }}
      >
        {tabs.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="relative flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-200"
              style={active ? {
                background: 'rgba(26, 68, 48, 0.10)',
              } : {}}
            >
              <Icon
                className="w-4 h-4 transition-all duration-200"
                style={{ color: active ? '#0f2a1a' : 'rgba(0,0,0,0.35)' }}
                strokeWidth={active ? 2.2 : 1.6}
              />
              {active && (
                <span
                  className="text-xs font-semibold font-['Inter'] tracking-wide"
                  style={{ color: '#0f2a1a' }}
                >
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
