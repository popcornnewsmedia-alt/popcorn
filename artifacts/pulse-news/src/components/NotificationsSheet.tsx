import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { GrainBackground } from "@/components/GrainBackground";
import { supabase } from "@/lib/supabase";
import { formatRelative } from "@/lib/identity";
import { avatarColor } from "@/lib/avatar";
import type { DBNotification } from "@/lib/comments-types";

interface NotificationsSheetProps {
  isOpen: boolean;
  items: DBNotification[];
  loading: boolean;
  onClose: () => void;
  onSelect: (n: DBNotification) => void;
}

/**
 * Bottom sheet listing the signed-in user's reply notifications. Matches the
 * dark-blue + cream identity of LegalSheet/SignInSheet so it lives cleanly
 * under the profile popcorn icon. Follows the same rainbow-fringing guard
 * as CommentSheet / LegalSheet (boxShadow + backdrop-filter + GrainBackground
 * gated on `isOpen`).
 */
export function NotificationsSheet({ isOpen, items, loading, onClose, onSelect }: NotificationsSheetProps) {
  const stopProp = (e: React.MouseEvent) => e.stopPropagation();
  const handleClose = (e: React.MouseEvent) => { e.stopPropagation(); onClose(); };

  // ── Drag-down-to-close ──────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    if (delta <= 0 || scrollTop > 2) { setDragOffset(0); return; }
    if (!isDragging.current && delta < 10) return;
    isDragging.current = true;
    setDragOffset(delta);
  }, []);
  const handleTouchEnd = useCallback(() => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    if (dragOffset > 80) { setDragOffset(0); onClose(); } else { setDragOffset(0); }
    isDragging.current = false;
  }, [dragOffset, onClose]);

  // ── Article title lookup ─────────────────────────────────────────────────
  // Titles aren't stored on the notification row — one query per open fills a
  // map of articleId → title so each row can show context.
  const [titleMap, setTitleMap] = useState<Map<number, string>>(new Map());
  const uniqArticleIds = useMemo(() => {
    const s = new Set<number>();
    for (const n of items) s.add(n.article_id);
    return Array.from(s);
  }, [items]);

  useEffect(() => {
    if (!isOpen || uniqArticleIds.length === 0) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("articles")
        .select("id,title")
        .in("id", uniqArticleIds);
      if (cancelled || !data) return;
      setTitleMap(prev => {
        const next = new Map(prev);
        for (const row of data as { id: number; title: string }[]) next.set(row.id, row.title);
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [isOpen, uniqArticleIds.join(",")]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[230] transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.72)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={handleClose}
      />
      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[230] flex flex-col overflow-hidden mx-auto"
        style={{
          height: '82dvh',
          maxWidth: '480px',
          background: '#053980',
          borderRadius: '20px 20px 0 0',
          transform: isOpen ? `translateY(${dragOffset}px)` : 'translateY(100%)',
          transition: dragOffset > 0 ? 'none' : 'transform 0.38s cubic-bezier(0.32,0.72,0,1)',
          // Gate shadow on isOpen to avoid the rainbow-fringing bug
          // (closed sheets still paint upward shadows into the viewport).
          boxShadow: isOpen ? '0 -24px 64px rgba(0,0,0,0.45)' : 'none',
        }}
        onClick={stopProp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grain only while open */}
        {isOpen && <GrainBackground />}

        {/* Handle */}
        <div className="relative z-10 flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,241,205,0.30)' }} />
        </div>

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute right-5 z-20 p-2 rounded-full transition-opacity hover:opacity-60 active:opacity-50"
          style={{ background: 'rgba(255,241,205,0.10)', top: 'calc(14px + env(safe-area-inset-top))' }}
          aria-label="Close"
        >
          <X className="w-4 h-4" style={{ color: 'rgba(255,241,205,0.80)' }} />
        </button>

        {/* Header */}
        <div className="relative z-10 px-6 pt-6 pb-5 flex-shrink-0">
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: '10px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255,241,205,0.38)',
            marginBottom: '10px',
          }}>
            Popcorn · Activity
          </p>
          <h1 style={{
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontSize: 'clamp(16px, 4.5vw, 21px)',
            lineHeight: 0.94,
            color: '#fff1cd',
            letterSpacing: '0.015em',
            textTransform: 'uppercase',
          }}>
            Notifications
          </h1>
        </div>

        <div className="relative z-10 mx-6" style={{ height: '1px', background: 'rgba(255,241,205,0.14)' }} />

        {/* List */}
        <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto overscroll-contain scrollbar-hide">
          {loading && items.length === 0 ? (
            <div className="px-6 pt-10 text-center">
              <p className="font-['Inter']" style={{ fontSize: 12, color: 'rgba(255,241,205,0.5)' }}>
                Loading…
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="px-8 pt-14 text-center">
              <p style={{
                fontFamily: "'Macabro', 'Anton', sans-serif",
                fontSize: 13,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#fff1cd',
                marginBottom: 8,
              }}>
                Quiet for now
              </p>
              <p className="font-['Lora']" style={{ fontSize: 12.5, lineHeight: 1.6, color: '#fff1cd' }}>
                When someone replies to one of your comments, you'll hear about it here.
              </p>
            </div>
          ) : (
            <div className="pb-20">
              {items.map((n, i) => {
                const title = titleMap.get(n.article_id);
                const unread = !n.read_at;
                return (
                  <button
                    key={n.id}
                    onClick={(e) => { e.stopPropagation(); onSelect(n); }}
                    className="w-full text-left transition-colors active:opacity-80"
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '14px 20px',
                      borderBottom: i < items.length - 1 ? '1px solid rgba(255,241,205,0.08)' : 'none',
                      background: unread ? 'rgba(255,241,205,0.04)' : 'transparent',
                    }}
                  >
                    {/* Actor avatar */}
                    <div style={{
                      width: 34, height: 34,
                      borderRadius: '50%',
                      background: avatarColor(n.actor_name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontFamily: "'Macabro', 'Anton', sans-serif",
                        fontSize: 12,
                        color: '#fff1cd',
                        letterSpacing: '0.02em',
                        lineHeight: 1,
                      }}>
                        {initialsOf(n.actor_name)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2" style={{ flexWrap: 'wrap' }}>
                        <span style={{
                          fontFamily: "'Macabro', 'Anton', sans-serif",
                          fontSize: 11,
                          color: '#fff1cd',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}>
                          {n.actor_name}
                        </span>
                        <span style={{
                          fontFamily: "'Manrope', sans-serif",
                          fontSize: 10.5,
                          color: 'rgba(255,241,205,0.42)',
                        }}>
                          replied · {formatRelative(n.created_at)}
                        </span>
                        {unread && (
                          <span style={{
                            width: 6, height: 6,
                            borderRadius: '50%',
                            background: '#e14b3a',
                            flexShrink: 0,
                            marginLeft: 2,
                          }} />
                        )}
                      </div>

                      <p className="font-['Lora']" style={{
                        marginTop: 4,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: 'rgba(255,241,205,0.82)',
                      }}>
                        {n.preview}
                      </p>

                      {title && (
                        <p className="font-['Inter'] truncate" style={{
                          marginTop: 6,
                          fontSize: 10.5,
                          letterSpacing: '0.04em',
                          color: 'rgba(255,241,205,0.42)',
                        }}>
                          on {title}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? "").join("") || "?";
}
