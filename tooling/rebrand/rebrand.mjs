#!/usr/bin/env node
// Fork/rebrand renamer for this baseline (zero-dependency).
//
// This repository is a baseline: a product placed from it is rebranded with
// this script, phase by phase. It rewrites every *instance identity* literal —
// repo slug, product domain, product/display name, SDK class name, CLI bin,
// Cloudflare worker resource names (so a fork is account-safe even when it
// shares an account with this repository), wire-visible user agents,
// workers.dev subdomain, the Orun workspace — to the values supplied in a
// values file, leaving *org-owned* identity untouched (the orun state backend,
// `sourceplane.io` manifest apiVersion, company email addresses).
//
// WHERE THE BASELINE'S OWN IDENTITY COMES FROM. The rename map's left-hand
// side is this repository's own `.rebrand/values.json` — the file its own
// bootstrap wrote and AGENTS.md says not to touch — read from next to this
// script, never typed in here. So the engine is the same file in every
// baseline built this way, and a baseline renamed later stays a baseline.
//
// AND THE PLATFORM WORD. This repository was itself born from the Lumen
// baseline, and code it added afterwards names the platform `lumen`: the CMS's
// sign-in (`lib/lumen/`, `/auth/lumen/*`, `LumenLogin`, `lumenUserId`, the
// `lumen_user_id` column, `LUMEN_API`, "your Lumen account"). Lumen's own
// rebrand renamed `lumen` and so produced this repository's name; this one
// renames what is left, in every case-form, into the product's, and RENAMES
// THE PATHS that carry it, so a product carries no `lumen` at all. Every form
// is derived so the pieces that must agree do: a Payload field and the column
// Payload derives from it, a route directory and the URLs that reach it, a
// module path and its imports.
//
// Usage (from the product root, on a clean tree):
//   node tooling/rebrand/rebrand.mjs --values my-brand.json [--dry-run]
//   node tooling/rebrand/rebrand.mjs --verify [--values my-brand.json]
//
// Values file (see tooling/rebrand/values.example.json):
//   {
//     "reponame":      "acme-cloud",          // required — repo slug
//     "productname":   "Acme Cloud",          // required — display name
//     "productdomain": "acme.dev",            // optional — default <reponame>.example.com (set later)
//     "pascalName":    "AcmeCloud",           // default: productname, non-alnum stripped
//     "brandSlug":     "acme",                // default: reponame
//     "cliBin":        "acme",                // default: reponame
//     "apibaseurl":    "https://api.acme.dev",// default: https://api.<productdomain>, or with no
//                                             //   domain https://<brandSlug>-api-edge-prod.<subdomain>.workers.dev
//     "subdomain":     "my-subdomain",        // default: "your-workers-subdomain"
//     "salesEmail":    "sales@acme.dev",      // optional: keeps the baseline mailbox if absent
//     "orunWorkspace": "ws_…"                 // the product's Orun workspace
//   }
//
// Modes:
//   (default)   apply the rename map in place (content, then paths), then sweep
//   --dry-run   report per-rule match counts and paths to rename; change nothing
//   --verify    only run the leftover sweep (non-zero exit on residue)
//   --source <file>  the baseline's own values (default: ../../.rebrand/values.json
//               from this script) — for tests only

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ── Inputs ─────────────────────────────────────────────────────

function flag(name) {
  return process.argv.includes(`--${name}`);
}
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const dryRun = flag("dry-run");
const verifyOnly = flag("verify");

// THE MANIFEST'S KEYS, and the old camelCase ones for products that committed
// them before the blueprint was the bootstrap. The manifest's key wins.
const LEGACY = {
  reponame: "repoName",
  productname: "productName",
  productdomain: "productDomain",
  apibaseurl: "apiBaseUrl",
  subdomain: "workersDevSubdomain",
};
function readValues(file, what) {
  let values;
  try {
    values = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`rebrand: cannot read ${what} ${file}: ${error.message}`);
    process.exit(2);
  }
  for (const [key, old] of Object.entries(LEGACY)) {
    if (values[key] === undefined && values[old] !== undefined) values[key] = values[old];
  }
  for (const required of ["reponame", "productname"]) {
    if (typeof values[required] !== "string" || values[required].length === 0) {
      console.error(`rebrand: ${what} is missing required field "${required}"`);
      process.exit(2);
    }
  }
  return values;
}

