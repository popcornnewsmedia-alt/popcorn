import { House, Bookmark, User } from "lucide-react";
import { isStandalone } from "@/lib/utils";

type Tab = "feed" | "saved" | "profile";

const TABS: { id: Tab; Icon: typeof House; label: string }[] = [
  { id: "feed",    Icon: House,    label: "HOME"  },
  { id: "saved",   Icon: Bookmark, label: "SAVED" },
  { id: "profile", Icon: User,     label: "YOU"   },
];

const BTN_W     = 68;
const BTN_H     = isStandalone ? 54 : 38;
const PAD       = isStandalone ? 4  : 3;
const ICON_SIZE = isStandalone ? 19 : 15;

export function BottomNav({
  activeTab,
  onTabChange,
  hasProfileDot = false,
}: {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  hasProfileDot?: boolean;
}) {
  const activeIndex = TABS.findIndex(t => t.id === activeTab);

  return (
    <div
      className="pn-bottom-nav fixed bottom-0 inset-x-0 z-40 flex justify-center pointer-events-none"
      style={{
        // In standalone PWA, push the nav flush to the bottom safe area edge
        paddingBottom: isStandalone
          ? 'env(safe-area-inset-bottom)'
          : '10px',
        transition: 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.32,0.72,0,1)',
      }}
    >
      <div
        className="relative flex items-center pointer-events-auto"
        style={{
          background: 'rgba(7,11,9,0.93)',
          borderRadius: 999,
          border: '1px solid rgba(255,241,205,0.10)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.50), 0 1px 0 rgba(255,241,205,0.07) inset',
          padding: `${PAD}px`,
        }}
      >
        {/* Sliding cream indicator */}
        <div
          style={{
            position: 'absolute',
            width: BTN_W,
            height: BTN_H,
            borderRadius: 999,
            background: 'rgba(255,241,205,0.11)',
            boxShadow: '0 0 16px rgba(255,241,205,0.07)',
            transform: `translateX(${activeIndex * BTN_W}px)`,
            transition: 'transform 0.42s cubic-bezier(0.34, 1.5, 0.64, 1)',
            left: PAD,
            top: PAD,
            pointerEvents: 'none',
          }}
        />

        {TABS.map(({ id, Icon, label }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="relative z-10 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform duration-100"
              style={{ width: BTN_W, height: BTN_H }}
            >
              <div style={{ position: 'relative', width: ICON_SIZE, height: ICON_SIZE }}>
                <Icon
                  style={{
                    width: ICON_SIZE,
                    height: ICON_SIZE,
                    color: active ? '#fff1cd' : 'rgba(255,241,205,0.28)',
                    fill: active && id !== 'profile' ? '#fff1cd' : 'none',
                    strokeWidth: 1.6,
                    transition: 'color 0.25s, fill 0.25s',
                  }}
                />
                {id === 'profile' && hasProfileDot && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -3,
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      background: '#e14b3a',
                      boxShadow: '0 0 0 1.5px rgba(7,11,9,0.93)',
                    }}
                  />
                )}
              </div>
              {isStandalone && (
                <span
                  style={{
                    fontFamily: "'Macabro', 'Anton', sans-serif",
                    fontSize: '7.5px',
                    color: active ? 'rgba(255,241,205,0.80)' : 'rgba(255,241,205,0.22)',
                    letterSpacing: '0.09em',
                    lineHeight: 1,
                    transition: 'color 0.25s',
                  }}
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
