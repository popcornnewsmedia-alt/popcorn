import { useEffect, useState } from "react";
import { isStandalone } from "@/lib/utils";

// Desktop web: ≥1024px viewport AND not running inside Capacitor / PWA.
// The Capacitor iOS shell and installed PWAs always get the mobile feed,
// regardless of viewport (an iPad shouldn't suddenly switch layouts when
// rotated). All other browsers fall back to mobile below the breakpoint.
const DESKTOP_WEB_MIN_WIDTH = 1024;

function compute(): boolean {
  if (typeof window === "undefined") return false;
  if (isStandalone) return false;
  return window.innerWidth >= DESKTOP_WEB_MIN_WIDTH;
}

export function useIsDesktopWeb(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => compute());

  useEffect(() => {
    const onResize = () => setIsDesktop(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isDesktop;
}