// The column name Payload's database adapter derives from a field name
// (to-snake-case: every uppercase letter starts a word). `lumenUserId` is a
// field and `lumen_user_id` its column; renamed apart, the CMS would query a
// column its migration never created. Deriving both from one camel form keeps
// them one name.
function payloadSnake(s) {
  const camel = /([a-z][A-Z]|[A-Z][a-z])/.test(s)
    ? s.replace(/(.)([A-Z]+)/g, (_, prev, uppers) => `${prev} ${uppers.toLowerCase().split("").join(" ")}`)
    : s;
  return camel
    .toLowerCase()
    .replace(/[\W_]+(.|$)/g, (_, next) => (next ? ` ${next}` : ""))
    .trim()
    .replace(/\s/g, "_");
}

// Every form of one identity, derived the same way for the baseline and the
// product so that each rule's two sides are the same KIND of thing.
function derive(values) {
  const reponame = values.reponame ?? "";
  const productname = values.productname ?? "";
  // The domain is NOT ASKED at bootstrap: a product goes live on workers.dev
  // and an owner sets a domain later. Until then the reserved placeholder
  // `<reponame>.example.com` (RFC 2606 — it can never be someone else's)
  // stands wherever the domain goes, so setting it is replacing one string.
  const productdomain = (values.productdomain ?? "").trim() || (reponame ? `${reponame}.example.com` : "");
  const pascalName = (values.pascalName ?? "").trim() || productname.replace(/[^A-Za-z0-9]/g, "");
  const camelName = pascalName.charAt(0).toLowerCase() + pascalName.slice(1);
  const brandSlug = (values.brandSlug ?? "").trim() || reponame;
  const cliBin = (values.cliBin ?? "").trim() || reponame;
  const subdomain = (values.subdomain ?? "").trim() || "your-workers-subdomain";
  // The CLI's default API. With a domain it is `https://api.<domain>`. With
  // none, `api.<placeholder>` could never answer, so it is the product's own
  // prod edge on workers.dev, live from the first deploy: api-edge deploys
  // `--env prod` as `<brandSlug>-api-edge` + `-prod`.
  const apibaseurl =
    (values.apibaseurl ?? "").trim() ||
    ((values.productdomain ?? "").trim()
      ? `https://api.${productdomain}`
      : `https://${brandSlug}-api-edge-prod.${subdomain}.workers.dev`);
  // A `secret://<workspace>/<project>/<env>/<KEY>` ref names the WORKSPACE
  // first and the project (repo) second. A ws_… or org_… id IS a valid
  // workspace segment (orun-cloud state-worker secrets-resolve.ts); the repo
  // name is the last resort only when no workspace was given.
  const workspace =
    (values.orunWorkspaceSlug ?? "").trim() || (values.orunWorkspace ?? "").trim() || reponame;
  return {
    reponame,
    productname,
    productdomain,
    pascalName,
    camelName,
    snakeName: payloadSnake(camelName),
    repoSnake: reponame.replace(/-/g, "_"),
    brandSlug,
    cliBin,
    envPrefix: cliBin.toUpperCase().replace(/-/g, "_"),
    subdomain,
    apibaseurl,
    workspace,
    salesEmail: values.salesEmail,
  };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = arg("source") ?? path.resolve(here, "../../.rebrand/values.json");
const S = derive(readValues(sourcePath, "the baseline's own values"));

const valuesPath = arg("values");
if (!verifyOnly && !valuesPath) {
  console.error("usage: rebrand.mjs --values <file> [--dry-run] | --verify [--values <file>]");
  process.exit(2);
}
// --verify takes --values too, optionally: without them it cannot tell the
// product's own identity from a leftover of the baseline's (below).
const T = valuesPath ? derive(readValues(valuesPath, "values file")) : null;

if (T && !verifyOnly) {
  if (/[^a-z0-9-]/.test(`${T.reponame}${T.brandSlug}${T.cliBin}`)) {
    console.error("rebrand: reponame/brandSlug/cliBin must be lowercase slugs ([a-z0-9-])");
    process.exit(2);
  }
  // The pascal form becomes class and component names (`AcmeCloudLogin`), so
  // it has to be an identifier.
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(T.pascalName)) {
    console.error(
      `rebrand: "${T.pascalName}" (pascalName, or productname without its punctuation) ` +
        "must start with a letter and hold only letters and digits — it names classes and components",
    );
    process.exit(2);
  }
}

