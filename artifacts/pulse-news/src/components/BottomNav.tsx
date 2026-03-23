import { Newspaper, Bookmark, User } from "lucide-react";

type Tab = "feed" | "saved" | "profile";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; Icon: typeof Newspaper }[] = [
  { id: "feed",    label: "For You",  Icon: Newspaper },
  { id: "saved",   label: "Saved",    Icon: Bookmark  },
  { id: "profile", label: "Profile",  Icon: User      },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 flex pb-safe"
      style={{
        background: 'rgba(236, 243, 239, 0.96)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        borderTop: '1px solid rgba(26,68,48,0.12)',
      }}
    >
      {tabs.map(({ id, label, Icon }, i) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 relative transition-all duration-150"
            style={{
              borderRight: i < tabs.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none',
            }}
          >
            <Icon
              style={{
                width: '22px',
                height: '22px',
                color: active ? '#000000' : 'rgba(0,0,0,0.28)',
                strokeWidth: active ? 2.0 : 1.5,
                transition: 'all 0.15s',
              }}
            />
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: active ? 700 : 500,
                letterSpacing: '0.01em',
                color: active ? '#000000' : 'rgba(0,0,0,0.28)',
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
