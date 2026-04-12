# Popcorn Email Templates

This directory contains Resend email templates for Popcorn using React Email.

## Templates

### 1. VerifyEmail.tsx
Sent when a new user signs up. Contains:
- Branded header with Popcorn logo
- Clear call-to-action button for email verification
- Alternative link for email clients that don't render buttons properly
- Support contact information
- Professional footer

**Used by:** `/api/auth/signup` and `/api/auth/resend-verification`

### 2. WelcomeEmail.tsx
Sent after email is verified. Contains:
- Warm greeting
- "The Popcorn Difference" - mission explanation
- Benefits of the platform (curated, no noise, engaging)
- Feature highlights (personalized feed, discussions, bookmarks)
- Call-to-action to start reading
- Support contact information

**Used by:** `/api/auth/send-welcome`

## Branding

Both emails use Popcorn's signature brand colors:
- **Dark Blue:** `#053980` (primary)
- **Cream:** `#fff1cd` (accent)
- **Supporting colors:** `rgba(255,241,205,...)` for opacity variants

### Fonts

Emails use a fallback stack with Google Fonts:
- **Headings:** `Macabro`, `Anton` (fallback: sans-serif)
- **Body:** `Manrope` (fallback: sans-serif)
- **Editorial:** `Lora` (serif, italic for descriptions)
- **UI/Technical:** `Inter` (sans-serif)

## Sending Emails

### From `resend-client.ts`

```typescript
// Send verification email
await sendVerificationEmail(email, name, confirmLink);

// Send welcome email
await sendWelcomeEmail(email, name, appUrl);
```

### Environment Variables

Required in `.env`:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
APP_URL=https://popcornmedia.org
```

## API Endpoints

### POST /api/auth/signup
Create account and send verification email

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "message": "Verification email sent",
  "userId": "uuid",
  "email": "user@example.com"
}
```

### POST /api/auth/send-welcome
Send welcome email after email verification

**Request:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "message": "Welcome email sent successfully",
  "userId": "uuid",
  "email": "user@example.com"
}
```

### POST /api/auth/resend-verification
Resend verification email

**Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "message": "Verification email resent",
  "email": "user@example.com"
}
```

## Testing

To test emails locally:

1. Install Resend: `pnpm add resend react-email @react-email/components`
2. Set `RESEND_API_KEY` in `.env` (get from https://resend.com/api-keys)
3. Start the server: `pnpm dev`
4. Call endpoints via API client or curl

## Resend Dashboard

Monitor email delivery, bounces, and engagement at https://resend.com/emails

## Future Enhancements

- [ ] Email preferences/unsubscribe links
- [ ] Daily digest templates
- [ ] Weekly newsletter
- [ ] Password reset email
- [ ] Notification preference emails
- [ ] A/B testing variants
