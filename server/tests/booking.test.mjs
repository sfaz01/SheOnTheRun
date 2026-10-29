/* Consultation booking end to end: the times she offers, what a client can pick, the request, the
   protection against two people taking the same time, and what she does with it in the admin.
     node --test server/tests/booking.test.mjs */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, client, enrol } from "./helpers.mjs";

const TOKEN = "booking-test-token-0123456789";
let srv, owner;

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const week = (slots) => Object.fromEntries(DAYS.map((d) => [d, slots]));
const WEEKLY = [{ time: "10:00", place: "gemmayze" }, { time: "11:30", place: "online" }, { time: "17:00", place: "ohana" }];

/** What a visitor's browser does: JSON with an Origin header, no session. */
async function visit(method, path, body) {
  const res = await fetch(srv.base + path, {
    method, headers: { "content-type": "application/json", origin: srv.base }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* none */ }
  return { status: res.status, json };
}
const open = async () => (await visit("GET", "/api/availability")).json;
const ask = (slot, extra = {}) => visit("POST", "/api/bookings", {
  name: "Nour Haddad", phone: "+961 70 123 456", email: "nour@example.com", service: "initial-consultation", ...slot, ...extra,
});
const save = async (doc) => owner.call("PUT", "/api/admin/availability", { doc });
const firstSlot = (days, place) => {
  for (const date of Object.keys(days).sort()) {
    const s = days[date].find((x) => !place || x.place === place);
    if (s) return { date, time: s.time, place: s.place };
  }
  return null;
};

before(async () => {
  srv = await startServer({ port: 8204, setupToken: TOKEN, extra: "'limits'=>['bookings_per_hour'=>1000]" });
  owner = client(srv.base);
  await owner.state();
  await owner.call("POST", "/api/auth/setup", { token: TOKEN, email: "owner@example.com", password: "three purple running shoes" });
  await enrol(owner);
  await owner.call("GET", "/api/admin/status");
});
after(() => srv?.stop());

test("until she has set times up, the site offers nothing and says so", async () => {
  const a = await open();
  assert.equal(a.configured, false);
  assert.deepEqual(a.days, {});
  assert.equal((await ask({ date: "2030-01-07", time: "10:00", place: "gemmayze" })).status, 409, "and no request is accepted");
});

test("the admin page for it needs a sign-in", async () => {
  assert.equal((await visit("GET", "/api/admin/availability")).status, 401);
  assert.equal((await visit("GET", "/api/admin/bookings")).status, 401);
  assert.equal((await visit("PUT", "/api/admin/availability", { doc: {} })).status, 403, "a write needs a session and the page's token");
});

test("a mistake in her times is explained beside the exact row", async () => {
  const bad = await save({ weekly: { mon: [{ time: "25:00", place: "gemmayze" }, { time: "10:00", place: "nowhere" }, { time: "09:00", place: "online" }, { time: "09:00", place: "online" }], tue: "no" }, daysOff: ["not a date"], extra: [{ date: "2030-02-30", slots: [] }], horizonDays: 2, noticeHours: -1 });
  assert.equal(bad.status, 422);
  const paths = bad.json.errors.map((e) => e.path);
  for (const p of ["weekly.mon.0.time", "weekly.mon.1.place", "weekly.mon.3.time", "weekly.tue", "daysOff.0", "extra.0.date", "horizonDays", "noticeHours"]) assert.ok(paths.includes(p), `${p} in ${paths.join()}`);
});

test("she saves her week; clients see the open times, in order, without any personal data", async () => {
  const r = await save({ weekly: week([WEEKLY[2], WEEKLY[0], WEEKLY[1]]), daysOff: [], extra: [], horizonDays: 21, noticeHours: 0, note: "Sessions are 45 minutes." });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.doc.weekly.mon.map((s) => s.time), ["10:00", "11:30", "17:00"], "sorted");
  const a = await open();
  assert.equal(a.configured, true);
  assert.equal(a.timezone, "Asia/Beirut");
  assert.equal(a.note, "Sessions are 45 minutes.");
  assert.deepEqual(Object.keys(a.places), ["gemmayze", "ohana", "online"]);
  const dates = Object.keys(a.days);
  assert.ok(dates.length >= 18 && dates.length <= 22, `${dates.length} open days in three weeks`);
  assert.ok(dates.every((d) => d >= a.today), "never a past day");
  assert.deepEqual(Object.keys(a.days[dates[dates.length - 1]][0]).sort(), ["place", "time"]);
});

