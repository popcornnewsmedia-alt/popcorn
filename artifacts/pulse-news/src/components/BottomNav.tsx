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
          background: 'rgba(10, 22, 14, 0.82)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(86, 185, 130, 0.18)',
          boxShadow: '0 8px 40px rgba(10,22,14,0.45), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
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
                background: 'rgba(86, 185, 130, 0.15)',
                boxShadow: '0 0 16px rgba(86,185,130,0.20)',
              } : {}}
            >
              <Icon
                className="w-4 h-4 transition-all duration-200"
                style={{ color: active ? '#86efac' : 'rgba(255,255,255,0.38)' }}
                strokeWidth={active ? 2.2 : 1.6}
              />
              {active && (
                <span
                  className="text-xs font-semibold font-['Inter'] tracking-wide"
                  style={{ color: '#86efac' }}
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
