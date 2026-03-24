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
    <div className="fixed bottom-0 inset-x-0 z-40 flex justify-around items-end pb-8 pointer-events-none">
      {tabs.map(({ id, Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="pointer-events-auto flex items-center justify-center transition-all duration-200"
            style={{ width: 52, height: 52 }}
          >
            <Icon
              style={{
                width: 24,
                height: 24,
                color: '#191c1b',
                fill: active ? '#191c1b' : 'none',
                strokeWidth: active ? 1.8 : 1.5,
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.22))',
                transition: 'all 0.2s',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
