# multi-tenant-saas-2-console — risks and open questions

## Risks

| # | Risk | Mitigation |
|---|---|---|
| LX-A | Turning off `users`' local strategy changes how Payload authenticates every request, and the `learners` collection shares the same Payload instance and cookie machinery. | `learners` keep `auth` unchanged; LX1's done-when includes a learner registering and signing in at `/login`, and the LMS's own API and Chromium checks are re-run on stage. |
| LX-B | `access.admin` here admits instructors, so a pending account must not be mistaken for one. | Pending is *no role*; `roleOf` returns undefined and `isStaff` refuses it, exactly as an unknown role is refused today. A test pins it. |
| LX-C | The migration diff includes the LMS's own tables; a regenerated snapshot could drift from what `300`/`310` built. | Generate against a database built only from `200`, `300`, `301`, `310` and compare: the converter's idempotency check and `migration-sync.test.ts` fail on any unexpected statement. |
| LX-D | Each merge deploys several lanes and mints credentials. | The broker no longer counts connection facts (sourceplane/orun-cloud#2106/#2112); a lane that still hits `limit_reached` is re-run once later. |
| LX-E | Opening the first admin needs `CMS_SETUP_TOKEN` in this workspace, a secret-store write the owner must allow. | Until then the admin shows the Lumen sign-in and every account is pending; nothing is exposed. |

## Decided

- **Learners stay off Lumen.** The LMS's decision 3 holds: learner
  accounts belong to the academy, not to the platform's identity.
- **The product URL is the academy.** Learners are the product's public;
  staff reach `/admin` from the console URL or directly.
- **PX2 and PX3 ship together** as LX2.

## Open

- **Instructors and Lumen organizations.** An instructor's Billing & plan
  page shows *their own* Lumen organization's plan, as for every staff member
  in Solo mode. Whether academies should one day map to Lumen organizations
  is a separate question, out of scope here.
