import { House, Bookmark, User } from "lucide-react";

type Tab = "feed" | "saved" | "profile";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; Icon: typeof House }[] = [
  { id: "feed",    label: "Home",    Icon: House    },
  { id: "saved",   label: "Saved",   Icon: Bookmark },
  { id: "profile", label: "Profile", Icon: User     },
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
      {tabs.map(({ id, label, Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 transition-all duration-150"
          >
            <Icon
              style={{
                width: '22px',
                height: '22px',
                color: '#000000',
                opacity: active ? 1 : 0.38,
                strokeWidth: active ? 2.2 : 1.5,
                transition: 'all 0.15s',
              }}
            />
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: active ? 700 : 400,
                letterSpacing: '0.01em',
                color: '#000000',
                opacity: active ? 1 : 0.38,
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