// In-place rewrite of the whole tree: insist on a clean checkout so the
// result is reviewable as one diff (and trivially revertible).
if (!verifyOnly && !dryRun && !flag("allow-dirty")) {
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  if (status.trim().length > 0) {
    console.error("rebrand: working tree is not clean — commit/stash first (or pass --allow-dirty)");
    process.exit(2);
  }
}

// ── File set ───────────────────────────────────────────────────

// Tracked text files only. Exclusions are generated/locked artifacts or this
// tool itself.
const EXCLUDE_RE = new RegExp(
  [
    "^tooling/rebrand/",
    "^\\.rebrand/",
    "^pnpm-lock\\.yaml$",
    "^kiox\\.lock$",
    "\\.(png|jpg|jpeg|ico|gif|webp|woff2?|ttf|eot)$",
  ].join("|"),
);

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => f.length > 0 && !EXCLUDE_RE.test(f))
    .filter((f) => {
      // `git ls-files` also lists gitlinks (nested repos) and paths deleted
      // from disk. Only regular files are sweepable.
      try {
        return fs.statSync(f).isFile();
      } catch {
        return false;
      }
    });
}

// ── Protected literals (org-owned identity, never rewritten) ───
const PROTECTED = [
  /https:\/\/orun-api\.sourceplane\.ai/g, // orun state backend
  /sourceplane\.io/g, // manifest apiVersion, owned by the orun tooling
  /[A-Za-z0-9._%+-]+@sourceplane\.ai/g, // company mailboxes
];
const MASK = (i, j) => `\u0000REBRAND_PROTECTED_${i}_${j}\u0000`;

