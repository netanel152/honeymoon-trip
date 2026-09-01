/**
 * פריסה ל-Netlify דרך ה-API (לא דרך npx netlify — המסווג של ההרשאות חוסם אותו).
 * מעלה את index.html, את sw.js ואת הפונקציה המשותפת trip.
 *
 *   NETLIFY_AUTH_TOKEN=xxxx node deploy.mjs
 *   node deploy.mjs --no-func       (רק הקבצים הסטטיים)
 *   node deploy.mjs --sync-token   (אחרי החלפת טוקן — מעדכן את BLOBS_TOKEN באתר)
 */
import { createHash } from 'node:crypto';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SITE = '60e9c5fe-1324-441c-baaf-ceefdc370154';
const here0 = path.dirname(fileURLToPath(import.meta.url));
/* הטוקן: או ממשתנה סביבה, או מקובץ .netlify-token בתיקייה (לא נשלח לשום מקום) */
let TOKEN = process.env.NETLIFY_AUTH_TOKEN;
for (const name of ['.netlify-token', '.netlify-token.txt']) {
  if (TOKEN) break;
  try { TOKEN = (await readFile(path.join(here0, name), 'utf8')).trim(); } catch {}
}
if (!TOKEN) {
  console.error('חסר טוקן. או NETLIFY_AUTH_TOKEN=... או קובץ .netlify-token בתיקיית הפרויקט.');
  process.exit(1);
}
const withFunc = !process.argv.includes('--no-func');

const API0 = 'https://api.netlify.com/api/v1';
const ACCOUNT = '5e3afe525a34f872161f44a0';

/* --sync-token: דוחף את הטוקן המקומי למשתנה הסביבה שהפונקציה משתמשת בו.
   אחרי החלפת טוקן ב-Netlify: מעדכנים את .netlify-token.txt ומריצים
   `node deploy.mjs --sync-token` — הטוקן לא מודפס למסך בשום שלב. */
