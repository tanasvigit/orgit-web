import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const css = fs.readFileSync(path.join(root, 'src/system-templates/gst-invoice-figma.css'), 'utf8');
const d = JSON.parse(fs.readFileSync(path.join(root, 'src/system-templates/gst-invoice-figma.sample.json'), 'utf8'));

const nl = (s) => String(s || '').replace(/\n/g, '<br/>');

const items = (d.item_rows || [])
  .map(
    (r) => `<tr>
      <td class="gst-inv-col-desc"><p class="gst-inv-item-name">${r.description}</p></td>
      <td class="gst-inv-col-hsn">${r.hsn}</td>
      <td class="gst-inv-col-rate">${r.rate}</td>
      <td class="gst-inv-col-qty">${r.qty}</td>
      <td class="gst-inv-col-taxable">${r.taxable_value}</td>
      <td class="gst-inv-col-cgst"><div class="gst-inv-tax-pct">${r.cgst_rate}</div><div class="gst-inv-tax-amt">${r.cgst}</div></td>
      <td class="gst-inv-col-sgst"><div class="gst-inv-tax-pct">${r.sgst_rate}</div><div class="gst-inv-tax-amt">${r.sgst}</div></td>
      <td class="gst-inv-col-amount">${r.amount}</td>
    </tr>`
  )
  .join('');

const gstRows = (d.gst_summary_rows || [])
  .map(
    (r) => `<tr>
      <td>${r.hsn}</td><td>${r.rate}</td><td>${r.integrated_tax_amount}</td>
      <td>${r.central_tax_amount}</td><td>${r.state_tax_amount}</td><td>${r.total_tax_amount}</td>
    </tr>`
  )
  .join('');

const terms = (d.terms_rows || []).map((t) => `<li>${t.text}</li>`).join('');

