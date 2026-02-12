const fs = require('fs/promises');
const path = require('path');

function loadPuppeteer() {
  try {
    // eslint-disable-next-line global-require
    return require('puppeteer');
  } catch (_err) {
    // continue
  }

  // Monorepo-friendly fallback: try resolving from common sub-project roots.
  // This file now lives at: orgit-web/utils/generatePdf.js
  const candidateRoots = [
    process.cwd(),
    path.resolve(process.cwd(), 'orgit-api'),
    // running from orgit-web
    path.resolve(process.cwd(), '..', 'orgit-api'),
    // relative to this file
    path.resolve(__dirname, '..', '..', 'orgit-api'),
    path.resolve(__dirname, '..', '..'),
  ];

  for (const root of candidateRoots) {
    try {
      // eslint-disable-next-line global-require
      const resolved = require.resolve('puppeteer', { paths: [root] });
      // eslint-disable-next-line global-require, import/no-dynamic-require
      return require(resolved);
    } catch (_err) {
      // continue
    }
  }

  return null;
}

const puppeteer = loadPuppeteer();

const DEFAULT_A4_VIEWPORT = { width: 794, height: 1123, deviceScaleFactor: 1 };
const DEFAULT_PDF_OPTIONS = {
  format: 'A4',
  printBackground: true,
  margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
};

const TRANSPARENT_LOGO_DATA_URI =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="100%" height="100%" fill="white"/></svg>'
  );

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatINR(amount, { minimumFractionDigits = 2, maximumFractionDigits = 2 } = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits, maximumFractionDigits }).format(n);
}

