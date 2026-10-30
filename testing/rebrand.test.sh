#!/usr/bin/env bash
# THE REBRAND WRITES EACH VALUE ONCE, WHAT IT WROTE STAYS WRITTEN, AND THE
# PIECES THAT MUST AGREE STILL AGREE.
#
# This drives the real rebrand.mjs over tiny trees and compares the files. Its
# left-hand side is this repository's own identity — `.rebrand/values.json`,
# which the script reads from next to itself — so every fixture below is
# written in THIS baseline's names, read from that file, and the same test
# holds in every baseline the engine serves.
#
# What it holds, from the cirrus and Lumen engines this one descends from:
#
# 1. A `secret://<workspace>/<project>/<env>/<KEY>` ref is verified by the
#    platform against the run's own workspace, so both segments are renamed,
#    each to its own value.
# 2. The rules run in sequence over one buffer, and a value containing a
#    baseline word must not be rewritten by a later rule — nor by the next
#    phase's pass, since a bootstrap re-runs the rebrand in every phase.
#
# And what this engine adds:
#
# 3. THE PLATFORM WORD. The CMS names the platform `lumen` in every case-form
#    — a route directory, a module path, a Payload field and the column Payload
#    derives from it, a binding, a cookie, a migration. Each must come out
#    renamed AND still agree with the others, and the paths that carry the
#    word must be renamed with it.
#
# Needs: node, git, python3. No network.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
rebrand="$root/tooling/rebrand/rebrand.mjs"

# ── this baseline's own names ──────────────────────────────────────────────
eval "$(python3 - "$root/.rebrand/values.json" <<'PY'
import json, re, shlex, sys
v = json.load(open(sys.argv[1]))
repo, name = v["reponame"], v["productname"]
pascal = re.sub(r"[^A-Za-z0-9]", "", name)
out = {
    "REPO": repo, "NAME": name, "PASCAL": pascal,
    "CAMEL": pascal[:1].lower() + pascal[1:],
    "ENV": repo.upper().replace("-", "_"),
    "SUB": v.get("subdomain") or "your-workers-subdomain",
    "WS": v.get("orunWorkspace") or repo,
}
for k, val in out.items():
    print(f"{k}={shlex.quote(val)}")
PY
)"
[ -n "$REPO" ] && [ -n "$SUB" ] && [ -n "$WS" ] || { echo "rebrand.test.sh: .rebrand/values.json is incomplete" >&2; exit 1; }
echo "   the baseline is $REPO (\"$NAME\"), subdomain $SUB, workspace $WS"

fail=0
# brand VALUES PASSES FILE=CONTENT... — a tree of the given files, branded
# PASSES times (a bootstrap runs it once per phase, over everything placed).
# Leaves the tree in $tree; returns non-zero if a pass failed.
brand() {
  local values="$1" passes="$2" i spec
  shift 2
  tree="$(mktemp -d)"
  git -C "$tree" init -q
  mkdir -p "$tree/.rebrand"
  printf '%s\n' "$values" > "$tree/.rebrand/values.json"
  for spec in "$@"; do
    mkdir -p "$tree/$(dirname "${spec%%=*}")"
    printf '%s\n' "${spec#*=}" > "$tree/${spec%%=*}"
  done
  for ((i = 1; i <= passes; i++)); do
    git -C "$tree" add -A
    if ! out="$(cd "$tree" && node "$rebrand" --values .rebrand/values.json --allow-dirty 2>&1)"; then
      printf '%s\n' "$out" | sed 's/^/        /' >&2
      return 1
    fi
  done
}
# check NAME VALUES FILE CONTENT WANT [PASSES]
check() {
  local name="$1" values="$2" file="$3" content="$4" want="$5" passes="${6:-1}" got
  if ! brand "$values" "$passes" "$file=$content"; then
    echo "   ✕  $name: the rebrand failed" >&2; fail=1; rm -rf "$tree"; return
  fi
  got="$(cat "$tree/$file" 2>/dev/null || echo "<$file is gone>")"
  rm -rf "$tree"
  if [ "$got" = "$want" ]; then echo "   ok  $name"; else
    echo "   ✕  $name:" >&2; echo "        got:  $got" >&2; echo "        want: $want" >&2; fail=1
  fi
}
# moved NAME VALUES FROM TO [PASSES] — FROM is renamed to TO, nothing left behind
moved() {
  local name="$1" values="$2" from="$3" to="$4" passes="${5:-1}"
  if ! brand "$values" "$passes" "$from=export const x = 1"; then
    echo "   ✕  $name: the rebrand failed" >&2; fail=1; rm -rf "$tree"; return
  fi
  if [ -f "$tree/$to" ] && [ ! -e "$tree/$from" ] && git -C "$tree" ls-files --error-unmatch "$to" >/dev/null 2>&1 \
     && [ -z "$(find "$tree" -path "$tree/.git" -prune -o -type d -empty -print)" ]; then
    echo "   ok  $name"
  else
    echo "   ✕  $name: want $to (indexed, nothing empty left), have:" >&2
    (cd "$tree" && git ls-files | sed 's/^/        /') >&2
    fail=1
  fi
  rm -rf "$tree"
}

