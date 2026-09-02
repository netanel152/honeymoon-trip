/**
 * שלב הבנייה: מעתיק את הקבצים מהשורש אל dist/, שהיא תיקיית הפרסום.
 *
 * למה בכלל: בשורש יושבים גם ה-Word, האקסל וה-PDF-ים, ואסור שהם יתפרסמו לאתר.
 * לכן Netlify מפרסמת רק את dist/, והסקריפט הזה מוודא ש-dist מעודכנת.
 * ככה אפשר לערוך את index.html בשורש (גם מהנייד) ושהאתר יתעדכן.
 */
import { copyFile, mkdir, stat, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = ['index.html', 'sw.js', 'manifest.webmanifest',
               'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
/* קבצים שקטנים מ-1000 בתים הם תקינים (manifest), אז סף הגודל נבדק רק ל-HTML */
const BIG = new Set(['index.html', 'sw.js']);

await mkdir(path.join(here, 'dist'), { recursive: true });

for (const name of FILES) {
  const src = path.join(here, name);
  const dst = path.join(here, 'dist', name);
  await copyFile(src, dst);
  const { size } = await stat(dst);
  if (BIG.has(name) && size < 1000) throw new Error(`${name} יצא קטן מדי (${size} בתים) — משהו השתבש`);
  if (size === 0) throw new Error(`${name} יצא ריק — משהו השתבש`);
  console.log(`  ✓ ${name} → dist/ (${size.toLocaleString('en-US')} בתים)`);
}

/* חותמים את גרסת ה-Service Worker בטביעת אצבע של תוכן הדף.
   בלי זה, שינוי ב-index.html בלבד לא מייצר sw.js חדש, הדפדפן לא מזהה עדכון,
   והמשתמש לא רואה את הבאנר "יש גרסה חדשה" — הוא רק מקבל את התוכן החדש
   ברענון השני, וזה בדיוק מה שרצינו למנוע. */
const htmlBody = await readFile(path.join(here, 'index.html'));
const stamp = createHash('sha1').update(htmlBody).digest('hex').slice(0, 10);
const swPath = path.join(here, 'dist', 'sw.js');
const swSrc = await readFile(swPath, 'utf8');
const stamped = swSrc.replace(/const VERSION\s*=\s*'[^']+';/, `const VERSION   = 'hm-${stamp}';`);
if (stamped === swSrc) throw new Error('לא הצלחנו לחתום את גרסת ה-Service Worker — בדקו את התבנית');
await writeFile(swPath, stamped);
console.log(`  ✓ גרסת ה-Service Worker: hm-${stamp}`);

console.log('הבנייה הסתיימה.');
