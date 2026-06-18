import { useEffect, useState } from "react";
import { isStandalone } from "@/lib/utils";

// Desktop web is decided by DEVICE, not viewport width. A real desktop
// browser (mouse + hover) always gets the editorial DesktopHome layout no
// matter how narrow the window is dragged; touch phones/tablets always get
// the mobile FeedPage. This keeps the web experience stable across window
// resizes. The Capacitor iOS shell and installed PWAs always get the mobile
// feed regardless of pointer type.
const DESKTOP_POINTER_QUERY = "(pointer: fine) and (hover: hover)";

function compute(): boolean {
  if (typeof window === "undefined") return false;
  // Dev/preview override: localStorage "popcorn-force-view" = "mobile" | "desktop"
  // lets a desktop browser preview the mobile app feed (and vice versa).
  try {
    const forced = window.localStorage?.getItem("popcorn-force-view");
    if (forced === "mobile") return false;
    if (forced === "desktop") return true;
  } catch {
    /* ignore storage access errors */
  }
  if (isStandalone) return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(DESKTOP_POINTER_QUERY).matches;
}

export function useIsDesktopWeb(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => compute());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(DESKTOP_POINTER_QUERY);
    const onChange = () => setIsDesktop(compute());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
