import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// identity-worker is internal: api-edge reaches it over its service binding,
// and its API-key routes take the caller from the x-actor-* headers api-edge
// sets. A workers.dev URL would let anyone send those headers themselves, so
// stage and prod must have none (like every other internal worker).

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

describe("identity-worker has no public URL", () => {
  const config = parseJsonc(fs.readFileSync(templatePath, "utf-8")) as {
    env: Record<string, { workers_dev?: boolean }>;
  };

  it.each(["stage", "prod"])("%s sets workers_dev: false", (env) => {
    expect(config.env[env]?.workers_dev).toBe(false);
  });
});
