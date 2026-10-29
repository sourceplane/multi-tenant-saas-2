# multi-tenant-saas-2-console — design

The design is `lumen-payload-console`'s, as it shipped in
`sourceplane/lumen-payload` (PRs #21–#26): read its `design.md` and
`IMPLEMENTATION-STATUS.md` there. Everything below is either ported unchanged
(§1) or one of the places this LMS differs (§2–§7).

## 1. Ported unchanged

- **Sign-in** (its §1): the admin's login view becomes *Sign in with your
  Lumen account* (emailed code, GitHub, Google), called from the browser
  against `api-edge`; the token is handed once to `POST /auth/lumen/session`
  and lives only in the `lumen_session` cookie (`HttpOnly; Secure;
  SameSite=Lax`, host-only). Sign-out revokes the Lumen session.
- **The strategy** (its §2): `users.auth.strategies = [lumen]`, resolving the
  cookie with `GET /v1/auth/session` over the `LUMEN_API` service binding
  (`multi-tenant-saas-2-api-edge-<env>`), cached 30 seconds per token, one
  lookup shared by concurrent requests, and a session confirmed in the last
  5 minutes kept while api-edge cannot answer. A request whose `Origin` names
  another host gets no user (`isForeignOrigin`).
- **The pages** (its §4) and their same-origin `/lumen/…` form handlers:
  Profile, Security activity, Organization, Notifications, Billing & plan,
  under an *Account* nav group.
- **Security** (its §6), including `frame-ancestors 'self'`.
- **The two platform fixes found there**, which this repository's
  identity-worker and api-edge share: security events are queried by the
  user's UUID (the endpoint answers 503 for everyone today), and a bearer's
  own session, profile and security-events reads get an `account` rate family
  (60 a minute) instead of sign-in's 10.

## 2. Staff and learners

Two Payload auth collections live here. Only **`users`** (staff) changes:
its local strategy goes off and the `lumen` strategy comes on.
**`learners`** keep Payload's local strategy, their own email and password,
the academy's `/login` and `/register`, and every `/api/lms/*` endpoint
(`roleOf` already ignores a non-`users` user). A learner is never a Lumen
account, and a Lumen account never becomes a learner.

## 3. Roles

`role` keeps its three values, becomes optional with no default, and *no
role* is **pending**, as there:

| Role | Admin access | Scope |
|---|---|---|
| `admin` | yes | everything, including accounts and academies |
| `editor` | yes | the site's pages, posts and categories |
| `instructor` | yes | the courses of the academies in `tenants` |
| *(none)* | no: the pending page | — |

`access.admin` stays `isStaff` (any of the three roles), not lumen-payload's
admin-or-editor. `tenants` stays an admin-only field shown for instructors.
The first admin is created by the setup-token rule of its §3, and the
`firstUserGate` and `firstUserIsAdmin` hooks go with `first-register`.

Stage and prod have **no staff accounts yet**: the admin still shows
create-first-user on both. No account is linked by email at migration time.

## 4. Routes

The academy (`app/(learn)`) owns `/` and `/login`. The Lumen routes are
added without touching it:

- `app/(site)/auth/lumen/{session,logout,callback}` and
  `app/(site)/lumen/{profile,notifications,billing}`, in a `(site)` group with
  its own minimal layout and **no `page.tsx`** (lumen-payload's root redirect
  to `/admin` is not ported);
- `app/setup/route.ts`, which already exists, now opens the Lumen sign-in;
- Payload's admin keeps `/admin`.

## 5. The front door

- **The console Worker** (`web-console-next`) answers every old path with a
  `308` into the same environment's CMS, as there: `/` and unknown paths go to
  `/admin`, `/login` to `/admin/login`, `/auth/callback` to
  `/auth/lumen/callback`.
- **The CMS root stays the academy.** It is the public product, so the
  product URLs in `intent.yaml` become the CMS root, not `/admin`.
- **The billing provider's fallback return** becomes the CMS billing page.
- **The parked `cloudflare-domain` component** targets the CMS Worker.
- **Branding:** the admin's title suffix becomes *Multi Tenant Saas 2* and
  its logo and icon the product's mark (from `.rebrand/values.json`, read,
  not edited); the academy keeps its own header.

## 6. Migration

`320_cms_lumen_identity`, generated from Payload's schema diff against this
repository's snapshot (which includes the LMS collections) and converted like
every CMS migration: `users.lumen_user_id` (unique) and `users.role` without
`NOT NULL` or default. The enum keeps `instructor`. lumen-payload's converter
change (accepting default and nullability changes as idempotent) is ported
with it.

## 7. Verifying it

On stage, through a browser and the API (stage returns sign-in codes):

1. `/admin` shows the Lumen sign-in, and no password form.
2. A newcomer lands on the pending page; with setup open, the owner's
   sign-in becomes the first admin, who makes another account an
   `instructor` of the sample academy; that instructor sees only its courses.
3. A learner still registers, signs in at `/login`, enrols and completes the
   sample course (the LMS's own checks).
4. The account and billing pages read and write the Lumen account.
5. The console URL lands on the staff sign-in; the CMS root shows the
   catalogue.

Prod is verified read-only: the sign-in renders, `/health` is ok, the
catalogue renders, and the console URL redirects.

## 8. Out of scope

What lumen-payload's §8 keeps out (what Solo mode hides, Config pages,
content per Lumen organization, a custom domain) stays out here. Also out:
learners signing in with Lumen, and staff seeing learner records beyond what
the LMS's access rules already give them.
