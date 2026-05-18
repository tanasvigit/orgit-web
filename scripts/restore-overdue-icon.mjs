/**
 * Restores overdue.svg from the design source and applies only safe cleanup:
 * - remove full-canvas white background path
 * - ensure viewBox for consistent scaling
 * Do NOT strip dark paths (that destroyed the stopwatch artwork).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || '', 'Downloads', 'overdue.svg');
const outWeb = path.join(__dirname, '../assets/overdue.svg');
const outMobile = path.join(
  __dirname,
  '../../../orgit-mobile/orgit-mobile/assets/icons/overdue.svg'
);

let svg = fs.readFileSync(source, 'utf8');

// Drop only the full 1254×1254 white plate (not inner icon highlights).
svg = svg.replace(
  /<path d="M0 0 C413\.82 0 827\.64 0 1254 0[\s\S]*?fill="#FDFDFD" transform="translate\(0,0\)"\/>/,
  ''
);

if (!/viewBox=/.test(svg)) {
  svg = svg.replace(
    /<svg([^>]*)\s+width="1254"\s+height="1254">/,
    '<svg$1 width="1254" height="1254" viewBox="0 0 1254 1254">'
  );
}

fs.writeFileSync(outWeb, svg);
if (fs.existsSync(path.dirname(outMobile))) {
  fs.writeFileSync(outMobile, svg);
}

console.log('Restored', outWeb, `(${(fs.statSync(outWeb).size / 1024).toFixed(1)} KB)`);
