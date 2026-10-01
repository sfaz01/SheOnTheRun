/* End-to-end test of the admin API against a real PHP server and a fresh SQLite database:
     node --test server/tests/flow.test.mjs
   The TOTP codes are computed here with Node's crypto — an independent implementation —
   so this also proves the PHP side agrees with a standard authenticator app. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 8193;
const BASE = `http://localhost:${PORT}`;
const TOKEN = "test-setup-token-0123456789";
const EMAIL = "owner@example.com";
const PASSWORD = "three purple running shoes";
const NEW_PASSWORD = "four green walking boots";

let server;
let workdir;

/* ----------------------------------------------------------- tiny HTTP client */
function client() {
  const jar = new Map();
  let csrf = "";
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  async function call(method, path, body, { headers = {}, rawBody = false, sendCsrf = true } = {}) {
    const h = { ...headers };
    if (jar.size) h.cookie = cookieHeader();
    if (method !== "GET") {
      if (!rawBody) h["content-type"] = "application/json";
      if (sendCsrf && csrf) h["x-csrf-token"] = csrf;
    }
    const res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : rawBody ? body : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    let json = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, json, headers: res.headers };
  }
  return {
    call,
    async state() { const r = await call("GET", "/api/auth/state"); csrf = r.json.csrf; return r.json; },
    get cookies() { return jar; },
  };
}

/* -------------------------------------------------------------- RFC 6238 TOTP */
function base32Decode(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of s.toUpperCase().replace(/=+$/, "")) bits += A.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret, stepOffset = 0) {
  const step = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const o = h[19] & 0xf;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/* -------------------------------------------------------------- server set-up */
before(async () => {
  workdir = mkdtempSync(join(tmpdir(), "sotr-flow-"));
  const cfg = join(workdir, "config.php");
  const db = join(workdir, "test.sqlite").replace(/\\/g, "/");
  writeFileSync(cfg, `<?php return ['env'=>'dev','setup_token'=>'${TOKEN}','db'=>['driver'=>'sqlite','path'=>'${db}']];\n`);

  const finder = spawnSync(process.platform === "win32" ? "where" : "which", ["php"], { encoding: "utf8" });
  const phpPath = finder.stdout.split(/\r?\n/)[0].trim();
  const ini = ["display_errors=1", "error_reporting=E_ALL", "date.timezone=UTC"];
  if (process.platform === "win32") {
    ini.push(`extension_dir="${join(dirname(phpPath), "ext")}"`);
    for (const e of ["mbstring", "openssl", "fileinfo", "gd", "pdo_sqlite", "sqlite3"]) ini.push(`extension=${e}`);
  }
  const iniPath = join(workdir, "php.ini");
  writeFileSync(iniPath, ini.join("\n") + "\n");

  server = spawn(phpPath, ["-c", iniPath, "-S", `localhost:${PORT}`, "-t", root, join(root, "server", "dev", "router.php")], {
    env: { ...process.env, SOTR_CONFIG: cfg },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + "/api/health")).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("PHP server did not start");
});

after(() => {
  server?.kill();
  try { rmSync(workdir, { recursive: true, force: true }); } catch { /* Windows may hold the file briefly */ }
});

/* --------------------------------------------------------------------- tests */
const owner = client();
let secret = "";
let recovery = [];

test("health check responds and the database is reachable", async () => {
  const r = await owner.call("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true, db: true });
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("fresh install: anonymous, setup is offered, a CSRF token is issued", async () => {
  const s = await owner.state();
  assert.equal(s.stage, "anonymous");
  assert.equal(s.setup_available, true);
  assert.match(s.csrf, /^[0-9a-f]{64}$/);
});

test("writes are refused without a CSRF token, with the wrong content type, or from another origin", async () => {
  const noCsrf = await owner.call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD }, { sendCsrf: false });
  assert.equal(noCsrf.status, 403);
  const form = await owner.call("POST", "/api/auth/login", "email=a&password=b", { rawBody: true, headers: { "content-type": "application/x-www-form-urlencoded" } });
  assert.equal(form.status, 415);
  const cross = await owner.call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD }, { headers: { origin: "https://evil.example" } });
  assert.equal(cross.status, 403);
});

test("protected endpoints need a sign-in", async () => {
  const r = await owner.call("GET", "/api/admin/server-check");
  assert.equal(r.status, 401);
});

test("setup rejects a wrong token and a weak password", async () => {
  const bad = await owner.call("POST", "/api/auth/setup", { token: "nope", email: EMAIL, password: PASSWORD });
  assert.equal(bad.status, 403);
  const weak = await owner.call("POST", "/api/auth/setup", { token: TOKEN, email: EMAIL, password: "short" });
  assert.equal(weak.status, 422);
  const badEmail = await owner.call("POST", "/api/auth/setup", { token: TOKEN, email: "not-an-email", password: PASSWORD });
  assert.equal(badEmail.status, 422);
});

test("first admin is created and must enrol an authenticator app", async () => {
  const r = await owner.call("POST", "/api/auth/setup", { token: TOKEN, email: EMAIL, password: PASSWORD });
  assert.equal(r.status, 200);
  assert.equal(r.json.next, "enroll");
  await owner.state();
  const early = await owner.call("GET", "/api/admin/server-check");
  assert.equal(early.status, 401, "password alone must not open the admin");
});

