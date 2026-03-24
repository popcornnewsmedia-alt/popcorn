import { House, Bookmark, User } from "lucide-react";

type Tab = "feed" | "saved" | "profile";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; Icon: typeof House }[] = [
  { id: "feed",    Icon: House    },
  { id: "saved",   Icon: Bookmark },
  { id: "profile", Icon: User     },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 flex justify-center pb-4 pointer-events-none">
      <div
        className="flex items-center gap-1 px-3 py-2.5 pointer-events-auto"
        style={{
          background: 'rgba(220,238,228,0.96)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderRadius: '100px',
          border: '1px solid rgba(26,68,48,0.14)',
          boxShadow: '0 8px 32px rgba(26,68,48,0.16), 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.60)',
        }}
      >
        {tabs.map(({ id, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="relative flex items-center justify-center transition-all duration-200"
              style={{
                width: 52,
                height: 44,
                borderRadius: 80,
                background: active ? 'rgba(26,68,48,0.12)' : 'transparent',
              }}
            >
              <Icon
                style={{
                  width: 21,
                  height: 21,
                  color: '#191c1b',
                  fill: active ? '#191c1b' : 'none',
                  strokeWidth: active ? 1.8 : 1.6,
                  transition: 'all 0.2s',
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