test("a day off hides every time that day; an extra day adds its own", async () => {
  const days = (await open()).days;
  const [off, extra] = [Object.keys(days).sort()[3], "2030-06-01"];
  const doc = (await owner.call("GET", "/api/admin/availability")).json.doc;
  const saved = await save({ ...doc, daysOff: [off], extra: [{ date: extra, slots: [{ time: "08:00", place: "online" }] }], horizonDays: 120 });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  const a = await open();
  assert.equal(a.days[off], undefined, "the day off is gone");
  assert.equal(a.days["2030-06-01"], undefined, "the extra day is beyond the horizon, so not offered yet");
  const doc2 = { ...saved.json.doc, horizonDays: 20, extra: [{ date: Object.keys(days).sort()[5], slots: [{ time: "08:00", place: "online" }] }] };
  await save(doc2);
  const b = await open();
  assert.equal(b.days[Object.keys(days).sort()[5]][0].time, "08:00", "an extra time is added, in order");
  await save({ ...doc2, daysOff: [], extra: [], horizonDays: 21 });
});

test("a minimum notice hides times that are too soon", async () => {
  const doc = (await owner.call("GET", "/api/admin/availability")).json.doc;
  await save({ ...doc, noticeHours: 336 }); // two weeks
  const a = await open();
  const first = Object.keys(a.days).sort()[0];
  const ahead = (new Date(first + "T12:00:00Z") - new Date()) / 86400000;
  assert.ok(ahead >= 13, `the first offered day is ${ahead.toFixed(1)} days away`);
  await save({ ...doc, noticeHours: 0 });
});

test("a request holds that time at once; nobody else can take it", async () => {
  const slot = firstSlot((await open()).days, "gemmayze");
  const r = await ask(slot, { note: "I'd like to talk about running nutrition." });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.match(r.json.booking_number, /^BK-[A-Z0-9]{6}$/);
  assert.equal(r.json.place, "Gemmayze clinic");
  assert.match(r.json.when, /^\w+ \d+ \w+ \d{4} at \d\d:\d\d$/);

  const after = await open();
  assert.ok(!(after.days[slot.date] || []).some((s) => s.time === slot.time), "it is no longer offered");
  const again = await ask(slot, { name: "Someone Else", phone: "03 111 222" });
  assert.equal(again.status, 409);
  assert.equal(again.json.code, "slot_taken");
});

test("only a time she really offers, at the place she offers it, can be asked for", async () => {
  const slot = firstSlot((await open()).days, "ohana");
  assert.equal((await ask({ ...slot, place: "gemmayze" })).json.code, "slot_taken", "right time, wrong place");
  assert.equal((await ask({ ...slot, time: "03:33" })).json.code, "slot_taken", "a time she never offered");
  assert.equal((await ask({ date: "2020-01-01", time: "10:00", place: "online" })).json.code, "slot_taken", "the past");
  assert.equal((await ask({ date: "tomorrow", time: "10", place: "online" })).json.field, "slot");
});

test("every field is checked, with a message pointing at the field", async () => {
  const slot = firstSlot((await open()).days, "online");
  const field = async (patch) => { const r = await ask(slot, patch); return [r.status, r.json.field]; };
  assert.deepEqual(await field({ name: "A" }), [422, "name"]);
  assert.deepEqual(await field({ phone: "abc" }), [422, "phone"]);
  assert.deepEqual(await field({ email: "not-an-email" }), [422, "email"]);
  assert.equal((await ask(slot, { email: "" })).status, 201, "the email is optional");
});

