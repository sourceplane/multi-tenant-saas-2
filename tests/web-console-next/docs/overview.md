# web-console-next-tests

Verification suite for `web-console-next`, which is now only the old console
URL redirecting to the Payload admin (multi-tenant-saas-2-console LX3, after lumen-payload-console PX4).

| Suite | The promise |
|---|---|
| `redirect` | Every old console page lands on its place in the same environment's CMS, query kept; the OAuth return goes to the CMS callback; only the console's own hosts are served (404 otherwise), so it cannot redirect anywhere else; answers are 308. |

The suite runs in `web-console-next`'s own build (its `buildCommand`), because
this component's lane (`quick-check`) runs no tests.
