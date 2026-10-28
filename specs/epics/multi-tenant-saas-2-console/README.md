# Epic: multi-tenant-saas-2-console (LX)

**The LMS has two front doors for staff today: Lumen's console (account,
organization, billing) at the product URL, and the Payload admin at its own
URL with its own passwords, where instructors author courses. This epic brings
`sourceplane/lumen-payload`'s console epic (`lumen-payload-console`, PX0–PX5)
here: staff sign in to the Payload admin with their Lumen account, the Lumen
pages move inside the admin, and the console URL redirects into it. Learners
are untouched: they keep their own accounts and sign in to the academy, which
stays at the CMS root.**

The design is lumen-payload's, as shipped (its `design.md` and
`IMPLEMENTATION-STATUS.md`); this doc set records only where the LMS differs.

## Status

| Field | Value |
|-------|-------|
| Status | Proposed |
| Cluster | **LX** (LX0–LX4) |
| Owner(s) | `apps/cms` (staff sign-in, the account and billing pages) · `apps/web-console-next` (retired to a redirect) · `apps/api-edge` (CORS, the `account` rate family) · `apps/identity-worker` (OAuth return allowlist, the security-events fix) · `packages/db` (one migration) |
| Builds on | `multi-tenant-saas-2-lms` (LMS0–LMS5) and `lumen-payload-console` (PX0–PX5, shipped 2026-10-28) |
| Changes | Staff accounts move to Lumen sign-in; the account, organization, notifications, security-activity and billing pages move into the admin; the console URL redirects to `/admin`. The academy, its learners and their records do not change. |
| Decisions locked | (1) The **Payload admin is the staff console**; the Lumen console UI becomes a redirect. (2) **Lumen identity is the only staff sign-in**; `learners` keep their own accounts and sign-in. (3) **Roles stay Payload's**: admin, editor and instructor (with its academies); no role is *pending*; the first admin needs the owner's setup token. (4) **The CMS root stays the academy**; only the console URL and `/admin` change. (5) **Ported as shipped**: lumen-payload's code, tests and departures, with names and the LMS's differences applied. |
| Gate | LX1 is the first visible change for staff: `/admin` asks for a Lumen sign-in. LX3 retires the console URL. |
| Shipped as | — |

## Read order

1. `design.md` — what is ported unchanged, and the six places the LMS differs
2. `implementation-plan.md` — the milestones and what "done" means for each
3. `risks-and-open-questions.md` — what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md` — what actually shipped (kept distinct from intent)

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| LX0 — the spec | this doc set | merged to `main` |
| LX1 — staff sign-in | Lumen sign-in for `users`, pending accounts, the setup-token first admin, migration `320_cms_lumen_identity` | `/admin` asks for a Lumen sign-in on stage and prod, and a learner still signs in to the academy |
| LX2 — account and billing | Profile, Security activity, Organization, Notifications and Billing & plan in the admin; the identity-worker security-events fix; the `account` rate family | on stage, each page reads and writes the signed-in Lumen account |
| LX3 — the front door | the console Worker answers 308 into `/admin`; product URLs, the billing return and the parked domain point at the CMS | on stage and prod, the console URL lands on the staff sign-in and the CMS root still shows the academy |
| LX4 — the record | operations guide, AGENTS.md, docs, status | merged, describing the product as it runs |
