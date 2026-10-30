#!/usr/bin/env bash
# TIER 2 — THE PLACED, BRANDED PRODUCT COMPILES AND PASSES ITS OWN TESTS.
#
# placement.test.sh proves a product comes out of the blueprint branded, with
# nothing of the factory in it, and that `orun validate` and `orun plan` accept
# it. It does not prove the product's CODE survived the rebrand — and here the
# rebrand does more than rename words: the CMS names the platform `lumen` in
# every case-form, so the rebrand renames a Payload field and the column
# derived from it, the route and module directories and every import into
# them, a service binding, a cookie and a migration. A rename that leaves any
# two of those disagreeing is a product that is branded, clean by every other
# check here, and broken.
#
# So this places the whole blueprint from tests/fixtures/acme.json, brands it
# exactly as the phases do, refreshes the lockfile exactly as they do, and then
# asks the product itself: install, typecheck every package, run every suite.
# That is what the product's own CI runs on its first pull request, minus the
# deploys.
#
# It found the one place a slug was not a slug (a test's `const lumen = …`,
# which became `const acme-cloud = …`) before any product did.
#
# Needs: orun (the pinned version) + node + pnpm + python3 + git, and the
# npm registry (it installs). No credential, nothing deployed.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"

for tool in orun node pnpm python3 git; do
  command -v "$tool" >/dev/null || { echo "branded-fork.test.sh needs $tool on PATH" >&2; exit 1; }
done

# BRANDED_FORK_KEEP=<dir> keeps the placed product there, to look at a failure.
if [ -n "${BRANDED_FORK_KEEP:-}" ]; then
  scratch="$BRANDED_FORK_KEEP"; rm -rf "$scratch"; mkdir -p "$scratch"
else
  scratch="$(mktemp -d)"
  trap 'rm -rf "$scratch"' EXIT
fi

sets=()
while IFS=$'\t' read -r k v; do sets+=( --set "$k=$v" ); done < <(
  python3 - "$root/tests/fixtures/acme.json" <<'PY'
import json, sys
for k, v in json.load(open(sys.argv[1])).items():
    if not k.startswith("_"):
        print(f"{k}\t{'true' if v is True else 'false' if v is False else v}")
PY
)

tree="$scratch/product"
mkdir -p "$tree"/{apps,infra,packages,tests}
for d in apps infra packages tests; do touch "$tree/$d/.gitkeep"; done

echo "── placing and branding the whole blueprint"
orun new --blueprint "$root/repo-blueprint.yaml" --out "$tree" "${sets[@]}" > "$scratch/place.log" 2>&1 || {
  echo "FAIL: the placement did not run" >&2; tail -20 "$scratch/place.log" >&2; exit 1; }
(
  cd "$tree"
  git init -q -b main
  git config user.email t@example.invalid
  git config user.name "tier two"
  printf 'baseline/\n.orun/\n' >> .gitignore
  git add -A
  node "$root/tooling/rebrand/rebrand.mjs" --values .rebrand/values.json --allow-dirty
  git add -A
  node "$root/tooling/rebrand/rebrand.mjs" --values .rebrand/values.json --verify
) > "$scratch/brand.log" 2>&1 || { echo "FAIL: the rebrand did not complete" >&2; tail -20 "$scratch/brand.log" >&2; exit 1; }
grep -E 'file\(s\) affected' "$scratch/brand.log" | sed 's/^/   /'

run() { # LABEL COMMAND...
  local label="$1" start log
  shift
  log="$scratch/$(echo "$label" | tr -c 'a-z0-9' '-').log"
  start=$(date +%s)
  if (cd "$tree" && "$@") > "$log" 2>&1; then
    echo "   ok  $label ($(( $(date +%s) - start ))s)"
  else
    echo "FAIL: $label" >&2
    grep -E 'error TS|FAIL |✕|Error:|ERR_' "$log" | head -40 >&2 || tail -40 "$log" >&2
    exit 1
  fi
}

echo "── the product, asked about itself"
# The phases refresh the lockfile after every rebrand (`pnpm install
# --lockfile-only`); a product's first CI install is then frozen against it.
run "lockfile refreshed as the phases refresh it" pnpm install --lockfile-only
run "installed, frozen" pnpm install --frozen-lockfile
run "every package typechecks" pnpm exec turbo run typecheck --concurrency=4
# The suites read each Worker's RENDERED wrangler.jsonc, which is never
# committed: a lane renders it from wrangler.template.jsonc and the committed
# wiring.fixture.json before it verifies (tooling/wire/render.mjs, the same
# renderer the deploy runs against published wiring). So does this.
render_all() {
  local t d n=0
  for t in apps/*/wrangler.template.jsonc; do
    d="$(dirname "$t")"
    [ -f "$d/wiring.fixture.json" ] || { echo "$d has a template and no wiring.fixture.json" >&2; return 1; }
    node tooling/wire/render.mjs --template "$t" --out "$d/wrangler.jsonc" --map "$d/wiring.fixture.json" || return 1
    n=$((n + 1))
  done
  [ "$n" -gt 0 ] || { echo "no wrangler.template.jsonc rendered — gone blind" >&2; return 1; }
}
run "every Worker config rendered from its fixture" render_all
run "every suite passes" pnpm exec turbo run test --concurrency=4 --continue

echo "branded-fork.test.sh: ok"
