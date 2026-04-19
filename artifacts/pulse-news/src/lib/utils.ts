import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True when running as an Add-to-Home-Screen / standalone PWA, or inside a
 *  Capacitor native shell (iOS/Android). In both cases we own the full screen
 *  (no browser chrome), so the layout should cover the status bar + home area. */
export const isStandalone =
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
   (window.navigator as any).standalone === true ||
   (window as any).Capacitor?.isNativePlatform?.() === true ||
   window.location.protocol === 'capacitor:');