acme='{"reponame":"acme-cloud","productname":"Acme Cloud","subdomain":"acme","orunWorkspace":"ws_0000000000000000000000000000000f"}'
nodomain='{"reponame":"acme-cloud","productname":"Acme Cloud","githuborg":"acme-inc","subdomain":"acme"}'
ref="TOKEN: secret://$WS/$REPO/stage/CLOUDFLARE_API_TOKEN"

echo "── rebrand: the secret ref's two segments"
check "a workspace id is the workspace segment" \
  '{"reponame":"altocumulus","productname":"Altocumulus","orunWorkspace":"ws_79BDXAZQ"}' apps/w/component.yaml "$ref" \
  "TOKEN: secret://ws_79BDXAZQ/altocumulus/stage/CLOUDFLARE_API_TOKEN"
check "an explicit workspace slug wins over the id" \
  '{"reponame":"altocumulus","productname":"Altocumulus","orunWorkspace":"ws_79BDXAZQ","orunWorkspaceSlug":"acme-space"}' apps/w/component.yaml "$ref" \
  "TOKEN: secret://acme-space/altocumulus/stage/CLOUDFLARE_API_TOKEN"
check "a workspace named with the platform word is written once…" \
  '{"reponame":"altocumulus","productname":"Altocumulus","orunWorkspaceSlug":"lumen-test"}' apps/w/component.yaml "$ref" \
  "TOKEN: secret://lumen-test/altocumulus/stage/CLOUDFLARE_API_TOKEN"
check "…and survives every later phase's pass" \
  '{"reponame":"altocumulus","productname":"Altocumulus","orunWorkspaceSlug":"lumen-test"}' apps/w/component.yaml "$ref" \
  "TOKEN: secret://lumen-test/altocumulus/stage/CLOUDFLARE_API_TOKEN" 3

echo "── rebrand: workers, subdomain, domain and the CLI's default"
check "a worker and its workers.dev host" \
  "$acme" apps/w/wrangler.template.jsonc "\"LUMEN_API_PUBLIC_URL\": \"https://$REPO-api-edge-prod.$SUB.workers.dev\"" \
  '"ACME_CLOUD_API_PUBLIC_URL": "https://acme-cloud-api-edge-prod.acme.workers.dev"'
# The worker rule's bases are this tree's own apps/<base>/ directories, so the
# fixture lives in the one it names.
check "a worker prefix of its own" \
  '{"reponame":"acme-cloud","productname":"Acme Cloud","brandSlug":"acme","subdomain":"acme"}' apps/api-edge/wrangler.template.jsonc \
  "\"services\": [{ \"binding\": \"LUMEN_API\", \"service\": \"$REPO-api-edge-stage\" }]" \
  '"services": [{ "binding": "ACME_CLOUD_API", "service": "acme-api-edge-stage" }]'
check "no domain: the domain's places get the placeholder" \
  "$nodomain" intent.yaml "      BASE_DOMAIN: $REPO.example.com" \
  '      BASE_DOMAIN: acme-cloud.example.com'
check "a domain given: the domain where the domain goes" \
  '{"reponame":"acme-cloud","productname":"Acme Cloud","productdomain":"acme.dev","subdomain":"acme"}' \
  intent.yaml "      BASE_DOMAIN: $REPO.example.com" '      BASE_DOMAIN: acme.dev'
check "no domain: the CLI defaults to the product's own prod edge" \
  "$nodomain" packages/cli/src/brand.ts "export const DEFAULT_API_URL = \"https://$REPO-api-edge-prod.$SUB.workers.dev\";" \
  'export const DEFAULT_API_URL = "https://acme-cloud-api-edge-prod.acme.workers.dev";'
