/**
 * שלב הבנייה: מעתיק את הקבצים מהשורש אל dist/, שהיא תיקיית הפרסום.
 *
 * למה בכלל: בשורש יושבים גם ה-Word, האקסל וה-PDF-ים, ואסור שהם יתפרסמו לאתר.
 * לכן Netlify מפרסמת רק את dist/, והסקריפט הזה מוודא ש-dist מעודכנת.
 * ככה אפשר לערוך את index.html בשורש (גם מהנייד) ושהאתר יתעדכן.
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = ['index.html', 'sw.js'];

await mkdir(path.join(here, 'dist'), { recursive: true });

for (const name of FILES) {
  const src = path.join(here, name);
  const dst = path.join(here, 'dist', name);
  await copyFile(src, dst);
  const { size } = await stat(dst);
  if (size < 1000) throw new Error(`${name} יצא קטן מדי (${size} בתים) — משהו השתבש`);
  console.log(`  ✓ ${name} → dist/ (${size.toLocaleString('en-US')} בתים)`);
}

console.log('הבנייה הסתיימה.');
