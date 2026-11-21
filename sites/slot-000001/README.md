# I've arrived, sir

Private QR-based car owner notification app in Unlimited slot #000001.

- Public page: `/s/1`
- API: `/api/s/1`
- Storage: existing Vercel Blob store already connected to the Unlimited project.
- No additional database, storage bucket, paid plan, or manual setup is required.
- Arabic, English and French.
- QR and printable poster are generated locally in the browser.

## Privacy model
- Owner creates a random management key in their browser. Keep it safe; it is not recoverable because the app does not collect phone numbers or email addresses.
- Only a SHA-256 hash of the owner key is stored in car records.
- QR codes contain unguessable random tokens, never phone numbers or owner identities.
- Car and alert records are encrypted with AES-256-GCM before being written to Blob. Blob URLs do not expose readable personal content.
- Visitors send alerts without signing up or sharing their phone number.
- Owner quick replies are restricted to the matching owner key.

## Storage
The API uses the existing `BLOB_READ_WRITE_TOKEN` environment variable. No database connection or additional storage setup is needed. Records are stored separately to avoid concurrent updates overwriting unrelated alerts.