check "…and survives every later phase's pass" \
  "$nodomain" packages/cli/src/brand.ts "export const DEFAULT_API_URL = \"https://$REPO-api-edge-prod.$SUB.workers.dev\";" \
  'export const DEFAULT_API_URL = "https://acme-cloud-api-edge-prod.acme.workers.dev";' 3
check "a domain given: the CLI defaults to api.<domain>" \
  '{"reponame":"acme-cloud","productname":"Acme Cloud","productdomain":"acme.dev","subdomain":"acme"}' \
  packages/cli/src/brand.ts "export const DEFAULT_API_URL = \"https://$REPO-api-edge-prod.$SUB.workers.dev\";" \
  'export const DEFAULT_API_URL = "https://api.acme.dev";'
check "an explicit apibaseurl wins either way" \
  '{"reponame":"acme-cloud","productname":"Acme Cloud","apibaseurl":"https://edge.acme.dev"}' \
  packages/cli/src/brand.ts "export const DEFAULT_API_URL = \"https://$REPO-api-edge-prod.$SUB.workers.dev\";" \
  'export const DEFAULT_API_URL = "https://edge.acme.dev";'
check "the CLI's bin and env prefix" \
  '{"reponame":"acme-cloud","productname":"Acme Cloud","cliBin":"acme"}' packages/cli/src/config-paths.ts \
  "const dir = process.env.${ENV}_CONFIG_DIR ?? join(home, '.config', '$REPO')" \
  "const dir = process.env.ACME_CONFIG_DIR ?? join(home, '.config', 'acme')"
check "the user agent, written once though its value holds the platform word" \
  '{"reponame":"lumen-next","productname":"Lumen Next"}' apps/w/src/ua.ts "const UA = \"$PASCAL-Webhooks/1.0\";" \
  'const UA = "LumenNext-Webhooks/1.0";' 3

echo "── rebrand: the platform word, every form, still agreeing"
check "a Payload field (camelCase)" \
  "$acme" apps/cms/src/collections/Users.ts "      name: 'lumenUserId'," "      name: 'acmeCloudUserId',"
check "…and the column Payload derives from it (snake_case)" \
  "$acme" packages/db/src/migrations/206/up.sql \
  'ALTER TABLE "cms"."users" ADD COLUMN IF NOT EXISTS "lumen_user_id" varchar;' \
  'ALTER TABLE "cms"."users" ADD COLUMN IF NOT EXISTS "acme_cloud_user_id" varchar;'
# to-snake-case, which Payload's adapter uses, starts a word at EVERY capital:
# `aCMECloudUserId` is a_c_m_e_cloud_user_id. A slug-derived snake name
# (acme_cloud) would leave the CMS querying a column its migration never made.
check "a name with a run of capitals: the field…" \
  '{"reponame":"acme-cloud","productname":"ACME Cloud"}' apps/cms/src/collections/Users.ts \
  "      name: 'lumenUserId'," "      name: 'aCMECloudUserId',"
check "…and the column, as Payload derives it from that field" \
  '{"reponame":"acme-cloud","productname":"ACME Cloud"}' packages/db/src/migrations/206/up.sql \
  'CREATE UNIQUE INDEX "users_lumen_user_id_idx" ON "cms"."users" ("lumen_user_id");' \
  'CREATE UNIQUE INDEX "users_a_c_m_e_cloud_user_id_idx" ON "cms"."users" ("a_c_m_e_cloud_user_id");'
check "a module path and a component, in an import" \
  "$acme" apps/cms/src/app/page.tsx "import { LumenLogin } from '@/components/admin/LumenLogin'; import { read } from '@cms/lib/lumen/cookies'" \
  "import { AcmeCloudLogin } from '@/components/admin/AcmeCloudLogin'; import { read } from '@cms/lib/acme-cloud/cookies'"
check "a route, a cookie and a binding" \
  "$acme" apps/cms/src/lib/x.ts "fetch('/auth/lumen/session', { headers: { cookie: 'lumen_session=' + env.LUMEN_API_URL } })" \
  "fetch('/auth/acme-cloud/session', { headers: { cookie: 'acme_cloud_session=' + env.ACME_CLOUD_API_URL } })"
