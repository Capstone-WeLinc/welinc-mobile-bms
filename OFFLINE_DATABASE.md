# BMS mobile offline database

The app creates `bms_mobile.db` automatically on first launch using Expo SQLite
(same setup as the VRMS/VMMS mobile app). SQLite is the source of truth on the
phone; the zustand stores in `stores/` are in-memory copies the screens render.

| Table                  | Holds                                         | Written by                    |
| ---------------------- | --------------------------------------------- | ----------------------------- |
| `job_orders`           | Assigned job orders (server snapshot)         | `jobOrdersStore.refresh`      |
| `post_service_records` | Post-service completion forms                 | `savePostServiceRecord`       |
| `weekly_availability`  | Each user's weekly availability               | `availabilityStore.saveWeekly`|
| `leave_requests`       | Submitted leave requests                      | `availabilityStore.submitLeave`|
| `notifications`        | Each user's notifications and read state      | `notificationsStore`          |
| `sync_metadata`        | Last sync time, owner of the local data       | `SyncService`                 |

Layout:

- `database/tables.ts` – database name, schema version, row types, `CREATE TABLE` SQL
- `database/database.ts` – opens the database, runs migrations, `clearDatabase()`
- `repositories/` – one class per table group; all values use bound parameters

## Sign-in and backend sync

The app talks to the suite gateway from `welinc-workspace` (port 3000): `/auth/*`
goes to shared auth (`welinc-auth`) and `/bms/*` to the BMS backend.

**Sign-in** uses shared auth's phone app login with the `bms-mobile` client, which
only admits `DRIVER` and `HELPER` accounts (`services/AuthService.ts`,
`services/mobileAuthRefresh.ts`):

- `POST /auth/mobile/login`; an unverified email first gets a 6 digit code
  (`/auth/mobile/login/verify-email`, `.../resend`).
- Tokens are kept in SecureStore. A `401` refreshes them once through `POST /auth/token`
  (refresh token, client `bms-mobile`, audience `BMS`) and retries the request.
- Sign-out ends the session on the server (`POST /auth/logout`).
- Forgot password: `POST /auth/forgot-password` → `/auth/verify-otp` → `/auth/reset-password`.

**Sync** (`services/SyncService.ts`) runs on sign-in, on pull-to-refresh, when the
app returns to the foreground and right after a post-service form is saved:

1. **Upload**: every `post_service_records` row with `syncPending = 1` is sent; on
   success the flag is cleared. Records the server refuses stay queued for the next sync.
2. **Download**: the team member's distributed job orders replace the `job_orders`
   snapshot in one transaction.

> The BMS backend has **no driver/helper routes for job orders and post-service yet**.
> Until it does, `TEAM_JOB_ORDER_ROUTES_READY` in `SyncService.ts` is `false`: the
> sync sends and downloads nothing, saved forms stay queued on the phone, and a
> real account sees no job orders. Turn it on when those routes are merged.

Offline, both steps are skipped and the screens show the SQLite cache. A refused
session returns the app to sign-in but keeps the local data.

| Connected to the server | Still on the phone only |
| --- | --- |
| Sign-in, email code, forgot password, sign-out | Job orders and post-service (waiting for BMS routes) |
| Profile name and mobile number, change password | Weekly availability, leave requests (Dispatch has `/bms/crew-leave/self`; app screen not connected yet) |
| | Notifications (built on the phone from job orders) |

Local data is kept on sign-out, so unsent records survive until the same user
signs in again. When a **different** user signs in, `SyncService.prepareFor`
clears the previous user's data (`sync_metadata.ownerUserId`).

With `EXPO_PUBLIC_USE_SEEDER_AUTH="true"`, nothing is synced: the seeder job orders
from `seeders/` are loaded instead.

## Inspecting the database

`expo-sqlite` includes a SQLite inspector that registers every database the app
opens in development builds; no extra package or code is needed.

1. `npx expo start` and open the app on a device/emulator (Expo Go or a dev build).
2. Sign in so the tables are populated.
3. In the Expo CLI terminal press `Shift+M` and choose **expo-sqlite**.
4. In the browser page that opens, select `bms_mobile.db` to browse tables or run queries.

Keep the app open on the device while using the inspector. It is not available
in release builds.

## Changing the schema

1. Bump `DATABASE_VERSION` in `database/tables.ts`.
2. Update `CREATE_TABLES_SQL` for new installs.
3. Add a migration for that version to `MIGRATIONS` in `database/database.ts`.
