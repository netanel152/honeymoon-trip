/**
 * מסמך משותף אחד לעדי ולנתנאל — התזכורות, ההערות, המקומות והסימונים שהוספתם.
 * נשמר ב-Netlify Blobs (כלול בחשבון החינמי) ומוזג לפי חותמת זמן לכל פריט,
 * כך ששני מכשירים שעורכים במקביל לא דורסים זה את זה.
 *
 * כתוב בסגנון handler הקלאסי כדי שאפשר יהיה לפרוס אותו כ-zip דרך ה-API,
 * בלי צינור בנייה של Netlify.
 */
import { getStore } from '@netlify/blobs';

const TRIP_KEY = 'adi-netanel-2026';
const STORE = 'honeymoon';
const DOC = 'trip';
const SECTIONS = ['rem', 'notes', 'places', 'items', 'ticks', 'costs', 'spend'];
const MAX_BYTES = 512 * 1024;

const reply = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

function normalise(doc) {
  const out = { v: 1, updated: Number(doc && doc.updated) || 0 };
  for (const s of SECTIONS) {
    out[s] = {};
    const src = doc && doc[s];
    if (src && typeof src === 'object') {
      for (const [k, v] of Object.entries(src)) {
        if (v && typeof v === 'object') out[s][k] = v;
      }
    }
  }
  return out;
}

/* הפריט עם חותמת הזמן החדשה יותר מנצח — לכל פריט בנפרד, לא לכל המסמך */
function merge(base, incoming) {
  const out = normalise(base);
  const inc = normalise(incoming);
  for (const s of SECTIONS) {
    for (const [k, theirs] of Object.entries(inc[s])) {
      const mine = out[s][k];
      if (!mine || (Number(theirs.ts) || 0) > (Number(mine.ts) || 0)) out[s][k] = theirs;
    }
  }
  out.updated = Date.now();
  return out;
}

export async function handler(event) {
  const headers = event.headers || {};
  const key = headers['x-trip-key'] || headers['X-Trip-Key'];
  if (key !== TRIP_KEY) return reply(401, { error: 'unauthorized' });

  /* הפונקציה נפרסת כ-zip דרך ה-API, אז Netlify לא מזריק את הקונטקסט של Blobs —
     מגדירים אותו ידנית ממשתני הסביבה של האתר. */
  let store;
  try {
    const siteID = process.env.BLOBS_SITE_ID || process.env.SITE_ID;
    const token = process.env.BLOBS_TOKEN;
    store = (siteID && token)
      ? getStore({ name: STORE, siteID, token, consistency: 'strong' })
      : getStore({ name: STORE, consistency: 'strong' });
  } catch (e) {
    return reply(500, { error: 'blobs unavailable', detail: String(e && e.message) });
  }

  const method = (event.httpMethod || 'GET').toUpperCase();

  if (method === 'GET') {
    const doc = await store.get(DOC, { type: 'json' });
    return reply(200, { ok: true, data: normalise(doc) });
  }

  if (method === 'PUT' || method === 'POST') {
    const raw = event.body || '';
    if (raw.length > MAX_BYTES) return reply(413, { error: 'too large' });
    let body;
    try { body = JSON.parse(raw); } catch (e) { return reply(400, { error: 'bad json' }); }
    if (!body || !body.data || typeof body.data !== 'object') return reply(400, { error: 'no data' });

    const current = await store.get(DOC, { type: 'json' });
    const merged = merge(current, body.data);
    await store.setJSON(DOC, merged);
    return reply(200, { ok: true, data: merged });
  }

  return reply(405, { error: 'method not allowed' });
}
