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
    <div className="fixed bottom-5 inset-x-0 z-40 flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex items-center rounded-full"
        style={{
          background: 'rgba(236, 243, 239, 0.92)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(26,68,48,0.12)',
          boxShadow: '0 4px 24px rgba(26,68,48,0.14)',
          padding: '5px',
          gap: '2px',
        }}
      >
        {tabs.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex flex-col items-center justify-center transition-all duration-200 rounded-full"
              style={{
                width: '80px',
                paddingTop: '8px',
                paddingBottom: '8px',
                gap: '3px',
                background: active ? 'rgba(15,42,26,0.09)' : 'transparent',
              }}
            >
              <Icon
                className="transition-all duration-200"
                style={{
                  width: '18px',
                  height: '18px',
                  color: active ? '#0f2a1a' : 'rgba(15,42,26,0.30)',
                  strokeWidth: active ? 2.1 : 1.6,
                }}
              />
              <span
                className="font-['Inter'] tracking-wide transition-all duration-200"
                style={{
                  fontSize: '10px',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#0f2a1a' : 'rgba(15,42,26,0.30)',
                  letterSpacing: '0.02em',
                }}
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
