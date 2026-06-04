## Goal

Replace the destructive "Delete employee" flow with a soft-delete so admins can still view the deleted user's attendance (and other history). Keep the existing "Reject pending signup" path as a true hard-delete (those users haven't done anything yet).

## Why a new column

`is_active` is already overloaded — it doubles as the "pending approval" flag for new signups. We can't reuse it for deletion. Add a dedicated `deleted_at timestamptz` on `profiles` (NULL = not deleted).

## Changes

### 1. Database (migration)
- Add `profiles.deleted_at timestamptz NULL`.
- Update RLS on `profiles`:
  - Regular users (`SELECT` for authenticated): only rows where `deleted_at IS NULL`.
  - Admins: can read all rows including deleted.
- Keep existing INSERT/UPDATE rules.

### 2. `useEmployees.ts`
- `deleteEmployee(id)` for an **approved** employee (`is_active = true` or previously activated): set `deleted_at = now()` and `is_active = false`. Do NOT cascade-delete attendance / leave / OT / work_hours / user_roles.
- Add a new `rejectPendingSignup(id)` that runs the current hard-delete cascade — only used for the Pending Approvals reject button.
- Filter the default employee list to `deleted_at IS NULL`.
- Add `fetchDeletedEmployees()` (admin-only) for an "Archived employees" view.

### 3. `Employees.tsx`
- Pending Approvals → Reject button calls `rejectPendingSignup` (hard delete, as today).
- Active employees → Delete button calls the new soft-delete `deleteEmployee`. Update the confirm dialog copy to "Archive employee — their attendance and history will remain viewable to admins."
- Add an "Archived" section/tab (admin only) listing soft-deleted profiles with a "Restore" action that clears `deleted_at`.

### 4. Attendance visibility
- `useAllAttendance.ts` already joins profiles via a separate fetch. Change it to fetch profiles **without** filtering by `deleted_at` so historical rows still show the name/department. No other code change needed — attendance rows were never deleted under the new flow.
- `AttendanceReport.tsx`: include archived employees in the employee selector when admin is filtering historical months (label them "(archived)").

### 5. Login / auth
- Block sign-in for soft-deleted users: in `AuthContext` after session load, if `profile.deleted_at` is set, sign out and show "This account has been archived."

## Out of scope
- No backfill — existing already-deleted users are gone; this only protects future deletions.
- No changes to leave/OT/parcel tables; they reference `profiles(id)` and will keep working since the profile row remains.
