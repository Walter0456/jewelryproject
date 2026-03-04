# Patch Notes — JewelAdmin Pro (Post‑1.0.0)
Baseline: `SETUP.md` version 1.0.0  
Reference snapshot: `reference.txt` (last backup)

**Highlights**
- JWT authentication with server‑side verification and 30‑minute session enforcement.
- Image storage moved to `/uploads` with cleanup tooling.
- Inventory snapshots with automatic catch‑up on server start.
- OR number sequence, UUID sale IDs, and void/refund flow.
- Backup UI with pg_dump + uploads ZIP and scheduled task support.
- Pagination across all major lists to prevent UI freezes.
- Revenue report now includes daily spike chart for the peak month.

**Backend Changes**
- Added JWT auth middleware and role checks on protected routes.
- Added QR login flow with server‑generated tokens and verification.
- Added image upload endpoint with file‑type/size validation.
- Added backup endpoints for run/schedule and uploads ZIP.
- Added inventory snapshot endpoints and startup catch‑up.
- Added purge‑unused‑uploads maintenance endpoint.
- Added sale void endpoint with stock rollback and audit log.
- Added price change audit logs with old→new values.
- Added rate limiting for login, QR, and PIN verification.

**Frontend Changes**
- Session stored with JWT + login time; automatic timeout handling.
- Maintenance UI for backups and “Purge Unused Images”.
- Sales Report shows status + admin‑only Void action.
- Business Revenue includes daily spikes chart for peak month.
- Daily Inventory Movement supports pagination + “Show All”.
- Pagination added to:
  - Jewelry Menu (POS)
  - Inventory Catalog
  - Employee Performance Summary
  - Employee Registry Gateway
  - Daily Inventory Movement
  - Sales Transaction History
  - Audit Trail

**Database / Schema Changes**
- Added `inventory_snapshots` table for daily stock snapshots.
- Added `or_number_seq` sequence to prevent OR collisions.
- Added `sales.status` to support voided sales.
- Added `settings.backup_settings` (JSONB) and `settings.branches`.
- `admin_pin` now stored as hashed text (PBKDF2).

**Data Behavior Changes**
- Products now store image URLs instead of Base64.
- Deleting or updating products triggers upload cleanup.
- Voided sales are excluded from revenue and inventory reports.

**New / Updated Scripts**
- `scripts/backup-db.js` (pg_dump + uploads ZIP).
- `scripts/snapshot-inventory.js` (daily snapshots).
- Updated `.bat` scripts to use relative paths.

**Dependencies Added**
- `jsonwebtoken`, `multer`, `archiver`, `dotenv`, `express-rate-limit`.

**Operational Notes**
- Required environment variables:
  - `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`
  - `JWT_SECRET`, `JWT_EXPIRES_IN`
- Ensure `/uploads` exists and is writable.
- Run `npm install` after pulling updates.
- Run `npm run db:init` or apply migrations for new columns/tables.

**Breaking / Behavior Changes**
- Admin PIN must be verified to change PIN or void sales.
- QR badges are now generated server‑side.
- Old Base64 images are not auto‑migrated; use new upload flow.

**Bug Fixes**
- Printing now uses a dedicated report generator to bypass pagination and render full datasets (Daily Inventory Movement and Sales Transaction History).
