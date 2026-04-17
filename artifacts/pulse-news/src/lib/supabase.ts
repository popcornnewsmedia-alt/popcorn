import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  {
    auth: {
      // Disable the default navigator.locks-based inter-tab lock. It causes
      // a 5-second stall on every auth call during dev HMR (stale client
      // instances hold orphaned locks) and isn't needed for our single-tab
      // flow. Multi-tab users may see slightly stale auth across tabs, but
      // a token refresh will reconcile.
      lock: async (_name, _acquireTimeout, fn) => fn(),
    },
  },
);
