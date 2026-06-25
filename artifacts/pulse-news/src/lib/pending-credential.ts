// In-memory holder for a just-signed-up credential, used ONLY to bridge the
// gap between sign-up and email verification on native (iOS/Android), where the
// app receives no Supabase session until the email is confirmed.
//
// After sign-up we stash the email+password here so the VerifyEmailGate can,
// once the user has verified (on ANY device), call signInWithPassword to pull a
// fresh verified session onto THIS device in a single tap — no re-typing.
//
// SECURITY: this lives in module memory only. It is NEVER written to
// localStorage / Preferences / disk, and it evaporates when the app process is
// killed. If it's gone (app relaunched, or the user verified on a different
// device with a fresh app), the gate falls back to asking for the password.

let pending: { email: string; password: string } | null = null;

export function setPendingCredential(email: string, password: string): void {
  pending = { email: email.trim().toLowerCase(), password };
}

/** Returns the cached password only if it matches the given email. */
export function getPendingCredential(email: string): string | null {
  if (!pending) return null;
  return pending.email === email.trim().toLowerCase() ? pending.password : null;
}

export function clearPendingCredential(): void {
  pending = null;
}
