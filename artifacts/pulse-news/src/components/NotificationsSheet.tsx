import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";
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
  onDelete?: (id: number) => void;
  onClearAll?: () => void;
}

/**
 * Bottom sheet listing the signed-in user's reply notifications. Matches the
 * dark-blue + cream identity of LegalSheet/SignInSheet so it lives cleanly
 * under the profile popcorn icon. Follows the same rainbow-fringing guard
 * as CommentSheet / LegalSheet (boxShadow + backdrop-filter + GrainBackground
 * gated on `isOpen`).
 */
export function NotificationsSheet({ isOpen, items, loading, onClose, onSelect, onDelete = () => {}, onClearAll = () => {} }: NotificationsSheetProps) {
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
          background: '#042c85',
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
        <div className="relative z-10 px-6 pt-6 pb-5 flex-shrink-0 flex items-end justify-between gap-3">
          <div>
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
          {items.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onClearAll(); }}
              className="flex-shrink-0 transition-opacity hover:opacity-70 active:opacity-50"
              style={{
                marginRight: '40px',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: '11px',
                letterSpacing: '0.04em',
                color: 'rgba(255,241,205,0.55)',
                padding: '4px 2px',
              }}
            >
              Clear all
            </button>
          )}
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
              {items.map((n, i) => (
                <SwipeRow
                  key={n.id}
                  n={n}
                  title={titleMap.get(n.article_id)}
                  isLast={i === items.length - 1}
                  onSelect={onSelect}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * A single notification row that can be swiped left to delete. A red trash
 * track sits behind the content; dragging left reveals it and releasing past
 * the threshold removes the row. Horizontal drags lock the axis and stop
 * propagation so they don't trigger the sheet's drag-to-close / scroll.
 */
function SwipeRow({
  n, title, isLast, onSelect, onDelete,
}: {
  n: DBNotification;
  title: string | undefined;
  isLast: boolean;
  onSelect: (n: DBNotification) => void;
  onDelete: (id: number) => void;
}) {
  const unread = !n.read_at;
  const [offset, setOffset] = useState(0);
  const [removing, setRemoving] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<null | "h" | "v">(null);
  const moved = useRef(false);

  // Past this drag distance, releasing commits the delete.
  const THRESHOLD = 88;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    axis.current = null;
    moved.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (axis.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (axis.current !== "h") return; // vertical → let the sheet handle it
    e.stopPropagation();               // keep the sheet from dragging/closing
    moved.current = true;
    // Only allow swiping left (negative); a little rubber-band past 0.
    setOffset(Math.min(0, dx));
  }, []);

  const commitDelete = useCallback(() => {
    setRemoving(true);
    setOffset(-window.innerWidth);
    window.setTimeout(() => onDelete(n.id), 180);
  }, [n.id, onDelete]);

  const onTouchEnd = useCallback(() => {
    if (axis.current === "h") {
      if (Math.abs(offset) > THRESHOLD) { commitDelete(); return; }
      setOffset(0);
    }
    axis.current = null;
  }, [offset, commitDelete]);

  const revealing = Math.abs(offset);

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        maxHeight: removing ? 0 : 200,
        opacity: removing ? 0 : 1,
        transition: removing ? 'max-height 0.22s ease, opacity 0.18s ease' : 'none',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,241,205,0.08)',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Delete track behind the row */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: '#b3261e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 24,
          opacity: revealing > 8 ? 1 : 0,
        }}
      >
        <Trash2 className="w-5 h-5" style={{ color: '#fff1cd', opacity: Math.min(1, revealing / THRESHOLD) }} />
      </div>

      {/* Foreground content — translates with the swipe */}
      <button
        onClick={(e) => { e.stopPropagation(); if (moved.current) return; onSelect(n); }}
        className="w-full text-left active:opacity-80"
        style={{
          position: 'relative',
          display: 'flex',
          gap: 12,
          padding: '14px 20px',
          background: unread ? '#073a9e' : '#042c85',
          transform: `translateX(${offset}px)`,
          transition: axis.current === 'h' && !removing ? 'none' : 'transform 0.28s cubic-bezier(0.32,0.72,0,1)',
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
              {n.actor_name.replace(/^@/, "")}
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
    </div>
  );
}

function initialsOf(name: string): string {
  const clean = name.replace(/^@/, "").trim();
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? "").join("") || "?";
}
