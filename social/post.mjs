// The posting robot (runs daily on GitHub Actions, see .github/workflows/social.yml).
// Sends the next posts from social/queue.json to Buffer, which publishes them to
// Skuzi's Instagram at the scheduled time. Buffer's free plan holds 10 queued
// posts per channel, so only the next 3 days are sent at a time.
// Videos are served by the website (client/public/social/*.mp4) because Buffer
// downloads them from a public link. Needs the BUFFER_API_KEY secret.
// Remembers what was already sent in social/sent.json (committed back by the workflow).
// Adapted from the Budg posting robot.
import fs from "node:fs";

const KEY = process.env.BUFFER_API_KEY;
const SITE = (process.env.SITE_URL ?? "https://tabpro.lol").replace(/\/$/, "");
const DAYS_AHEAD = 3;
if (!KEY) { console.error("Missing BUFFER_API_KEY"); process.exit(1); }

async function gql(query, variables = {}) {
  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) throw new Error(`Buffer API ${res.status}: ${JSON.stringify(body.errors ?? body)}`);
  return body.data;
}

/** createPost, retried when Buffer can't fetch the video yet (happens right after a new deploy). */
async function createPost(input) {
  for (let attempt = 1; ; attempt++) {
    const data = await gql(`mutation($input: CreatePostInput!) {
      createPost(input: $input) { ... on PostActionSuccess { post { id } } ... on MutationError { message } }
    }`, { input });
    const r = data.createPost;
    if (r?.post?.id || attempt >= 4 || !/could not be read|fetch|download/i.test(r?.message ?? "")) return r;
    console.log(`… Buffer couldn't read the video yet, retrying in 60 s (attempt ${attempt})`);
    await new Promise((res) => setTimeout(res, 60000));
  }
}

/** Wait until this exact video is live on the website (a fresh deploy can take a few minutes). */
async function waitForVideo(url, size) {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (r?.ok && /video/.test(r.headers.get("content-type") ?? "") && Number(r.headers.get("content-length")) === size) return true;
    await new Promise((res) => setTimeout(res, 15000));
  }
  return false;
}

/** A post's fingerprint: its caption and its video file, so changing either re-queues it. */
function fingerprint(post) {
  const file = "client/public" + post.video;
  const bytes = fs.existsSync(file) ? fs.readFileSync(file) : Buffer.alloc(0);
  let v = 7; for (let i = 0; i < bytes.length; i += 997) v = (v * 31 + bytes[i]) >>> 0;
  v = (v * 31 + bytes.length) >>> 0;
  const c = [...post.caption].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) >>> 0, 7);
  return { h: c.toString(36) + "." + v.toString(36), v: v.toString(36), size: bytes.length };
}

const queue = JSON.parse(fs.readFileSync("social/queue.json", "utf8"));
const sent = fs.existsSync("social/sent.json") ? JSON.parse(fs.readFileSync("social/sent.json", "utf8")) : {};

const { account } = await gql(`query { account { organizations { id name } } }`);
const channels = [];
for (const org of account.organizations) {
  const { channels: list } = await gql(`query($id: OrganizationId!) { channels(input: { organizationId: $id }) { id name service } }`, { id: org.id });
  channels.push(...list.filter((c) => c.service === "instagram"));
}
console.log("Channels:", channels.map((c) => `${c.service}:${c.name}`).join(", ") || "none");
if (!channels.length) { console.error("✗ No Instagram channel connected in Buffer yet"); process.exit(1); }

const now = Date.now(), until = now + DAYS_AHEAD * 86400000;

// Paused (social/paused.json exists): take every waiting post out of Buffer and
// send nothing. To resume: delete social/paused.json and move the dates in queue.json.
if (fs.existsSync("social/paused.json")) {
  for (const [key, s] of Object.entries(sent)) {
    if (Date.parse(s.at) <= now) continue;
    try {
      const d = await gql(`mutation($input: DeletePostInput!) { deletePost(input: $input) { ... on DeletePostSuccess { id } ... on VoidMutationError { message } } }`, { input: { id: s.bufferId } });
      if (d.deletePost?.id) { delete sent[key]; console.log(`⏸ ${key} taken out of Buffer (paused)`); }
    } catch (e) { console.error(`✗ couldn't remove ${key}: ${e.message}`); }
  }
  fs.writeFileSync("social/sent.json", JSON.stringify(sent, null, 2) + "\n");
  console.log("Paused: nothing will be posted.");
  process.exit(0);
}

// Posts taken out of the plan, or whose time, caption or video changed: take them
// out of Buffer if they haven't gone out yet (changed ones are re-queued below).
const plan = new Map(queue.map((q) => [q.id, q]));
for (const [key, s] of Object.entries(sent)) {
  const q = plan.get(key.split(":")[0]);
  const changed = !q || q.at !== s.at || fingerprint(q).h !== s.h;
  if (!changed || Date.parse(s.at) <= now + 10 * 60000) continue;
  try {
    const d = await gql(`mutation($input: DeletePostInput!) { deletePost(input: $input) { ... on DeletePostSuccess { id } ... on VoidMutationError { message } } }`, { input: { id: s.bufferId } });
    if (d.deletePost?.id) { delete sent[key]; console.log(q ? `↻ ${key} changed, re-queueing` : `🗑 ${key} removed from Buffer`); }
  } catch (e) { console.error(`✗ couldn't update ${key}: ${e.message}`); }
}

const due = queue.filter((q) => { const t = Date.parse(q.at); return t > now + 10 * 60000 && t <= until; });
let failures = 0;
for (const post of due) {
  const fp = fingerprint(post);
  const url = `${SITE}${post.video}?v=${fp.v}`;
  if (!(await waitForVideo(url, fp.size))) { console.error(`✗ ${post.id}: video not live yet at ${url}`); failures++; continue; }
  for (const ch of channels) {
    const key = `${post.id}:${ch.service}`;
    if (sent[key]) continue;
    try {
      const r = await createPost({
        channelId: ch.id, text: post.caption, schedulingType: "automatic", mode: "customScheduled", dueAt: post.at,
        assets: [{ video: { url, metadata: { thumbnailOffset: 1500 } } }],
        metadata: { instagram: { type: "reel", shouldShareToFeed: true } },
      });
      if (r?.post?.id) { sent[key] = { bufferId: r.post.id, at: post.at, h: fp.h }; console.log(`✓ ${key} → ${post.at}`); }
      else { console.error(`✗ ${key}: ${r?.message ?? JSON.stringify(r)}`); failures++; }
    } catch (e) { console.error(`✗ ${key}: ${e.message}`); failures++; }
  }
}
fs.writeFileSync("social/sent.json", JSON.stringify(sent, null, 2) + "\n");
console.log(`Done. ${due.length} post(s) due in the next ${DAYS_AHEAD} days, ${failures} failure(s).`);
if (failures) process.exit(1);
