import { Sparkles, Bookmark, User } from "lucide-react";

type Tab = "feed" | "saved" | "profile";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; Icon: typeof Sparkles }[] = [
  { id: "feed",    label: "For You",  Icon: Sparkles  },
  { id: "saved",   label: "Saved",    Icon: Bookmark  },
  { id: "profile", label: "Profile",  Icon: User      },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 pb-safe"
      style={{
        background: 'rgba(236, 243, 239, 0.72)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        borderTop: '1px solid rgba(255,255,255,0.55)',
        boxShadow: '0 -4px 32px rgba(26,68,48,0.10)',
      }}
    >
      {/* Subtle green atmospheric bloom behind the bar */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 120%, rgba(44,82,62,0.18) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex items-center justify-around px-6 py-2">
        {tabs.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex flex-col items-center gap-1 py-1 px-5 transition-all"
            >
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all"
                style={active ? {
                  background: 'rgba(26, 68, 48, 0.12)',
                  border: '1px solid rgba(44, 130, 80, 0.22)',
                } : {}}
              >
                <Icon
                  className="w-5 h-5 transition-all"
                  style={{ color: active ? '#1a4430' : 'rgba(71,71,71,0.45)' }}
                  strokeWidth={active ? 2.2 : 1.7}
                />
              </div>
              <span
                className="text-[10px] font-semibold tracking-wide font-['Inter'] transition-all"
                style={{ color: active ? '#1a4430' : 'rgba(71,71,71,0.45)' }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
