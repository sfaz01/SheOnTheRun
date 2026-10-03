/* The public forms with their DEFAULT limits: every request counts, and flooding them can't lock
   the owner out of signing in.
     node --test server/tests/ratelimit.test.mjs */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, client, enrol } from "./helpers.mjs";

const TOKEN = "ratelimit-test-token-0123456789";
let srv;

const post = (path, body) => fetch(srv.base + path, {
  method: "POST", headers: { "content-type": "application/json", origin: srv.base }, body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

before(async () => { srv = await startServer({ port: 8198, setupToken: TOKEN }); });
after(() => srv?.stop());

test("the sixth checkout attempt in an hour is slowed down — even a failing one counts", async () => {
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await post("/api/orders", { name: "x" })).status);
  assert.deepEqual(statuses, [503, 503, 503, 503, 503, 429], "5 allowed (here: refused for lack of a published shop), then 429");
  const slow = await post("/api/orders", { name: "x" });
  assert.equal(slow.json.code, "slow_down");
});

test("the contact form has its own allowance", async () => {
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await post("/api/messages", { name: "A" })).status);
  assert.deepEqual(statuses, [422, 422, 422, 422, 422, 429]);
});

test("flooding the public forms doesn't lock the owner out of signing in", async () => {
  const c = client(srv.base);
  await c.state();
  assert.equal((await c.call("POST", "/api/auth/setup", { token: TOKEN, email: "owner@example.com", password: "three purple running shoes" })).status, 200);
  await enrol(c);
  await c.call("POST", "/api/auth/logout", {});
  await c.state();
  assert.equal((await c.call("POST", "/api/auth/login", { email: "owner@example.com", password: "three purple running shoes" })).status, 200);
});
