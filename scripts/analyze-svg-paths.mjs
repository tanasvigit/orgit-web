import fs from 'fs';
import path from 'path';

const file = process.argv[2];
const svg = fs.readFileSync(file, 'utf8');
const paths = [...svg.matchAll(/<path\s+([^>]+)\/>/g)].map((m) => m[1]);

function parseTransform(t) {
  if (!t) return { x: 0, y: 0 };
  const m = t.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
  return m ? { x: +m[1], y: +m[2] } : { x: 0, y: 0 };
}

const rows = paths.map((attrs) => {
  const d = attrs.match(/d="([^"]*)"/)?.[1] ?? '';
  const fill = attrs.match(/fill="([^"]*)"/)?.[1] ?? '';
  const transform = attrs.match(/transform="([^"]*)"/)?.[1];
  const { x, y } = parseTransform(transform);
  return { dLen: d.length, fill, x, y };
});

const dark = rows.filter((r) => /^#0[0-3]/.test(r.fill) && r.fill !== 'none');
console.log(file, 'paths', rows.length, 'dark', dark.length);
const xs = dark.map((r) => r.x);
const ys = dark.map((r) => r.y);
console.log(
  'dark transform range x',
  Math.min(...xs),
  '-',
  Math.max(...xs),
  'y',
  Math.min(...ys),
  '-',
  Math.max(...ys)
);
console.log(
  'dark dLen',
  Math.min(...dark.map((r) => r.dLen)),
  '-',
  Math.max(...dark.map((r) => r.dLen)),
  'median',
  dark.map((r) => r.dLen).sort((a, b) => a - b)[Math.floor(dark.length / 2)]
);
