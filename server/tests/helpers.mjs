/* Shared pieces for the API tests: a PHP server on a throwaway SQLite database,
   a cookie-keeping JSON client, and an independent RFC 6238 code generator. */
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { phpCommand } from "./php.mjs";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function startServer({ port, setupToken }) {
  const work = mkdtempSync(join(tmpdir(), "sotr-test-"));
  const site = join(work, "site");
  mkdirSync(join(site, "data"), { recursive: true });
  const fwd = (p) => p.replace(/\\/g, "/");
  const cfg = join(work, "config.php");
  writeFileSync(cfg, `<?php return ['env'=>'dev','setup_token'=>'${setupToken}','site_root'=>'${fwd(site)}','db'=>['driver'=>'sqlite','path'=>'${fwd(join(work, "test.sqlite"))}']];\n`);
  const [php, args] = phpCommand();
  const proc = spawn(php, [...args, "-S", `localhost:${port}`, "-t", root, join(root, "server", "dev", "router.php")], {
    env: { ...process.env, SOTR_CONFIG: cfg }, stdio: "ignore",
  });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base + "/api/health")).ok) break; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  return {
    base, site,
    stop() { proc.kill(); try { rmSync(work, { recursive: true, force: true }); } catch { /* Windows file locks */ } },
  };
}

export function client(base) {
  const jar = new Map();
  let csrf = "";
  async function call(method, path, body) {
    const headers = {};
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (method !== "GET") { headers["content-type"] = "application/json"; if (csrf) headers["x-csrf-token"] = csrf; }
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";"); const i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    let json = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, json };
  }
  return {
    call,
    async state() { const r = await call("GET", "/api/auth/state"); csrf = r.json.csrf; return r.json; },
  };
}

function base32Decode(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of s.toUpperCase().replace(/=+$/, "")) bits += A.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totp(secret, stepOffset = 0) {
  const step = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const hm = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const o = hm[19] & 0xf;
  const bin = ((hm[o] & 0x7f) << 24) | (hm[o + 1] << 16) | (hm[o + 2] << 8) | hm[o + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/** From "next: enroll" to fully signed in. Returns the TOTP secret. */
export async function enrol(c) {
  await c.state();
  const begin = await c.call("POST", "/api/auth/2fa/begin", {});
  const ok = await c.call("POST", "/api/auth/2fa/enable", { code: totp(begin.json.secret) });
  if (ok.status !== 200) throw new Error("enrolment failed: " + JSON.stringify(ok.json));
  await c.state();
  return begin.json.secret;
}