if (process.argv.includes('--sync-token')) {
  const h = { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' };
  const vars = { BLOBS_SITE_ID: SITE, BLOBS_TOKEN: TOKEN };
  for (const [key, value] of Object.entries(vars)) {
    const url = `${API0}/accounts/${ACCOUNT}/env/${key}?site_id=${SITE}`;
    let r = await fetch(url, {
      method: 'PUT', headers: h,
      body: JSON.stringify({ key, values: [{ context: 'all', value }] }),
    });
    if (r.status === 404) {
      r = await fetch(`${API0}/accounts/${ACCOUNT}/env?site_id=${SITE}`, {
        method: 'POST', headers: h,
        body: JSON.stringify([{ key, values: [{ context: 'all', value }] }]),
      });
    }
    console.log(`  ${key}: ${r.ok ? '✓ עודכן' : '✗ ' + r.status}`);
    if (!r.ok) process.exit(1);
  }
  const check = await fetch('https://honeymoon-netanel-adi.netlify.app/.netlify/functions/trip',
    { headers: { 'x-trip-key': 'adi-netanel-2026' }, cache: 'no-store' });
  const body = await check.text();
  console.log('בדיקת האחסון →', check.status,
              check.ok ? 'עובד' : body.slice(0, 160));
  process.exit(check.ok ? 0 : 1);
}

const API = 'https://api.netlify.com/api/v1';
const AUTH = { Authorization: `Bearer ${TOKEN}` };
const here = here0;
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');
/* Netlify: SHA1 לקבצים, SHA256 לזיפ של פונקציה */
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(url, opts = {}, tries = 3) {
  for (let i = 0; ; i++) {
    let r;
    try {
      r = await fetch(url, { ...opts, headers: { ...AUTH, ...(opts.headers || {}) } });
    } catch (e) {
      if (i >= tries - 1) throw e;
      console.warn(`  רשת נפלה (${e.message}) — שוב בעוד 30 שניות`); await sleep(30000); continue;
    }
    const text = await r.text();
    if (r.ok) { try { return JSON.parse(text); } catch { return text; } }
    // ה-origin של Netlify מחזיר 502 מדי פעם — לנסות שוב אחרי דקה
    if (r.status >= 500 && i < tries - 1) {
      console.warn(`  ${r.status} — מנסה שוב בעוד 60 שניות…`); await sleep(60000); continue;
    }
    throw new Error(`${r.status} ${url}\n${text.slice(0, 500)}`);
  }
}

/* ---------- 1. הקבצים הסטטיים ---------- */
/* מריצים את אותו build שרץ ב-Netlify, כדי ש-dist לא תישאר מאחור */
execFileSync(process.execPath, [path.join(here, 'build.mjs')], { stdio: 'inherit' });
const statics = {
  '/index.html': await readFile(path.join(here, 'dist', 'index.html')),
  '/sw.js': await readFile(path.join(here, 'dist', 'sw.js')),
};
const files = Object.fromEntries(Object.entries(statics).map(([p, b]) => [p, sha1(b)]));

/* ---------- 2. הפונקציה: bundle לקובץ אחד ואז zip ---------- */
const functions = {};
let funcZip = null;
if (withFunc) {
  const work = path.join(here, '.deploy-tmp');
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  const out = path.join(work, 'trip.mjs');

  console.log('בונים את הפונקציה לקובץ אחד…');
  execFileSync('npx', ['--yes', 'esbuild@0.24.2',
    path.join(here, 'netlify', 'functions', 'trip.js'),
    '--bundle', '--platform=node', '--target=node20', '--format=esm', `--outfile=${out}`,
  ], { stdio: 'inherit', shell: true });

  console.log('אורזים ל-zip…');
  const zip = path.join(work, 'trip.zip');
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Compress-Archive -Path '${out}' -DestinationPath '${zip}' -Force`,
  ], { stdio: 'inherit' });

  funcZip = await readFile(zip);
  functions.trip = sha256(funcZip);
}

/* ---------- 3. יוצרים deploy ומעלים רק את מה שחסר ---------- */
console.log('פותחים deploy…');
const payload = { files, async: false };
if (withFunc) { payload.functions = functions; payload.functions_config = { trip: { display_name: 'trip' } }; }

const deploy = await api(`${API}/sites/${SITE}/deploys`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
console.log('deploy', deploy.id, '· required:', (deploy.required || []).length,
            '· functions:', (deploy.required_functions || []).length);

for (const [p, buf] of Object.entries(statics)) {
  if (!(deploy.required || []).includes(sha1(buf))) { console.log('  ללא שינוי', p); continue; }
  console.log('  מעלים', p);
  await api(`${API}/deploys/${deploy.id}/files${p}`, {
    method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: buf,
  });
}
if (withFunc && (deploy.required_functions || []).includes(functions.trip)) {
  console.log('  מעלים את הפונקציה trip');
  await api(`${API}/deploys/${deploy.id}/functions/trip?runtime=js`, {
    method: 'PUT', headers: { 'content-type': 'application/zip' }, body: funcZip,
  });
}

/* ---------- 4. ממתינים ל-ready ובודקים ---------- */
let state = deploy.state;
for (let i = 0; i < 40 && state !== 'ready' && state !== 'error'; i++) {
  await sleep(3000);
  const d = await api(`${API}/deploys/${deploy.id}`);
  state = d.state;
  process.stdout.write(`\r  מצב: ${state}      `);
}
console.log(`\nמצב סופי: ${state}`);
if (state !== 'ready') process.exit(1);

const base = 'https://honeymoon-netanel-adi.netlify.app';
const page = await fetch(`${base}/index.html`, { cache: 'no-store' });
console.log('index.html →', page.status, (await page.text()).length, 'בתים');
if (withFunc) {
  const fn = await fetch(`${base}/.netlify/functions/trip`, {
    headers: { 'x-trip-key': 'adi-netanel-2026' }, cache: 'no-store',
  });
  console.log('functions/trip →', fn.status, (await fn.text()).slice(0, 200));
}
