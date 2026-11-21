# I've arrived, sir

Private QR-based car owner notification app, Unlimited slot #000001.

- Public page: `/s/1`
- API: `/api/s/1`
- Database: existing Unlimited PostgreSQL connection, isolated schema `slot_000001`.
- Arabic, English and French.
- QR and printable poster are generated locally in the browser; no image storage bucket is needed.

Owner creates a random management key locally. Only its SHA-256 hash is stored in PostgreSQL. QR codes contain unguessable public tokens, never phone numbers. Keep the management key safe: no phone or email is collected for recovery.

The API lazily creates the schema and tables on first use. Requires the existing platform `DATABASE_URL` environment variable.