check "the slug follows brandSlug" \
  '{"reponame":"acme-cloud","productname":"Acme Cloud","brandSlug":"acme"}' apps/cms/src/lib/strategy.ts \
  "export const strategy = { name: 'lumen' }" "export const strategy = { name: 'acme' }"
check "prose in code is the display name" \
  "$acme" apps/cms/src/components/SignIn.tsx "<p>Use your Lumen account. Lumen could not be reached.</p>" \
  "<p>Use your Acme Cloud account. Acme Cloud could not be reached.</p>"
check "markdown: prose the display name, code the identifier" \
  "$acme" apps/cms/docs/overview.md 'Sign in with Lumen through `LumenLogin`, the `Lumen` strategy.' \
  'Sign in with Acme Cloud through `AcmeCloudLogin`, the `AcmeCloud` strategy.'
check "the baseline's own name, every form" \
  "$acme" apps/w/README.md "$NAME is $PASCAL; const $CAMEL = new $PASCAL(); $REPO; ${ENV}_TOKEN" \
  'Acme Cloud is AcmeCloud; const acmeCloud = new AcmeCloud(); acme-cloud; ACME_CLOUD_TOKEN'
check "a product named with the platform word, three passes" \
  '{"reponame":"lumen-e2e","productname":"Lumen E2E"}' apps/cms/src/lib/x.ts \
  "fetch('/auth/lumen/session'); const id = user.lumenUserId; // Lumen" \
  "fetch('/auth/lumen-e2e/session'); const id = user.lumenE2EUserId; // Lumen E2E" 3

echo "── rebrand: the paths that carry the word are renamed with it"
moved "a module directory" "$acme" apps/cms/src/lib/lumen/client.ts apps/cms/src/lib/acme-cloud/client.ts
moved "a route directory" "$acme" "apps/cms/src/app/(site)/auth/lumen/callback/page.tsx" "apps/cms/src/app/(site)/auth/acme-cloud/callback/page.tsx"
moved "a component file" "$acme" apps/cms/src/components/admin/LumenLogin.tsx apps/cms/src/components/admin/AcmeCloudLogin.tsx
moved "a migration directory" "$acme" packages/db/src/migrations/206_cms_lumen_identity/up.sql packages/db/src/migrations/206_cms_acme_cloud_identity/up.sql
moved "a test file" "$acme" tests/cms/src/lumen-session.test.ts tests/cms/src/acme-cloud-session.test.ts
moved "a product named with the word, three passes" '{"reponame":"lumen-e2e","productname":"Lumen E2E"}' \
  apps/cms/src/lib/lumen/client.ts apps/cms/src/lib/lumen-e2e/client.ts 3

echo "── rebrand: a rewritten migration is re-sealed, an untouched one is not"
# The runner refuses a migration whose file does not hash to its manifest's
# checksum. The rebrand rewrites 206 (the column it adds), so it must re-seal
# that one — and only what it rewrote: a stale checksum on a file it did not
# touch is somebody's hand edit, which the runner should go on refusing.
sum() { python3 -c "import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "$1"; }
mig206='ALTER TABLE "cms"."users" ADD COLUMN "lumen_user_id" varchar;'
stale="$(printf '%064d' 0)"
manifest="export const manifest = { migrations: [
    { id: \"100_x\", path: \"100_x/up.sql\", checksum:
        \"$stale\" },
    { id: \"206_cms_lumen_identity\", path: \"206_cms_lumen_identity/up.sql\", checksum:
        \"$(printf '%s\n' "$mig206" | python3 -c "import hashlib,sys;print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())")\" },
] }"
if brand "$acme" 2 "packages/db/src/manifest.ts=$manifest" \
     "packages/db/src/migrations/100_x/up.sql=CREATE TABLE x (id int);" \
     "packages/db/src/migrations/206_cms_lumen_identity/up.sql=$mig206"; then
  m="$tree/packages/db/src/manifest.ts"
  new="$(sum "$tree/packages/db/src/migrations/206_cms_acme_cloud_identity/up.sql")"
  grep -q "206_cms_acme_cloud_identity/up.sql\", checksum:" "$m" && grep -q "\"$new\"" "$m" \
    && echo "   ok  the rewritten migration's checksum is its new file's" \
    || { echo "   ✕  206 was not re-sealed:" >&2; sed 's/^/        /' "$m" >&2; fail=1; }
  grep -q "\"$stale\"" "$m" \
    && echo "   ok  an untouched migration's stale checksum is left for the runner to refuse" \
    || { echo "   ✕  the untouched migration was re-sealed" >&2; fail=1; }