// ── Substituted values are opaque ──────────────────────────────
//
// The rules run in sequence over one buffer. A rule writes a TOKEN standing
// for its value, and every token is expanded once, after the last rule — so a
// value that contains a baseline word (`lumen-e2e`, `Lumen Next`) is never
// rewritten a second time. A token is NUL, `H<n>`, NUL; its outer characters
// take the word/non-word class of the value's own first and last characters,
// so a `\b` (or a lookaround on [A-Za-z0-9]) in a later rule sees the same
// boundary beside the token that it would have seen beside the value.
const heldValues = [];
const heldIndex = new Map();
function hold(value) {
  if (value === "") return "";
  let i = heldIndex.get(value);
  if (i === undefined) {
    i = heldValues.push(value) - 1;
    heldIndex.set(value, i);
  }
  const edge = (c) => (/[A-Za-z0-9]/.test(c) ? "0" : c === "_" ? "_" : "\u0001");
  return `${edge(value[0])}\u0000H${i}\u0000${edge(value[value.length - 1])}`;
}
const HELD_RE = /[0_\u0001]\u0000H(\d+)\u0000[0_\u0001]/g;
function release(text) {
  return text.replace(HELD_RE, (_, i) => heldValues[Number(i)]);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ── Worker resource names ──────────────────────────────────────
//
// Every Cloudflare worker ships brand-prefixed as `<brandSlug>-<base>`, the
// base being its `apps/<base>/` directory. Re-prefixed so a fork's workers
// never collide with this repository's, even in a shared account. The console
// is an explicit literal pair (`<brandSlug>-web-console`), which also covers
// its `-next` name.
function workerBases(files) {
  const bases = new Set();
  for (const file of files) {
    const m = /^apps\/([^/]+)\//.exec(file);
    if (m && m[1] !== "web-console-next") bases.add(m[1]);
  }
  return [...bases];
}

// ── The rules ──────────────────────────────────────────────────

const PLATFORM = "lumen"; // the word the CMS code names the platform with
const NOT_ALNUM_BEFORE = "(?<![A-Za-z0-9])";
const NOT_ALNUM_AFTER = "(?![A-Za-z0-9])";

// Literal pairs, most specific first.
function literalPairs() {
  const list = [];
  if (T.salesEmail) list.push(["sales@sourceplane.ai", T.salesEmail, "sales mailbox (console seam)"]);
  list.push(
    // The secret ref's workspace AND project, as one: MUST precede the
    // workspace and repo-slug rules, which would each take half of it.
    [`secret://${S.workspace}/${S.reponame}/`, `secret://${T.workspace}/${T.reponame}/`, "secret ref workspace/project"],
    [`${S.brandSlug}-web-console`, `${T.brandSlug}-web-console`, "console worker prefix"],
    [`${S.pascalName}-Webhooks`, `${T.pascalName}-Webhooks`, "webhooks UA"],
    // The CLI default API seam. Elsewhere the same URL is "the prod edge on
    // workers.dev", which the worker and subdomain rules below rebrand.
    [`DEFAULT_API_URL = "${S.apibaseurl}"`, `DEFAULT_API_URL = "${T.apibaseurl}"`, "CLI default API base"],
    [S.productdomain, T.productdomain, "product domain"],
    [`STORAGE_PREFIX = "${S.brandSlug}.next"`, `STORAGE_PREFIX = "${T.brandSlug}.next"`, "storage prefix"],
    [S.subdomain, T.subdomain, "workers.dev subdomain"],
    [S.workspace, T.workspace, "Orun workspace"],
    // Docs: the CLI's config dir and command examples, the check-run name.
    [`.config/${S.cliBin}/`, `.config/${T.cliBin}/`, "CLI config dir (docs)"],
    [`\`${S.cliBin} `, `\`${T.cliBin} `, "CLI bin (doc examples, open)"],
    [`\`${S.cliBin}\``, `\`${T.cliBin}\``, "CLI bin (doc examples, closed)"],
    [`"${S.brandSlug}/verify"`, `"${T.brandSlug}/verify"`, "check-run name example"],
    // The product's own name, every case-form. The display name has a space,
    // so it is never an identifier and is the display name everywhere.
    [S.productname, T.productname, "product name"],
    [S.pascalName, T.pascalName, "PascalCase name"],
    [S.camelName, T.camelName, "camelCase name"],
  );
  return list.filter(([from, to]) => from && from !== to);
}

// Regex rules, in order, after the literal pairs.
function regexRules(files) {
  const list = [
    {
      re: new RegExp(`\\b${esc(S.envPrefix)}(?![A-Za-z0-9])`, "g"),
      to: () => T.envPrefix,
      label: "env-var prefix",
    },
    {
      re: new RegExp(`${NOT_ALNUM_BEFORE}${esc(S.repoSnake)}${NOT_ALNUM_AFTER}`, "g"),
      to: () => T.repoSnake,
      label: "snake_case repo slug",
    },
    // The same name derived from the PascalCase form, which differs from the
    // repo slug's when a word carries a digit (`saas2` against `saas_2`).
    {
      re: new RegExp(`${NOT_ALNUM_BEFORE}${esc(S.snakeName)}${NOT_ALNUM_AFTER}`, "g"),
      to: () => T.snakeName,
      label: "snake_case name",
    },
  ];
  const bases = workerBases(files);
  if (bases.length > 0) {
    const wb = bases.slice().sort((a, b) => b.length - a.length).map(esc).join("|");
    list.push({
      re: new RegExp(`\\b${esc(S.brandSlug)}-(${wb})\\b`, "g"),
      to: (_file, _m, base) => `${T.brandSlug}-${base}`,
      label: "worker CF name",
    });
  }
  // CLI bin: usage strings, keychain/config-dir derivations, package bin.
  list.push(
    {
      re: new RegExp(`\\b${esc(S.cliBin)}\\b`, "g"),
      to: () => T.cliBin,
      label: "CLI bin (packages/cli)",
      fileFilter: (file) => file.startsWith("packages/cli/"),
    },
    // Repo slug: intent metadata.name, component repo: fields, Supabase and
    // Hyperdrive project names (`<repo>-stage`), the root package, docs.
    {
      re: new RegExp(`\\b${esc(S.reponame)}\\b`, "g"),
      to: () => T.reponame,
      label: "repo slug",
      fileFilter: (file) => !file.startsWith("packages/cli/"),
    },
  );

  // ── The platform word, in every case-form the code uses ──
  //
  // Env vars and bindings: LUMEN_API, LUMEN_SESSION_COOKIE → <ENV>_API, …
  list.push({ re: /LUMEN_(?=[A-Z])/g, to: () => `${T.envPrefix}_`, label: "platform env prefix" });
  // Glued into an identifier: LumenLogin, LumenTransport, findByLumenId.
  list.push({
    re: /(?<=[A-Za-z0-9_])Lumen|Lumen(?=[A-Za-z0-9_])/g,
    to: () => T.pascalName,
    label: "platform PascalCase",
  });
  // camelCase: lumenUserId, lumenCall — and so the Payload field the column
  // below is derived from.
  list.push({
    re: new RegExp(`${NOT_ALNUM_BEFORE}${PLATFORM}(?=[A-Z])`, "g"),
    to: () => T.camelName,
    label: "platform camelCase",
  });
  // snake_case: lumen_user_id, lumen_session, 206_cms_lumen_identity.
  list.push({
    re: new RegExp(`(?<=_)${PLATFORM}${NOT_ALNUM_AFTER}|${NOT_ALNUM_BEFORE}${PLATFORM}(?=_)`, "g"),
    to: () => T.snakeName,
    label: "platform snake_case",
  });
  // Everything else is a slug: lib/lumen/, /auth/lumen/*, 'lumen' (the
  // Payload strategy), lumen-email. The CLI's meaning of a bare word is its
  // bin, as for the repo slug above.
  list.push({
    re: new RegExp(`${NOT_ALNUM_BEFORE}${PLATFORM}${NOT_ALNUM_AFTER}`, "g"),
    to: (file) => (file.startsWith("packages/cli/") ? T.cliBin : T.brandSlug),
    label: "platform slug",
  });
  return list;
}

// A standalone `Lumen` is the platform's display name: every one in code is
// prose (a UI string, a comment, a test title), so it is the product's display
// name there too. Only markdown code — fences and inline spans — keeps the
// identifier form.
function replaceBrandWord(file, text, count, asPath) {
  const sub = (chunk, to) =>
    chunk.replace(/\bLumen\b/g, () => {
      count();
      return hold(to);
    });
  // A path is never prose: a display name would put a space in it.
  if (asPath) return sub(text, T.pascalName);
  if (!/\.(md|markdown)$/.test(file)) return sub(text, T.productname);
  return text
    .split(/(```[\s\S]*?(?:```|$))/)
    .map((part) => {
      if (part.startsWith("```")) return sub(part, T.pascalName);
      return part
        .split(/(`[^`\n]+`)/)
        .map((span) =>
          span.startsWith("`") && span.endsWith("`") ? sub(span, T.pascalName) : sub(span, T.productname),
        )
        .join("");
    })
    .join("");
}

// ── Leftover sweep ─────────────────────────────────────────────
//
// After a rebrand (or under --verify) every remaining baseline-identity
// literal is residue: org-owned (allowed, enumerated below) or a missed rename
// (reported, non-zero exit). Paths are swept as well as contents: a file still
// NAMED after the baseline is as much a leftover as a line.
//
// `lumen` in any case and any position is residue — the platform word is
// renamed wherever it stands, so nothing legitimately keeps it. So is the
// baseline's own name in every form (which may not contain the word at all),
// and its subdomain and workspace when the product's differ: a fork deploying
// into the same account or workspace legitimately keeps those.
function residueRe() {
  const parts = [PLATFORM];
  for (const form of [S.reponame, S.productname, S.pascalName, S.camelName, S.repoSnake, S.snakeName, S.envPrefix]) {
    if (form && !form.toLowerCase().includes(PLATFORM)) parts.push(esc(form));
  }
  // Only with the product's values, and only when they differ: without them a
  // kept subdomain or workspace cannot be told from a missed one.
  for (const key of ["subdomain", "workspace"]) {
    if (T && S[key] && S[key] !== T[key]) parts.push(esc(S[key]));
  }
  return new RegExp(parts.join("|"), "i");
}

const ALLOWED_RESIDUE = [
  /https:\/\/orun-api\.sourceplane\.ai/g, // orun state backend
  /[A-Za-z0-9._%+-]+@sourceplane\.ai/g, // company mailboxes
];

function sweep(files, allowedLiterals) {
  const RESIDUE = residueRe();
  const clean = (s) => {
    let out = ALLOWED_RESIDUE.reduce((l, re) => l.replace(re, ""), s);
    // The rename's own TARGET values: a fork legitimately named with the
    // platform word inside it (repo "lumen-e2e") is not residue.
    for (const lit of allowedLiterals) if (lit) out = out.split(lit).join("");
    return out;
  };
  const residue = [];
  for (const file of files) {
    if (RESIDUE.test(clean(file))) residue.push(`${file}: (the path)`);
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (RESIDUE.test(clean(line))) residue.push(`${file}: ${line.trim().slice(0, 120)}`);
    }
  }
  return residue;
}

// ── Main ───────────────────────────────────────────────────────

const files = trackedFiles();

if (verifyOnly && !T) {
  // Without the product's values every form of the platform word and of the
  // baseline's name is residue, which is what a product that kept none wants.
  const residue = sweep(files, []);
  report(residue, "rebrand --verify");
}

const LITERALS = literalPairs();
const RULES = regexRules(files);

// Every value a rule can write, for the sweep and for the guard below.
const produced = [
  ...LITERALS.map(([, to]) => to),
  T.envPrefix,
  `${T.envPrefix}_`,
  T.repoSnake,
  T.snakeName,
  T.cliBin,
  T.reponame,
  T.brandSlug,
  T.pascalName,
  T.camelName,
  T.productname,
  ...workerBases(files).map((base) => `${T.brandSlug}-${base}`),
].filter((v, i, all) => v && all.indexOf(v) === i);
const RESIDUE_FOR_ALLOW = residueRe();
const allowed = produced.filter((to) => RESIDUE_FOR_ALLOW.test(to));

if (verifyOnly) {
  // A product whose own name or workspace contains a baseline word
  // (`lumen-test`) carries it legitimately; given --values, what this rebrand
  // would write is allowed exactly as the post-rename sweep allows it.
  report(sweep(files, allowed), "rebrand --verify");
}

// What a previous run already wrote stays as written. Every phase of a
// bootstrap re-runs this over the whole tree, so the product a previous run
// branded is the input to the next one: a value some rule would match again
// is HELD wherever it already stands.
const rematchable = (v) =>
  LITERALS.some(([from]) => v.includes(from)) ||
  /\bLumen\b/.test(v) ||
  RULES.some(({ re }) => new RegExp(re.source).test(v));
const guarded = produced.filter(rematchable).sort((a, b) => b.length - a.length);

const counts = new Map();
const bump = (label) => counts.set(label, (counts.get(label) ?? 0) + 1);

function transform(file, input, asPath = false) {
  let text = input;
  const masks = [];
  PROTECTED.forEach((re, i) => {
    text = text.replace(re, (m) => {
      const token = MASK(i, masks.length);
      masks.push([token, m]);
      return token;
    });
  });
  for (const value of guarded) text = text.split(value).join(hold(value));
  for (const [from, to, label] of LITERALS) {
    const n = text.split(from).length - 1;
    if (n === 0) continue;
    text = text.split(from).join(hold(to));
    for (let k = 0; k < n; k++) bump(label);
  }
  for (const { re, to, label, fileFilter } of RULES) {
    if (fileFilter && !fileFilter(file)) continue;
    text = text.replace(re, (...m) => {
      bump(label);
      return hold(to(file, ...m));
    });
  }
  text = replaceBrandWord(file, text, () => bump("Lumen (display name; identifier in markdown code)"), asPath);
  text = release(text);
  for (const [token, value] of masks) text = text.split(token).join(value);
  return text;
}

const touched = new Set();
for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (text.includes("\0")) continue; // binary safety net
  const out = transform(file, text);
  if (out !== text) {
    touched.add(file);
    if (!dryRun) fs.writeFileSync(file, out);
  }
}

// ── Paths ──────────────────────────────────────────────────────
//
// A path is renamed by the same rules as the text that names it, so a
// directory and the imports, routes and migration names that point into it
// stay one string. Under `git mv`, so the index (which the sweep and the
// landing both read) follows.
const renames = [];
for (const file of trackedFiles()) {
  const next = transform(file, file, true);
  if (next !== file) renames.push([file, next]);
}
for (const [from, to] of renames) {
  bump("path renamed");
  if (dryRun) continue;
  if (fs.existsSync(to)) {
    console.error(`rebrand: cannot rename ${from} → ${to}: the target exists`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  execFileSync("git", ["mv", from, to]);
}
// Directories the renames emptied.
if (!dryRun) {
  const dirs = [...new Set(renames.map(([from]) => path.dirname(from)))].sort((a, b) => b.length - a.length);
  for (const dir of dirs) {
    for (let d = dir; d && d !== "."; d = path.dirname(d)) {
      try {
        if (fs.readdirSync(d).length > 0) break;
        fs.rmdirSync(d);
      } catch {
        break;
      }
    }
  }
}

// ── Migration checksums ────────────────────────────────────────
//
// The migration runner refuses a migration whose file does not hash to the
// checksum its manifest records — on plan and on apply. A migration this
// rebrand rewrote (206 renames the column it adds) is a different file, so a
// product's first db-migrate would refuse it and 03-infrastructure-database
// would never converge. A product applies every migration to an empty
// database, so its manifest records the product's own files: each migration
// THIS RUN rewrote is re-sealed. One it did not touch is left alone, so a
// hand edit to a migration still fails the runner, as it should.
const MANIFEST = "packages/db/src/manifest.ts";
const MIGRATIONS = "packages/db/src/migrations/";
let resealed = 0;
if (!dryRun && fs.existsSync(MANIFEST)) {
  const moved = new Map(renames);
  const rewritten = new Set(
    [...touched].filter((f) => f.startsWith(MIGRATIONS)).map((f) => (moved.get(f) ?? f).slice(MIGRATIONS.length)),
  );
  const before = fs.readFileSync(MANIFEST, "utf8");
  const after = before.replace(
    /(path:\s*"([^"]+)",\s*checksum:\s*")([0-9a-f]{64})(")/g,
    (whole, head, rel, sum, tail) => {
      if (!rewritten.has(rel)) return whole;
      const now = createHash("sha256").update(fs.readFileSync(MIGRATIONS + rel)).digest("hex");
      if (now === sum) return whole;
      resealed += 1;
      return head + now + tail;
    },
  );
  if (after !== before) fs.writeFileSync(MANIFEST, after);
  bump("migration checksum resealed");
  if (resealed === 0) counts.delete("migration checksum resealed");
  else counts.set("migration checksum resealed", resealed);
}

console.log(
  `rebrand${dryRun ? " (dry-run)" : ""}: ${touched.size} file(s) affected, ${renames.length} path(s) renamed`,
);
for (const [label, n] of counts) console.log(`  ${String(n).padStart(5)}  ${label}`);
if (dryRun) {
  for (const [from, to] of renames) console.log(`  ${from} → ${to}`);
  process.exit(0);
}

report(sweep(trackedFiles(), allowed), "rebrand", "after rename");

function report(residue, who, when = "") {
  if (residue.length > 0) {
    console.error(`${who}: ${residue.length} baseline-identity leftover(s)${when ? ` ${when}` : ""}:`);
    for (const r of residue) console.error(`  ${r}`);
    process.exit(1);
  }
  console.log(`${who}: ${who === "rebrand" ? "leftover sweep clean." : "no baseline-identity leftovers."}`);
  process.exit(0);
}