test("setup closes itself once an admin exists", async () => {
  const other = client();
  const s = await other.state();
  assert.equal(s.setup_available, false);
  const r = await other.call("POST", "/api/auth/setup", { token: TOKEN, email: "second@example.com", password: PASSWORD });
  assert.equal(r.status, 403);
});

test("enrolment: a wrong code fails, the right code enables 2-step and issues recovery codes", async () => {
  const begin = await owner.call("POST", "/api/auth/2fa/begin", {});
  assert.equal(begin.status, 200);
  secret = begin.json.secret;
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.match(begin.json.uri, /^otpauth:\/\/totp\//);

  const wrong = await owner.call("POST", "/api/auth/2fa/enable", { code: "000000" === totp(secret) ? "111111" : "000000" });
  assert.equal(wrong.status, 401);

  const ok = await owner.call("POST", "/api/auth/2fa/enable", { code: totp(secret) });
  assert.equal(ok.status, 200);
  recovery = ok.json.recovery_codes;
  assert.equal(recovery.length, 8);
  assert.ok(recovery.every((c) => /^[a-z0-9]{5}-[a-z0-9]{5}$/.test(c)));

  const s = await owner.state();
  assert.equal(s.stage, "full");
  assert.equal(s.user.email, EMAIL);
});

test("signed in: the server check runs and passes the essentials", async () => {
  const r = await owner.call("GET", "/api/admin/server-check");
  assert.equal(r.status, 200);
  const byId = Object.fromEntries(r.json.checks.map((c) => [c.id, c]));
  assert.equal(byId.php.status, "ok");
  assert.equal(byId.db.status, "ok");
  assert.equal(byId.ext_pdo_sqlite.status, "ok");
});

test("logout ends the session", async () => {
  const out = await owner.call("POST", "/api/auth/logout", {});
  assert.equal(out.status, 200);
  await owner.state();
  const r = await owner.call("GET", "/api/admin/server-check");
  assert.equal(r.status, 401);
});

test("login: wrong password is a generic 401; then password + the NEXT authenticator code signs in", async () => {
  await owner.state();
  const bad = await owner.call("POST", "/api/auth/login", { email: EMAIL, password: "wrong wrong wrong" });
  assert.equal(bad.status, 401);
  const unknown = await owner.call("POST", "/api/auth/login", { email: "nobody@example.com", password: PASSWORD });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.json.error, bad.json.error, "must not reveal whether an email exists");

  const ok = await owner.call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
  assert.equal(ok.json.next, "2fa");
  await owner.state();
  // the current step was consumed at enrolment, so a replay must fail…
  const replay = await owner.call("POST", "/api/auth/2fa", { code: totp(secret, 0) });
  assert.equal(replay.status, 401, "a code that was already used must not work twice");
  // …and the next step is accepted (within the one-step clock-drift window)
  const good = await owner.call("POST", "/api/auth/2fa", { code: totp(secret, 1) });
  assert.equal(good.status, 200);
  const s = await owner.state();
  assert.equal(s.stage, "full");
});

test("a recovery code signs in once, and only once", async () => {
  await owner.call("POST", "/api/auth/logout", {});
  await owner.state();
  await owner.call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
  await owner.state();
  const used = await owner.call("POST", "/api/auth/2fa", { code: recovery[0] });
  assert.equal(used.status, 200);
  assert.equal(used.json.recovery_used, true);
  assert.equal(used.json.recovery_left, 7);

  await owner.call("POST", "/api/auth/logout", {});
  await owner.state();
  await owner.call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
  await owner.state();
  const again = await owner.call("POST", "/api/auth/2fa", { code: recovery[0] });
  assert.equal(again.status, 401);
});

test("password change needs the current password and a strong new one", async () => {
  await owner.call("POST", "/api/auth/logout", {});
  await owner.state();
  await owner.call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
  await owner.state();
  await owner.call("POST", "/api/auth/2fa", { code: recovery[1] });
  await owner.state();

  const wrong = await owner.call("POST", "/api/auth/password", { current: "nope nope nope nope", new: NEW_PASSWORD });
  assert.equal(wrong.status, 401);
  const weak = await owner.call("POST", "/api/auth/password", { current: PASSWORD, new: "short" });
  assert.equal(weak.status, 422);
  await owner.state();
  const ok = await owner.call("POST", "/api/auth/password", { current: PASSWORD, new: NEW_PASSWORD });
  assert.equal(ok.status, 200);

  await owner.call("POST", "/api/auth/logout", {});
  await owner.state();
  const old = await owner.call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
  assert.equal(old.status, 401);
  const fresh = await owner.call("POST", "/api/auth/login", { email: EMAIL, password: NEW_PASSWORD });
  assert.equal(fresh.status, 200);
});

test("repeated wrong passwords lock the account for a while", async () => {
  const attacker = client();
  await attacker.state();
  const email = "locktest@example.com";
  const codes = [];
  for (let i = 0; i < 6; i++) {
    codes.push((await attacker.call("POST", "/api/auth/login", { email, password: "guess guess guess " + i })).status);
  }
  assert.deepEqual(codes, [401, 401, 401, 401, 401, 429]);
});

test("unknown API routes return JSON 404", async () => {
  const r = await owner.call("GET", "/api/nope");
  assert.equal(r.status, 404);
  assert.ok(r.json.error);
});

test("the backend's source and data are not downloadable", async () => {
  for (const p of ["/server/app/Auth.php", "/server/dev/config.dev.php", "/docs/admin-panel-plan.md"]) {
    const r = await fetch(BASE + p);
    assert.equal(r.status, 403, p);
  }
});
