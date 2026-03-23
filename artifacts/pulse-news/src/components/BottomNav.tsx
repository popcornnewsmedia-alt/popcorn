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
    <div
      className="fixed bottom-0 inset-x-0 z-40 flex pb-safe"
      style={{
        background: 'rgba(236, 243, 239, 0.96)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        borderTop: '1px solid rgba(26,68,48,0.12)',
      }}
    >
      {tabs.map(({ id, Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="flex-1 flex items-center justify-center py-5 transition-all duration-150"
          >
            <Icon
              style={{
                width: '24px',
                height: '24px',
                color: '#000000',
                fill: active ? '#000000' : 'none',
                strokeWidth: active ? 1.8 : 1.6,
                transition: 'all 0.15s',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