else
  echo "   ✕  the rebrand failed" >&2; fail=1
fi
rm -rf "$tree"

echo "── rebrand: refusals"
refuse() { # NAME VALUES
  local name="$1" values="$2"
  if brand "$values" 1 "apps/w/a.ts=x" 2>/dev/null; then
    echo "   ✕  $name: it branded" >&2; fail=1
  else echo "   ok  $name"; fi
  rm -rf "$tree"
}
refuse "a name that cannot be an identifier" '{"reponame":"acme","productname":"2 Acme"}'
refuse "a repo slug that is not a slug" '{"reponame":"Acme_Cloud","productname":"Acme Cloud"}'

# --verify runs in every phase of a bootstrap. Without the product's values it
# cannot tell the product's own identity from a baseline leftover; with them it
# passes what the rebrand would write. A real leftover fails either way, and
# so does a path still named after the baseline.
verify() { # NAME VALUES FILE CONTENT WANT(pass|fail) [--values]
  local name="$1" values="$2" file="$3" content="$4" want="$5" withvalues="${6:-}" got
  tree="$(mktemp -d)"
  git -C "$tree" init -q
  mkdir -p "$tree/$(dirname "$file")" "$tree/.rebrand"
  printf '%s\n' "$content" > "$tree/$file"
  printf '%s\n' "$values" > "$tree/.rebrand/values.json"
  git -C "$tree" add -A
  if (cd "$tree" && node "$rebrand" --verify ${withvalues:+--values .rebrand/values.json} >/dev/null 2>&1); then got=pass; else got=fail; fi
  rm -rf "$tree"
  if [ "$got" = "$want" ]; then echo "   ok  $name"; else echo "   ✕  $name: --verify ${got}ed, want $want" >&2; fail=1; fi
}
echo "── rebrand --verify: the product's own identity is not residue"
e2e='{"reponame":"lumen-e2e","productname":"Lumen E2E","subdomain":"acme"}'
verify "given the values, a name holding the platform word passes" \
  "$e2e" apps/w/wrangler.template.jsonc '"name": "lumen-e2e-api-edge"' pass --values
verify "without them it cannot know, and fails" \
  "$e2e" apps/w/wrangler.template.jsonc '"name": "lumen-e2e-api-edge"' fail
verify "given the values, a real leftover still fails" \
  "$e2e" apps/w/src/a.ts 'const x = user.lumenUserId' fail --values
verify "the baseline's own name is a leftover" \
  "$acme" apps/w/README.md "Welcome to $NAME." fail --values
verify "the baseline's subdomain is a leftover once the product's differs" \
  "$acme" apps/w/README.md "https://x.$SUB.workers.dev" fail --values
verify "…and the baseline's workspace" \
  "$acme" apps/w/component.yaml "K: secret://$WS/acme-cloud/stage/K" fail --values
verify "a path named after the baseline is a leftover" \
  "$acme" apps/cms/src/lib/lumen/client.ts 'export const x = 1' fail --values
verify "a clean product passes" \
  "$acme" apps/w/README.md "Welcome to Acme Cloud, at https://acme-cloud-cms-prod.acme.workers.dev." pass --values

# THE OLD KEYS STILL WORK. Products born from the flows' phase slices committed
# values.json with `repoName`, `productName`, …; a later phase run against one
# brands with that file, so rebrand reads both, the manifest's key winning.
echo "── rebrand: the pre-blueprint camelCase keys"
check "the old keys brand like the new ones" \
  '{"repoName":"altocumulus","productName":"Altocumulus","productDomain":"altocumulus.dev","orunWorkspace":"ws_79BDXAZQ"}' \
  apps/w/component.yaml "$ref" "TOKEN: secret://ws_79BDXAZQ/altocumulus/stage/CLOUDFLARE_API_TOKEN"
check "the manifest's key wins over the old one" \
  '{"reponame":"altocumulus","repoName":"stale","productname":"Altocumulus","productdomain":"altocumulus.dev","orunWorkspace":"ws_79BDXAZQ"}' \
  apps/w/component.yaml "$ref" "TOKEN: secret://ws_79BDXAZQ/altocumulus/stage/CLOUDFLARE_API_TOKEN"

[ "$fail" -eq 0 ] || exit 1
echo "rebrand.test.sh: ok"