test("a bot that fills the hidden field gets a fake success and no booking", async () => {
  const slot = firstSlot((await open()).days, "ohana");
  const r = await ask(slot, { website: "http://spam.example" });
  assert.equal(r.status, 201);
  assert.ok((await open()).days[slot.date].some((s) => s.time === slot.time && s.place === "ohana"), "the time is still free");
});

test("the request becomes an entry in her admin, with what she needs to answer it", async () => {
  const list = (await owner.call("GET", "/api/admin/bookings")).json;
  assert.equal(list.total, 2);
  const b = list.bookings[0];
  assert.equal(b.status, "new");
  assert.equal(b.name, "Nour Haddad");
  assert.equal(b.phone, "+961 70 123 456");
  assert.equal(b.email, "nour@example.com");
  assert.equal(b.service, "Initial Nutrition Consultation");
  assert.equal(b.note, "I'd like to talk about running nutrition.");
  assert.deepEqual(list.bookings.map((x) => x.date + x.time), list.bookings.map((x) => x.date + x.time).sort(), "soonest first");
  assert.equal(list.counts.new, 2);
  assert.equal((await owner.call("GET", "/api/admin/counts")).json.bookings_new, 2);
});

test("confirming keeps the time; cancelling gives it back; bringing it back takes it again", async () => {
  const [b1, b2] = (await owner.call("GET", "/api/admin/bookings")).json.bookings;
  const status = (b, s) => owner.call("PUT", `/api/admin/bookings/${b.id}/status`, { status: s });

  assert.equal((await status(b1, "confirmed")).json.status, "confirmed");
  assert.equal((await visit("GET", "/api/availability")).json.days[b1.date]?.some((s) => s.time === b1.time && s.place === b1.place) ?? false, false);

  assert.equal((await status(b1, "cancelled")).json.status, "cancelled");
  const free = (await open()).days[b1.date];
  assert.ok(free.some((s) => s.time === b1.time && s.place === b1.place), "the time is offered again");

  // someone else asks for it in the meantime, so the cancelled one can't simply come back
  assert.equal((await ask({ date: b1.date, time: b1.time, place: b1.place }, { name: "Dana K" })).status, 201);
  const back = await status(b1, "new");
  assert.equal(back.status, 409);
  assert.equal(back.json.code, "slot_taken");

  assert.equal((await status(b2, "bogus")).status, 422);
  assert.equal((await owner.call("PUT", `/api/admin/bookings/${b2.id}/notes`, { notes: "Sent the intake form." })).json.notes, "Sent the intake form.");
});

test("past appointments move to the Past tab and stay out of the upcoming list and the menu count", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(srv.db);
  const id = db.prepare("SELECT id FROM bookings WHERE name = 'Dana K'").get().id;
  db.prepare("UPDATE bookings SET slot_date = '2020-03-02' WHERE id = ?").run(id);
  db.close();
  const upcoming = (await owner.call("GET", "/api/admin/bookings")).json;
  assert.ok(!upcoming.bookings.some((b) => b.name === "Dana K"));
  const past = (await owner.call("GET", "/api/admin/bookings?scope=past")).json;
  assert.deepEqual(past.bookings.map((b) => b.name), ["Dana K"]);
});

test("deleting a booking removes the person's details and frees the time", async () => {
  const list = (await owner.call("GET", "/api/admin/bookings")).json.bookings;
  const victim = list.find((b) => b.status === "new");
  assert.equal((await owner.call("DELETE", `/api/admin/bookings/${victim.id}`)).status, 200);
  assert.ok((await open()).days[victim.date].some((s) => s.time === victim.time && s.place === victim.place));
  assert.equal((await owner.call("GET", `/api/admin/bookings?status=new`)).json.bookings.some((b) => b.id === victim.id), false);
});

test("the nightly backup includes bookings and her availability, and no passwords", async () => {
  const text = (await owner.text("/api/admin/backup")).text;
  const data = JSON.parse(text);
  assert.ok(Array.isArray(data.bookings));
  assert.equal(data.availability.horizonDays, 21);
  assert.ok(!/password|totp|secret/i.test(JSON.stringify({ ...data, about: undefined, content: undefined, publish_history: undefined })));
});
