# Security Audit — Pendiente (Bajo Riesgo)

Completado: Jun 9, 2026 4:25pm

---

## ✅ Arreglado (Crítico + Alto + Medio)

- [x] Webhook HMAC verification
- [x] Email CRLF injection sanitization  
- [x] Test endpoints deletion
- [x] Admin page server-side auth
- [x] Rate limiter validation
- [x] CSP hardening (unsafe-inline removal)
- [x] Clickjacking protection (frame-ancestors)
- [x] Donor portal token entropy (cryptographic nonce)

---

## 🔜 Pendiente — Bajo Riesgo (Siguiente PR)

### 1. CSRF Tokens en Admin Forms
**Severidad**: LOW  
**Razón de bajo riesgo**: SameSite=Strict en cookie admin_session ya proporciona protección

**Implementación (cuando sea necesario)**:
```typescript
// src/lib/csrf.ts
import { randomBytes, createHmac } from 'crypto';

export function generateCSRFToken(sessionId: string, secret: string): string {
  const nonce = randomBytes(16).toString('hex');
  const token = createHmac('sha256', secret)
    .update(`${sessionId}:${nonce}`)
    .digest('hex');
  return `${nonce}.${token}`;
}

export function verifyCSRFToken(token: string, sessionId: string, secret: string): boolean {
  const [nonce, sig] = token.split('.');
  const expected = createHmac('sha256', secret)
    .update(`${sessionId}:${nonce}`)
    .digest('hex');
  return sig === expected;
}
```

**Dónde usar**:
- `/api/admin-sync` — POST endpoint
- Admin dashboard form submissions

---

### 2. Contact Form Rate Limiting
**Severidad**: MEDIUM  
**Archivo**: `api/contact.ts`

**Implementación**:
```typescript
import { isRateLimited } from '../src/lib/ratelimit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Rate limit by IP + email combo
  const ip = req.headers['x-forwarded-for'] || 'unknown';
  const email = req.body?.email || '';
  const identifier = `contact:${ip}:${email}`.replace(/\s/g, '');
  
  if (await isRateLimited(identifier)) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  // ... rest of handler
}
```

**Limits**: 5 submissions per email per 15 minutes

---

## 🔍 Mollie Redirect Issue — Debugging Plan

### Status
- ✅ Code is correct (create-donation.ts, thank-you.astro, webhook validation all verified)
- ❌ Redirect to thank-you page not working after Mollie payment
- 🤔 Root cause: Mollie configuration OR environment variable issue

### Diagnostic Steps

**1. Check Vercel Environment Variable**
```bash
# In Vercel Dashboard → Settings → Environment Variables
# Find: PUBLIC_SITE_URL

# Must be:
✅ https://welevelup.org
❌ https://staging.welevelup.org (if in production)
❌ https://welevelup.org/ (trailing slash breaks Mollie)
❌ http://welevelup.org (insecure)
```

**2. Check Mollie Dashboard Profile**
```
Settings → Profiles
↓
Select profile for your Standard API key
↓
Website URLs section
↓
Verify https://welevelup.org is in the list
↓
If missing: Add it and save
```

**3. Review Vercel Logs**
```
1. Make test donation on production
2. Go to Vercel → Project → Functions → create-donation
3. Find log with:
   siteUrl: "https://welevelup.org"
   baseUrl: "https://welevelup.org"
   redirectUrl: "https://welevelup.org/donate/thank-you?amount=1.00&type=one-time"

4. Copy the exact redirectUrl
5. Paste in browser → does it load thank-you page or redirect to /donate?
```

**4. Test with Hardcoded URL**
```typescript
// In api/create-donation.ts (temporary)
const redirectUrl = 'https://welevelup.org/donate/thank-you?amount=1.00&type=one-time';
```
Deploy and test. If this works, the issue is variable or domain config.

---

## Notes

- All auth checks use `verifyAdminSession` helper for consistency
- Rate limiter validates all identifiers (prevents Redis key injection)
- Webhook now requires valid Mollie signature (prevents spoofing)
- CSP headers enforced via vercel.json
- Token entropy improved across donation and donor portal flows

---

**Next Steps**: 
1. Debug Mollie redirect with steps above
2. Create PR for CSRF + contact form rate limit (once redirect is working)