function mimeTypeFromExtension(ext) {
  const e = String(ext || '').toLowerCase();
  if (e === '.png') return 'image/png';
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.webp') return 'image/webp';
  if (e === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

/**
 * Convert a local image file to a data URL (for logos/QR without network access).
 */
async function fileToDataUri(filePath, { mimeType } = {}) {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const buf = await fs.readFile(abs);
  const mt = mimeType || mimeTypeFromExtension(path.extname(abs));
  return `data:${mt};base64,${buf.toString('base64')}`;
}

function bufferToDataUri(buffer, mimeType) {
  if (!buffer) throw new Error('buffer is required');
  const mt = mimeType || 'application/octet-stream';
  return `data:${mt};base64,${Buffer.from(buffer).toString('base64')}`;
}

/**
 * Render a {{placeholder}} template using a plain object.
 *
 * - Escapes HTML for all keys by default (XSS-safe).
 * - Use `rawKeys` for keys that contain HTML (e.g. table row strings).
 * - Unresolved placeholders are either removed or error'ed based on `missing`.
 */
function renderTemplate(templateHtml, data, options = {}) {
  const {
    rawKeys = [],
    defaults = {},
    missing = 'empty', // 'empty' | 'error' | 'keep'
  } = options;

  const merged = { ...defaults, ...(data || {}) };
  let out = String(templateHtml);

  for (const [key, val] of Object.entries(merged)) {
    const re = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'g');
    const strVal = val == null ? '' : String(val);
    const replacement = rawKeys.includes(key) ? strVal : escapeHtml(strVal);
    out = out.replace(re, replacement);
  }

  const leftoverRe = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  const leftovers = new Set();
  let match;
  // eslint-disable-next-line no-cond-assign
  while ((match = leftoverRe.exec(out)) !== null) leftovers.add(match[1]);

  if (leftovers.size > 0) {
    if (missing === 'error') {
      throw new Error(`Missing placeholders: ${Array.from(leftovers).sort().join(', ')}`);
    }
    if (missing === 'empty') {
      out = out.replace(leftoverRe, '');
    }
  }

  return out;
}

/**
 * Generate rows for Payment Voucher "Expense Details" table.
 *
 * Expected item shape:
 * { particulars: string, ledgerAccount: string, amount: number|string }
 */
function generateExpenseRows(items) {
  const safeItems = Array.isArray(items) ? items : [];
  if (safeItems.length === 0) {
    return [
      '<tr>',
      '<td class="w-sn">1</td>',
      '<td>&nbsp;</td>',
      '<td>&nbsp;</td>',
      '<td class="w-amt">0.00</td>',
      '</tr>',
    ].join('');
  }

  return safeItems
    .map((item, idx) => {
      const particulars = escapeHtml(item?.particulars ?? '');
      const ledger = escapeHtml(item?.ledgerAccount ?? '');
      const amount = formatINR(item?.amount);
      return [
        '<tr>',
        `<td class="w-sn">${idx + 1}</td>`,
        `<td>${particulars || '&nbsp;'}</td>`,
        `<td>${ledger || '&nbsp;'}</td>`,
        `<td class="w-amt">${amount || '&nbsp;'}</td>`,
        '</tr>',
      ].join('');
    })
    .join('');
}

/**
 * Generate rows for Tax Invoice "Items" table.
 *
 * Expected item shape:
 * {
 *   item: string,
 *   hsn: string,
 *   rate: number|string,
 *   qty: number|string,
 *   taxableValue?: number|string,
 *   taxAmount?: number|string,
 *   taxRate?: number|string,
 *   amount?: number|string,
 *   details?: string[]  // rendered as small lines under item name
 * }
 */
function generateItemRows(items) {
  const safeItems = Array.isArray(items) ? items : [];
  if (safeItems.length === 0) {
    return [
      '<tr>',
      '<td class="col-idx">1</td>',
      '<td>&nbsp;</td>',
      '<td class="col-hsn">&nbsp;</td>',
      '<td class="col-rate">0.00</td>',
      '<td class="col-qty">0</td>',
      '<td class="col-taxable">0.00</td>',
      '<td class="col-tax">0.00</td>',
      '<td class="col-amount">0.00</td>',
      '</tr>',
    ].join('');
  }

  return safeItems
    .map((item, idx) => {
      const name = escapeHtml(item?.item ?? '');
      const hsn = escapeHtml(item?.hsn ?? '');
      const details = Array.isArray(item?.details) ? item.details : [];
      const detailsHtml = details
        .filter(v => v != null && String(v).trim().length > 0)
        .map(v => `<p class="item-meta">${escapeHtml(String(v))}</p>`)
        .join('');

      const rateN = Number(item?.rate ?? 0);
      const qtyN = Number(item?.qty ?? 0);
      const taxableN =
        item?.taxableValue != null ? Number(item.taxableValue) : (Number.isFinite(rateN) ? rateN : 0) * (Number.isFinite(qtyN) ? qtyN : 0);
      const taxN = item?.taxAmount != null ? Number(item.taxAmount) : 0;
      const taxRate = item?.taxRate != null ? String(item.taxRate) : '';
      const amtN = item?.amount != null ? Number(item.amount) : taxableN + taxN;

      const itemCell = [
        '<div>',
        `<p class="item-name">${name || '&nbsp;'}</p>`,
        detailsHtml || '',
        '</div>',
      ].join('');

      const taxCell = [
        '<div>',
        `<div>${formatINR(taxN) || '&nbsp;'}</div>`,
        taxRate ? `<div class="tax-rate">(${escapeHtml(taxRate)})</div>` : '',
        '</div>',
      ].join('');

      return [
        '<tr>',
        `<td class="col-idx">${idx + 1}</td>`,
        `<td>${itemCell}</td>`,
        `<td class="col-hsn">${hsn || '&nbsp;'}</td>`,
        `<td class="col-rate">${formatINR(rateN) || '&nbsp;'}</td>`,
        `<td class="col-qty">${Number.isFinite(qtyN) ? escapeHtml(String(qtyN)) : '&nbsp;'}</td>`,
        `<td class="col-taxable">${formatINR(taxableN) || '&nbsp;'}</td>`,
        `<td class="col-tax">${taxCell}</td>`,
        `<td class="col-amount">${formatINR(amtN) || '&nbsp;'}</td>`,
        '</tr>',
      ].join('');
    })
    .join('');
}

function generateFillerRows({ columns = 8, heightPx = 220 } = {}) {
  const cols = Math.max(1, Number(columns) || 8);
  const height = Math.max(0, Number(heightPx) || 0);
  const tds = Array.from({ length: cols }, () => '<td>&nbsp;</td>').join('');
  // Height is applied to <tr> (not inline styles elsewhere).
  return `<tr style="height:${height}px">${tds}</tr>`;
}

function generateTermsRows(terms) {
  const safe = Array.isArray(terms) ? terms : [];
  return safe
    .filter(t => t != null && String(t).trim().length > 0)
    .map(t => `<li>${escapeHtml(String(t))}</li>`)
    .join('');
}

async function readHtmlTemplate(templatePath) {
  const abs = path.isAbsolute(templatePath) ? templatePath : path.resolve(process.cwd(), templatePath);
  const raw = await fs.readFile(abs, 'utf8');
  // Defensive: if multiple HTML docs are concatenated, keep the first.
  const lower = raw.toLowerCase();
  const endIdx = lower.indexOf('</html>');
  if (endIdx !== -1) return raw.slice(0, endIdx + '</html>'.length);
  return raw;
}

/**
 * Generate a PDF buffer from an HTML string using Puppeteer.
 */
async function generatePdfFromHtml(html, options = {}) {
  const {
    pdfOptions = {},
    viewport = DEFAULT_A4_VIEWPORT,
    launchOptions = {},
    setContentOptions = { waitUntil: ['domcontentloaded', 'networkidle2'] },
  } = options;

  if (!puppeteer) {
    throw new Error(
      "Puppeteer is not installed. Install it (e.g. 'npm i puppeteer') in the project where you run this script."
    );
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...launchOptions,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.setContent(String(html), setContentOptions);

    const buffer = await page.pdf({
      ...DEFAULT_PDF_OPTIONS,
      ...pdfOptions,
      margin: { ...DEFAULT_PDF_OPTIONS.margin, ...(pdfOptions.margin || {}) },
    });
    return buffer;
  } finally {
    await browser.close();
  }
}

/**
 * Generate PDF from a template file.
 *
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePdfFromTemplate(params) {
  const {
    templatePath,
    data = {},
    outputPath,
    rawKeys = ['expense_rows', 'item_rows', 'journal_rows', 'qr_code', 'filler_rows', 'terms_rows'],
    missing = 'empty',
    defaults = {
      company_logo: TRANSPARENT_LOGO_DATA_URI,
      invoice_copy_label: 'ORIGINAL FOR RECIPIENT',
      filler_rows: '',
      terms_rows: '',
      qr_code: '',
    },
    pdfOptions,
    launchOptions,
    viewport,
  } = params || {};

  if (!templatePath) throw new Error('templatePath is required');

  const templateHtml = await readHtmlTemplate(templatePath);
  const normalizedData = { ...(data || {}) };
  // If caller passes blank logo, fall back to default placeholder.
  if (typeof normalizedData.company_logo === 'string' && normalizedData.company_logo.trim() === '') {
    delete normalizedData.company_logo;
  }
  const html = renderTemplate(templateHtml, normalizedData, { rawKeys, defaults, missing });
  const pdfBuffer = await generatePdfFromHtml(html, { pdfOptions, launchOptions, viewport });

  if (outputPath) {
    const absOut = path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath);
    await fs.mkdir(path.dirname(absOut), { recursive: true });
    await fs.writeFile(absOut, pdfBuffer);
  }

  return pdfBuffer;
}

module.exports = {
  DEFAULT_PDF_OPTIONS,
  escapeHtml,
  formatINR,
  bufferToDataUri,
  fileToDataUri,
  generateExpenseRows,
  generateItemRows,
  generateFillerRows,
  generateTermsRows,
  generatePdfFromHtml,
  generatePdfFromTemplate,
  readHtmlTemplate,
  renderTemplate,
};

