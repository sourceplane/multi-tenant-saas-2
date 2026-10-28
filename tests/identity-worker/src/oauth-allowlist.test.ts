import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isAllowedReturnTo } from "../../../apps/identity-worker/src/oauth/config";

// GitHub and Google sign-in return to the Payload CMS as well as the console
// (lumen-payload-console design §1): each environment allows its own CMS
// origin, and only its own.

const templatePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/identity-worker/wrangler.template.jsonc",
);

function parseJsonc(text: string): Record<string, unknown> {
  const withoutComments = text
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return JSON.parse(withoutComments.replace(/,(\s*[}\]])/g, "$1")) as Record<string, unknown>;
}

const config = parseJsonc(fs.readFileSync(templatePath, "utf-8")) as {
  env: Record<string, { vars: { OAUTH_ALLOWED_CONSOLE_ORIGINS: string } }>;
};
const cms = (env: string) => `https://multi-tenant-saas-2-cms-${env}.nexo-7be.workers.dev`;

describe("OAuth return allowlist", () => {
  it.each(["dev", "stage", "prod"])("%s lets sign-in return to its own CMS", (env) => {
    const vars = config.env[env]!.vars;
    const allowed = vars.OAUTH_ALLOWED_CONSOLE_ORIGINS.split(",");
    expect(allowed).toContain(cms(env));
    expect(isAllowedReturnTo(`${cms(env)}/auth/lumen/callback?redirect=%2Fadmin`, vars as never)).toBe(true);
  });

  it("does not let stage sign-in return to prod's CMS, or the reverse", () => {
    expect(config.env.stage!.vars.OAUTH_ALLOWED_CONSOLE_ORIGINS).not.toContain(cms("prod"));
    expect(config.env.prod!.vars.OAUTH_ALLOWED_CONSOLE_ORIGINS).not.toContain(cms("stage"));
  });
});
