// Imports what the production UGC Lab already made, read-only: the cast bank's
// faces, every take's still and clip, and the finished ads. Nothing is
// generated and nothing in production is written.
//
//   doppler run --project pepai --config prd_dashboard -- \
//     node scripts/import/import-ugc-lab.cjs
//
// Needs the backend dashboard checkout for firebase-admin (BACKEND_DASHBOARD,
// default ../backend-dashboard) and ffmpeg + sips for web-sized copies.
// Writes public/library/production/ and src/demo/production.json.

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const BD = process.env.BACKEND_DASHBOARD || path.resolve(ROOT, "../backend-dashboard");
const OUT = path.join(ROOT, "public", "library", "production");
const JSON_OUT = path.join(ROOT, "src", "demo", "production.json");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "castline-import-"));

const admin = require(path.join(BD, "node_modules/firebase-admin"));
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
});
const db = admin.firestore();
// Same resolution as backend dashboard lib/ad-studio/assets.js.
const bucketName =
  process.env.ADSTUDIO_STORAGE_BUCKET ||
  process.env.FIREBASE_STORAGE_BUCKET ||
  `${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`;
const bucket = admin.storage().bucket(bucketName);

/** Production type keys → the plural shown on the site. */
const TYPE_LABELS = {
  glp1mom: "GLP-1 moms",
  baddie: "Baddies",
  gymbro: "Looksmaxed gym bros",
};

async function download(id, filename) {
  const local = path.join(TMP, `${id}-${filename}`);
  await bucket.file(`adStudio/${id}/${filename}`).download({ destination: local });
  return local;
}

function mkdirFor(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

/** A JPEG no wider than `max`, for the web. */
function image(src, dest, max) {
  mkdirFor(dest);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "80", "-Z", String(max), src, "--out", dest], { stdio: "ignore" });
}

/** 720-wide H.264 with fast start; `audio` keeps the soundtrack. */
function video(src, dest, { audio }) {
  mkdirFor(dest);
  const args = ["-y", "-loglevel", "error", "-i", src, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
  args.push(...(audio ? ["-c:a", "aac", "-b:a", "96k"] : ["-an"]));
  execFileSync("ffmpeg", [...args, dest]);
}

function poster(src, dest) {
  mkdirFor(dest);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0.6", "-i", src, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "4", dest]);
}

function rel(file) {
  return path.relative(path.join(ROOT, "public"), file).split(path.sep).join("/");
}

/** "Camila Ortega · Baddie · Mid 20s" → name and age band. */
function parseLabel(label) {
  const parts = String(label || "").split("·").map((s) => s.trim());
  return { name: parts[0] || "Unnamed", ageBand: parts[parts.length - 1] || "" };
}

async function main() {
  const [castSnap, takeSnap, adSnap] = await Promise.all([
    db.collection("adStudioReactionCast").get(),
    db.collection("adStudioReactionTakes").get(),
    db.collection("adStudioReactionAds").get(),
  ]);

  const takes = takeSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => t.persona?.castId && (t.assets || []).some((a) => a.kind === "still"));
  const castIdsWithTakes = new Set(takes.map((t) => t.persona.castId));
  const cast = castSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => (c.status === "ready" || castIdsWithTakes.has(c.id)) && (c.assets || []).some((a) => a.filename === "face.png"));
  const castIds = new Set(cast.map((c) => c.id));
  const takeById = new Map(takes.map((t) => [t.id, t]));

  const out = { importedAt: new Date().toISOString(), typeLabels: TYPE_LABELS, cast: [], takes: [], ads: [] };

  for (const c of cast) {
    const face = path.join(OUT, "cast", `${c.id}.jpg`);
    if (!fs.existsSync(face)) image(await download(c.id, "face.png"), face, 720);
    const { name, ageBand } = parseLabel(c.label);
    out.cast.push({
      id: c.id,
      name,
      ageBand,
      gender: c.gender === "male" ? "male" : "female",
      type: c.persona?.type || null,
      face: rel(face),
      prompt: c.prompt || "",
    });
    console.log(`cast  ${name}`);
  }

  for (const t of takes) {
    if (!castIds.has(t.persona.castId)) continue;
    const stillAsset = t.assets.find((a) => a.kind === "still");
    const clipAsset = t.assets.find((a) => a.kind === "clip");
    const still = path.join(OUT, "stills", `${t.id}.jpg`);
    if (!fs.existsSync(still)) image(await download(t.id, stillAsset.filename), still, 960);
    let clip = null;
    if (clipAsset) {
      clip = path.join(OUT, "clips", `${t.id}.mp4`);
      if (!fs.existsSync(clip)) video(await download(t.id, clipAsset.filename), clip, { audio: false });
    }
    out.takes.push({
      id: t.id,
      castId: t.persona.castId,
      still: rel(still),
      clip: clip ? rel(clip) : null,
      durationSeconds: t.durationSeconds || null,
      persona: {
        adType: t.persona.adType || null,
        setting: t.persona.setting || null,
        wardrobe: t.persona.wardrobe || null,
        gesture: t.persona.gesture || null,
        lighting: t.persona.lighting || null,
      },
      stillPrompt: t.stillPrompt || "",
      motionPrompt: t.motionPrompt || "",
      createdAt: t.createdAt || null,
    });
    console.log(`take  ${t.id}${clip ? " + clip" : ""}`);
  }

  for (const d of adSnap.docs) {
    const a = { id: d.id, ...d.data() };
    const file = (a.assets || []).find((x) => x.kind === "ad" && x.filename);
    if (!file) continue;
    const take = takeById.get(a.takeId);
    const dest = path.join(OUT, "ads", `${a.id}.mp4`);
    const posterFile = path.join(OUT, "ads", `${a.id}.jpg`);
    if (!fs.existsSync(dest)) {
      const src = await download(a.id, file.filename);
      // Silent on purpose: the ads' music is from the Meta Sound Collection,
      // licensed for Meta placements, not for a public website.
      video(src, dest, { audio: false });
      poster(src, posterFile);
    }
    out.ads.push({
      id: a.id,
      takeId: a.takeId || null,
      castId: take?.persona?.castId || null,
      hook: a.hook || "",
      favorite: a.favorite === true,
      video: rel(dest),
      poster: rel(posterFile),
      durationMs: a.durationMs ?? file.durationMs ?? null,
      soundLabel: a.soundLabel || null,
      demoLabel: a.demoLabel || null,
      createdAt: a.createdAt || null,
    });
    console.log(`ad    ${a.id}${a.favorite ? " ★" : ""}`);
  }

  out.ads.sort((x, y) => Number(y.favorite) - Number(x.favorite) || String(y.createdAt).localeCompare(String(x.createdAt)));
  fs.writeFileSync(JSON_OUT, `${JSON.stringify(out, null, 2)}\n`);
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nImported ${out.cast.length} cast, ${out.takes.length} takes (${out.takes.filter((t) => t.clip).length} with clips), ${out.ads.length} finished ads.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
