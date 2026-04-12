# Resend Email Setup Guide

Popcorn now uses **Resend** for sending branded verification and welcome emails.

## What's Included

✅ **Two branded email templates:**
- `VerifyEmail.tsx` - Account verification email
- `WelcomeEmail.tsx` - Welcome onboarding email

✅ **Three new API endpoints:**
- `POST /api/auth/signup` - Create account + send verification email
- `POST /api/auth/send-welcome` - Send welcome email after verification
- `POST /api/auth/resend-verification` - Resend verification link

✅ **Full Popcorn branding:**
- Dark blue (`#053980`) + cream (`#fff1cd`) color scheme
- Custom fonts: Macabro, Manrope, Lora
- Responsive design for all email clients
- Grain background simulation

## Setup Instructions

### Step 1: Get Resend API Key

1. Go to https://resend.com
2. Sign up or log in
3. Navigate to **API Keys** (https://resend.com/api-keys)
4. Copy your API key

### Step 2: Update Environment Variables

Add to your `.env` file:

```env
RESEND_API_KEY=re_YOUR_API_KEY_HERE
APP_URL=https://popcornmedia.org
```

For local development:
```env
RESEND_API_KEY=re_YOUR_API_KEY_HERE
APP_URL=http://localhost:5173
```

### Step 3: Verify Sender Email

1. In Resend dashboard, go to **Senders**
2. Add `noreply@popcornmedia.org` as an authorized sender
3. For production, you'll need to verify domain ownership

### Step 4: Test the Endpoints

#### Create Account & Send Verification Email

```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepassword",
    "name": "Test User"
  }'
```

**Response:**
```json
{
  "message": "Verification email sent",
  "userId": "uuid-here",
  "email": "test@example.com"
}
```

#### Send Welcome Email

```bash
curl -X POST http://localhost:3001/api/auth/send-welcome \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid-from-signup",
    "email": "test@example.com",
    "name": "Test User"
  }'
```

**Response:**
```json
{
  "message": "Welcome email sent successfully",
  "userId": "uuid-here",
  "email": "test@example.com"
}
```

### Step 5: Monitor Emails

1. Go to https://resend.com/emails
2. Watch for incoming emails from your tests
3. Check delivery status, opens, clicks

## Email Templates

### VerifyEmail.tsx

**When to send:**
- After user signs up via `/api/auth/signup`
- When user requests resend via `/api/auth/resend-verification`

**Contains:**
- Account verification button linking to email confirmation
- Alternative link for email clients that don't support buttons
- Support contact information

### WelcomeEmail.tsx

**When to send:**
- After email is verified (user clicks confirmation link)
- Called via `POST /api/auth/send-welcome` in your frontend/backend flow

**Contains:**
- Warm personalized greeting
- "The Popcorn Difference" - explains curated approach
- Feature highlights (personalized feed, discussions, saves)
- Call-to-action to start reading
- Engaging, friendly copy with proper typography

## Frontend Integration

Update `SignUpFlow.tsx` to call the new endpoints:

```typescript
// Instead of calling Supabase directly:
// const { data } = await signUp(email, password, name);

// Call your API:
const response = await fetch("/api/auth/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, name }),
});

const data = await response.json();

if (response.ok) {
  // Show "Check your email" message
  setEmailSent(true);
}
```

After email confirmation (when Supabase auth succeeds):

```typescript
// Send welcome email
await fetch("/api/auth/send-welcome", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: user.id,
    email: user.email,
    name: user.name || "Reader",
  }),
});
```

## Resend Features

### Email Tracking
- **Opens:** Track when users open emails
- **Clicks:** Track link clicks
- **Bounces:** Automatic bounce detection

### Delivery
- **98%+ inbox placement** - Resend handles reputation & authentication
- **DKIM, SPF, DMARC** - Automatic configuration for custom domains
- **Rate limiting:** 100 emails/sec, unlimited per month

### Pricing
- **Free tier:** 100 emails/day
- **Paid:** $0.20 per 1,000 emails
- **No setup fees, no monthly minimums**

## Troubleshooting

### "Invalid API Key"
- Verify `RESEND_API_KEY` is set correctly in `.env`
- Check that the key hasn't expired in Resend dashboard

### "Unauthorized sender address"
- Verify `noreply@popcornmedia.org` is added as an authorized sender
- For production, verify domain ownership in Resend

### Email not arriving
1. Check Resend dashboard for bounce/failed delivery
2. Verify recipient email address is correct
3. Check spam/junk folder
4. For Gmail, whitelist `mail.popcornmedia.org`

### Email styling issues
- Most email clients support the styles used
- Test across Gmail, Outlook, Apple Mail
- Use Resend's preview feature to see how it renders

## File Locations

```
artifacts/api-server/src/
├── emails/
│   ├── VerifyEmail.tsx         # Verification email component
│   ├── WelcomeEmail.tsx        # Welcome email component
│   └── README.md               # Email-specific documentation
├── lib/
│   └── resend-client.ts        # Resend helper functions
├── routes/
│   ├── auth.ts                 # Auth endpoints
│   └── index.ts                # Routes registration
```

## Next Steps

1. ✅ Code is deployed
2. ⏳ Add `RESEND_API_KEY` to your `.env`
3. ⏳ Update frontend `SignUpFlow.tsx` to call new endpoints
4. ⏳ Test verification and welcome emails
5. ⏳ Deploy to production with valid domain

## Questions?

- **Resend docs:** https://resend.com/docs
- **React Email docs:** https://react.email
- **Popcorn email code:** `artifacts/api-server/src/emails/`