const body = `<div class="gst-inv-root"><div class="gst-inv-page">
  <table class="gst-inv-grid gst-inv-header-block"><tr>
    <td class="gst-inv-company-cell">
      <div class="gst-inv-brand-row"><div class="gst-inv-brand-name">${d.company_name}</div></div>
      <div class="gst-inv-company-address gst-inv-preline">${nl(d.company_address)}</div>
      <div class="gst-inv-company-meta">GSTIN/UIN: <span class="gst-inv-strong">${d.company_gstin}</span></div>
      <div class="gst-inv-company-meta">PAN: <span class="gst-inv-strong">${d.company_pan}</span></div>
      <div class="gst-inv-company-meta">CIN: <span class="gst-inv-strong">${d.company_cin}</span></div>
      <div class="gst-inv-company-meta">Email: <span class="gst-inv-strong">${d.company_email}</span></div>
    </td>
    <td class="gst-inv-invoice-cell">
      <div class="gst-inv-invoice-title">TAX INVOICE</div>
      <table class="gst-inv-invoice-meta">
        <tr><td class="k">Invoice #</td><td class="v">${d.invoice_number}</td></tr>
        <tr><td class="k">Invoice Date</td><td class="v">${d.invoice_date}</td></tr>
        <tr><td class="k">Mode of Supply</td><td class="v">${d.mode_of_supply}</td></tr>
        <tr><td class="k">Place of Supply</td><td class="v">${d.place_of_supply}</td></tr>
        <tr><td class="k">Date of Supply</td><td class="v">${d.date_of_supply}</td></tr>
      </table>
      <div class="gst-inv-copy-label">${d.invoice_copy_label}</div>
    </td>
  </tr></table>
  <table class="gst-inv-grid"><tr>
    <td class="gst-inv-addr-cell"><div class="gst-inv-addr-title">Billing Address</div><div class="gst-inv-addr-body gst-inv-preline">${d.billing_customer_name}<br/>${nl(d.billing_address)}</div></td>
    <td class="gst-inv-addr-cell"><div class="gst-inv-addr-title">Shipping Address</div><div class="gst-inv-addr-body gst-inv-preline">${d.shipping_customer_name}<br/>${nl(d.shipping_address)}</div></td>
  </tr></table>
  <table class="gst-inv-items-table">
    <thead>
      <tr>
        <th class="gst-inv-col-desc" rowspan="2">Description</th>
        <th class="gst-inv-col-hsn" rowspan="2">HSN/SAC</th>
        <th class="gst-inv-col-rate" rowspan="2">Rate (Rs.)</th>
        <th class="gst-inv-col-qty" rowspan="2">Qty</th>
        <th class="gst-inv-col-taxable" rowspan="2">Taxable Value</th>
        <th class="gst-inv-col-tax-group" colspan="2">Tax Amount</th>
        <th class="gst-inv-col-amount" rowspan="2">Amount</th>
      </tr>
      <tr><th class="gst-inv-col-cgst">CGST</th><th class="gst-inv-col-sgst">SGST</th></tr>
    </thead>
    <tbody>${items}</tbody>
    <tfoot>
      <tr class="gst-inv-tfoot-row"><td colspan="5" class="gst-inv-tfoot-spacer"></td><td colspan="2" class="gst-inv-tfoot-label">Total Taxable Value</td><td class="gst-inv-tfoot-val">${d.total_taxable_value}</td></tr>
      <tr class="gst-inv-tfoot-row"><td colspan="5" class="gst-inv-tfoot-spacer"></td><td colspan="2" class="gst-inv-tfoot-label">Total Tax</td><td class="gst-inv-tfoot-val">${d.total_tax}</td></tr>
      <tr class="gst-inv-tfoot-row gst-inv-tfoot-grand"><td colspan="5" class="gst-inv-tfoot-spacer"></td><td colspan="2" class="gst-inv-tfoot-label">Total Amount after Tax</td><td class="gst-inv-tfoot-val gst-inv-grand-val">₹ ${d.grand_total}</td></tr>
    </tfoot>
  </table>
  <div class="gst-inv-amount-words">Total amount (in words): <span class="gst-inv-strong">${d.amount_in_words}</span></div>
  <table class="gst-inv-gst-table">
    <thead><tr>
      <th>HSN/SAC</th><th>Rate</th><th>Integrated Tax Amount</th><th>Central Tax Amount</th><th>State/UT Tax Amount</th><th>Total Tax Amount</th>
    </tr></thead>
    <tbody>
      ${gstRows}
      <tr class="gst-inv-gst-total-row"><td colspan="2" class="gst-inv-strong">TOTAL</td><td>${d.gst_summary_integrated_total}</td><td>${d.gst_summary_central_total}</td><td>${d.gst_summary_state_total}</td><td>${d.gst_summary_tax_total}</td></tr>
      <tr class="gst-inv-gst-rc-row"><td colspan="5" class="gst-inv-gst-rc-label">GST Payable on Reverse Charge</td><td>${d.gst_payable_reverse_charge}</td></tr>
    </tbody>
  </table>
  <table class="gst-inv-grid gst-inv-bottom-3col"><tr>
    <td class="gst-inv-bank-cell">
      <div class="gst-inv-section-title">Bank Details</div>
      <div class="gst-inv-bank-line"><span class="k">Bank</span><span class="v">${d.bank_name}</span></div>
      <div class="gst-inv-bank-line"><span class="k">Account #</span><span class="v">${d.bank_account_number}</span></div>
      <div class="gst-inv-bank-line"><span class="k">IFSC</span><span class="v">${d.bank_ifsc}</span></div>
      <div class="gst-inv-bank-line"><span class="k">Branch</span><span class="v">${d.bank_branch}</span></div>
    </td>
    <td class="gst-inv-qr-cell"><div class="gst-inv-qr-box"><span class="gst-inv-qr-placeholder">QR</span></div></td>
    <td class="gst-inv-sign-cell">
      <div class="gst-inv-sign-for">For ${d.company_name}</div>
      <div class="gst-inv-stamp-wrap"><div class="gst-inv-stamp-placeholder">SIGNATURE</div></div>
      <div class="gst-inv-sign-label">Authorized Signatory</div>
    </td>
  </tr></table>
  <table class="gst-inv-grid gst-inv-notes-terms"><tr>
    <td class="gst-inv-notes-cell"><div class="gst-inv-section-title">Notes:</div><div class="gst-inv-preline">${nl(d.notes)}</div></td>
    <td class="gst-inv-terms-cell"><div class="gst-inv-section-title">Terms and Conditions:</div><ul class="gst-inv-terms-list">${terms}</ul></td>
  </tr></table>
  <div class="gst-inv-page-footer">
    <span class="gst-inv-page-num">${d.page_label}</span>
    <span class="gst-inv-digital-note">${d.digital_sign_note}</span>
  </div>
</div></div>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>GST Invoice (Figma)</title><style>${css}</style></head><body style="margin:0;padding:0;background:#fff;">${body}</body></html>`;

fs.writeFileSync(path.join(root, 'templates/gst-invoice-figma.html'), html);
console.log('Wrote templates/gst-invoice-figma.html');
