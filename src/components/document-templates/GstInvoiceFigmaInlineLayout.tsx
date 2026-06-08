import React from 'react';
import { useFieldArray } from 'react-hook-form';
import type { UseFormRegister, Control, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import './gst-invoice-figma-inline.css';

async function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export interface GstInvoiceFigmaInlineLayoutProps {
  register: UseFormRegister<any>;
  control: Control<any>;
  setValue: UseFormSetValue<any>;
  watch: UseFormWatch<any>;
  disabled?: boolean;
  /** When true, render blank template (no placeholders or sample text) */
  templateMode?: boolean;
}

export const GstInvoiceFigmaInlineLayout: React.FC<GstInvoiceFigmaInlineLayoutProps> = ({
  register,
  control,
  setValue,
  watch,
  disabled,
  templateMode = false,
}) => {
  const ph = (hint: string) => (templateMode ? '' : hint);
  const { fields: itemRows, append: appendItem, remove: removeItem } = useFieldArray({
    control,
    name: 'item_rows',
  });
  const { fields: gstSummaryRows, append: appendGstRow, remove: removeGstRow } = useFieldArray({
    control,
    name: 'gst_summary_rows',
  });
  const { fields: termsRows, append: appendTerm, remove: removeTerm } = useFieldArray({
    control,
    name: 'terms_rows',
  });

  const companyLogo = watch('company_logo_data_uri');
  const qrCode = watch('qr_code_data_uri');
  const signatureStamp = watch('signature_stamp_data_uri');
  const companyName = watch('company_name');

  return (
    <div className="gst-inv-inline-viewport gst-inv-root">
      <div className="gst-inv-page">
        <table className="gst-inv-grid gst-inv-header-block">
          <tbody>
            <tr>
              <td className="gst-inv-company-cell">
                <div className="gst-inv-brand-row">
                  <div className="gst-inv-logo">
                    {companyLogo && typeof companyLogo === 'string' && companyLogo.startsWith('data:image') ? (
                      <img src={companyLogo} alt="Company Logo" />
                    ) : templateMode ? (
                      <span aria-hidden="true">&nbsp;</span>
                    ) : (
                      <label style={{ cursor: 'pointer', fontSize: 8, display: 'block' }}>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={disabled}
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) setValue('company_logo_data_uri', await fileToDataUri(f), { shouldDirty: true });
                          }}
                        />
                        + Logo
                      </label>
                    )}
                  </div>
                  <input {...register('company_name')} className="doc-inline-input gst-inv-brand-name" placeholder={ph('Company Name')} disabled={disabled} />
                </div>
                <textarea {...register('company_address')} className="doc-inline-textarea gst-inv-company-address gst-inv-preline" placeholder="Address" rows={2} disabled={disabled} />
                <div className="gst-inv-company-meta">
                  GSTIN/UIN: <input {...register('company_gstin')} className="doc-inline-input" placeholder="GSTIN" disabled={disabled} style={{ width: '55%' }} />
                </div>
                <div className="gst-inv-company-meta">
                  PAN: <input {...register('company_pan')} className="doc-inline-input" placeholder="PAN" disabled={disabled} style={{ width: '55%' }} />
                </div>
                <div className="gst-inv-company-meta">
                  CIN: <input {...register('company_cin')} className="doc-inline-input" placeholder="CIN" disabled={disabled} style={{ width: '60%' }} />
                </div>
                <div className="gst-inv-company-meta">
                  Email: <input {...register('company_email')} className="doc-inline-input" placeholder="email@company.com" disabled={disabled} style={{ width: '60%' }} />
                </div>
              </td>
              <td className="gst-inv-invoice-cell">
                <div className="gst-inv-invoice-title">TAX INVOICE</div>
                <table className="gst-inv-invoice-meta">
                  <tbody>
                    <tr><td className="k">Invoice #</td><td className="v"><input {...register('invoice_number')} className="doc-inline-input" placeholder="INV/001" disabled={disabled} /></td></tr>
                    <tr><td className="k">Invoice Date</td><td className="v"><input {...register('invoice_date')} type="date" className="doc-inline-input" disabled={disabled} /></td></tr>
                    <tr><td className="k">Mode of Supply</td><td className="v"><input {...register('mode_of_supply')} className="doc-inline-input" placeholder="Road" disabled={disabled} /></td></tr>
                    <tr><td className="k">Place of Supply</td><td className="v"><input {...register('place_of_supply')} className="doc-inline-input" placeholder="State" disabled={disabled} /></td></tr>
                    <tr><td className="k">Date of Supply</td><td className="v"><input {...register('date_of_supply')} type="date" className="doc-inline-input" disabled={disabled} /></td></tr>
                  </tbody>
                </table>
                <div className="gst-inv-copy-label">
                  <input {...register('invoice_copy_label')} className="doc-inline-input" placeholder="ORIGINAL FOR RECIPIENT" disabled={disabled} style={{ textAlign: 'right' }} />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="gst-inv-grid">
          <tbody>
            <tr>
              <td className="gst-inv-addr-cell">
                <div className="gst-inv-addr-title">Billing Address</div>
                <input {...register('billing_customer_name')} className="doc-inline-input" placeholder="Customer name" disabled={disabled} />
                <textarea {...register('billing_address')} className="doc-inline-textarea gst-inv-preline" placeholder="Billing address" rows={3} disabled={disabled} />
              </td>
              <td className="gst-inv-addr-cell">
                <div className="gst-inv-addr-title">Shipping Address</div>
                <input {...register('shipping_customer_name')} className="doc-inline-input" placeholder="Shipping name" disabled={disabled} />
                <textarea {...register('shipping_address')} className="doc-inline-textarea gst-inv-preline" placeholder="Shipping address" rows={3} disabled={disabled} />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="gst-inv-table-scroll">
          <table className="gst-inv-items-table" aria-label="Invoice Items">
            <thead>
              <tr>
                <th className="gst-inv-col-desc" rowSpan={2}>Description</th>
                <th className="gst-inv-col-hsn" rowSpan={2}>HSN/SAC</th>
                <th className="gst-inv-col-rate" rowSpan={2}>Rate (Rs.)</th>
                <th className="gst-inv-col-qty" rowSpan={2}>Qty</th>
                <th className="gst-inv-col-taxable" rowSpan={2}>Taxable Value</th>
                <th className="gst-inv-col-tax-group" colSpan={2}>Tax Amount</th>
                <th className="gst-inv-col-amount" rowSpan={2}>Amount</th>
                {!disabled && <th rowSpan={2} style={{ width: 32 }} />}
              </tr>
              <tr>
                <th className="gst-inv-col-cgst">CGST</th>
                <th className="gst-inv-col-sgst">SGST</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.length === 0 && (
                <tr>
                  <td colSpan={disabled ? 8 : 9} style={{ textAlign: 'center', padding: 12 }}>
                    <button type="button" onClick={() => appendItem({})} className="text-primary text-sm font-medium">
                      + Add item row
                    </button>
                  </td>
                </tr>
              )}
              {itemRows.map((row, idx) => (
                <tr key={row.id}>
                  <td className="gst-inv-col-desc">
                    <input {...register(`item_rows.${idx}.description`)} className="doc-inline-input gst-inv-item-name" placeholder="Description" disabled={disabled} />
                    <textarea {...register(`item_rows.${idx}.detailsText`)} className="doc-inline-textarea gst-inv-item-meta" placeholder="Details" rows={1} disabled={disabled} />
                  </td>
                  <td><input {...register(`item_rows.${idx}.hsn`)} className="doc-inline-input" disabled={disabled} /></td>
                  <td><input {...register(`item_rows.${idx}.rate`)} className="doc-inline-input" disabled={disabled} /></td>
                  <td><input {...register(`item_rows.${idx}.qty`)} className="doc-inline-input" disabled={disabled} /></td>
                  <td><input {...register(`item_rows.${idx}.taxable_value`)} className="doc-inline-input" disabled={disabled} /></td>
                  <td className="gst-inv-col-cgst">
                    <input {...register(`item_rows.${idx}.cgst_rate`)} className="doc-inline-input gst-inv-tax-pct" placeholder="%" disabled={disabled} />
                    <input {...register(`item_rows.${idx}.cgst`)} className="doc-inline-input gst-inv-tax-amt" placeholder="0" disabled={disabled} />
                  </td>
                  <td className="gst-inv-col-sgst">
                    <input {...register(`item_rows.${idx}.sgst_rate`)} className="doc-inline-input gst-inv-tax-pct" placeholder="%" disabled={disabled} />
                    <input {...register(`item_rows.${idx}.sgst`)} className="doc-inline-input gst-inv-tax-amt" placeholder="0" disabled={disabled} />
                  </td>
                  <td><input {...register(`item_rows.${idx}.amount`)} className="doc-inline-input" disabled={disabled} /></td>
                  {!disabled && (
                    <td>
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-600" title="Remove">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="gst-inv-tfoot-row">
                <td colSpan={5} className="gst-inv-tfoot-spacer" />
                <td colSpan={2} className="gst-inv-tfoot-label">Total Taxable Value</td>
                <td className="gst-inv-tfoot-val">
                  <input {...register('total_taxable_value')} className="doc-inline-input gst-inv-tfoot-input" placeholder="0" disabled={disabled} />
                </td>
                {!disabled && <td />}
              </tr>
              <tr className="gst-inv-tfoot-row">
                <td colSpan={5} className="gst-inv-tfoot-spacer" />
                <td colSpan={2} className="gst-inv-tfoot-label">Total Tax</td>
                <td className="gst-inv-tfoot-val">
                  <input {...register('total_tax')} className="doc-inline-input gst-inv-tfoot-input" placeholder="0" disabled={disabled} />
                </td>
                {!disabled && <td />}
              </tr>
              <tr className="gst-inv-tfoot-row gst-inv-tfoot-grand">
                <td colSpan={5} className="gst-inv-tfoot-spacer" />
                <td colSpan={2} className="gst-inv-tfoot-label">Total Amount after Tax</td>
                <td className="gst-inv-tfoot-val gst-inv-grand-val">
                  <span className="gst-inv-grand-currency" aria-hidden="true">₹</span>
                  <input {...register('grand_total')} className="doc-inline-input gst-inv-grand-input" placeholder="0" disabled={disabled} />
                </td>
                {!disabled && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
        {itemRows.length > 0 && !disabled && (
          <div style={{ marginTop: 4, paddingLeft: 8 }}>
            <button type="button" onClick={() => appendItem({})} className="text-xs text-primary font-medium">+ Add item</button>
          </div>
        )}

        <div className="gst-inv-amount-words">
          Total amount (in words): <input {...register('amount_in_words')} className="doc-inline-input" placeholder="INR ... Rupees Only" disabled={disabled} style={{ width: '65%', display: 'inline-block' }} />
        </div>

        <div className="gst-inv-table-scroll">
          <table className="gst-inv-gst-table" aria-label="GST Summary">
            <thead>
              <tr>
                <th>HSN/SAC</th>
                <th>Rate</th>
                <th>Integrated Tax Amount</th>
                <th>Central Tax Amount</th>
                <th>State/UT Tax Amount</th>
                <th>Total Tax Amount</th>
                {!disabled && <th style={{ width: 32 }} />}
              </tr>
            </thead>
            <tbody>
              {gstSummaryRows.map((row, idx) => (
                <tr key={row.id}>
                  <td><input {...register(`gst_summary_rows.${idx}.hsn`)} className="doc-inline-input" disabled={disabled} /></td>
                  <td><input {...register(`gst_summary_rows.${idx}.rate`)} className="doc-inline-input" disabled={disabled} /></td>
                  <td><input {...register(`gst_summary_rows.${idx}.integrated_tax_amount`)} className="doc-inline-input" disabled={disabled} /></td>
                  <td><input {...register(`gst_summary_rows.${idx}.central_tax_amount`)} className="doc-inline-input" disabled={disabled} /></td>
                  <td><input {...register(`gst_summary_rows.${idx}.state_tax_amount`)} className="doc-inline-input" disabled={disabled} /></td>
                  <td><input {...register(`gst_summary_rows.${idx}.total_tax_amount`)} className="doc-inline-input" disabled={disabled} /></td>
                  {!disabled && (
                    <td>
                      <button type="button" onClick={() => removeGstRow(idx)} className="text-red-600" title="Remove">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              <tr className="gst-inv-gst-total-row">
                <td colSpan={2} className="gst-inv-strong">TOTAL</td>
                <td><input {...register('gst_summary_integrated_total')} className="doc-inline-input" disabled={disabled} /></td>
                <td><input {...register('gst_summary_central_total')} className="doc-inline-input" disabled={disabled} /></td>
                <td><input {...register('gst_summary_state_total')} className="doc-inline-input" disabled={disabled} /></td>
                <td><input {...register('gst_summary_tax_total')} className="doc-inline-input" disabled={disabled} /></td>
                {!disabled && <td />}
              </tr>
              <tr className="gst-inv-gst-rc-row">
                <td colSpan={5} className="gst-inv-gst-rc-label">GST Payable on Reverse Charge</td>
                <td><input {...register('gst_payable_reverse_charge')} className="doc-inline-input" disabled={disabled} /></td>
                {!disabled && <td />}
              </tr>
            </tbody>
          </table>
        </div>
        {!disabled && (
          <div style={{ marginTop: 4, paddingLeft: 8 }}>
            <button type="button" onClick={() => appendGstRow({})} className="text-xs text-primary font-medium">+ Add GST row</button>
          </div>
        )}

        <table className="gst-inv-grid gst-inv-bottom-3col">
          <tbody>
            <tr>
              <td className="gst-inv-bank-cell">
                <div className="gst-inv-section-title">Bank Details</div>
                <div className="gst-inv-bank-line"><span className="k">Bank</span><input {...register('bank_name')} className="doc-inline-input" placeholder="Bank" disabled={disabled} /></div>
                <div className="gst-inv-bank-line"><span className="k">Account #</span><input {...register('bank_account_number')} className="doc-inline-input" placeholder="Account" disabled={disabled} /></div>
                <div className="gst-inv-bank-line"><span className="k">IFSC</span><input {...register('bank_ifsc')} className="doc-inline-input" placeholder="IFSC" disabled={disabled} /></div>
                <div className="gst-inv-bank-line"><span className="k">Branch</span><input {...register('bank_branch')} className="doc-inline-input" placeholder="Branch" disabled={disabled} /></div>
              </td>
              <td className="gst-inv-qr-cell">
                <div className="gst-inv-qr-box">
                  {qrCode && typeof qrCode === 'string' && qrCode.startsWith('data:image') ? (
                    <img src={qrCode} alt="QR" />
                ) : templateMode ? (
                  <span className="gst-inv-qr-placeholder" aria-hidden="true">&nbsp;</span>
                ) : (
                  <label className="gst-inv-qr-placeholder">
                    <input type="file" accept="image/*" className="hidden" disabled={disabled} onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setValue('qr_code_data_uri', await fileToDataUri(f), { shouldDirty: true });
                    }} />
                    + QR
                  </label>
                )}
                </div>
              </td>
              <td className="gst-inv-sign-cell">
                <div className="gst-inv-sign-for">For{templateMode ? '' : companyName ? ` ${companyName}` : ' _____________'}</div>
                <div className="gst-inv-stamp-wrap">
                  {signatureStamp && typeof signatureStamp === 'string' && signatureStamp.startsWith('data:image') ? (
                    <img src={signatureStamp} alt="Signature" className="gst-inv-stamp-img" />
                  ) : templateMode ? (
                    <div className="gst-inv-stamp-placeholder">SIGNATURE</div>
                  ) : (
                    <label className="gst-inv-stamp-placeholder">
                      <input type="file" accept="image/*" className="hidden" disabled={disabled} onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) setValue('signature_stamp_data_uri', await fileToDataUri(f), { shouldDirty: true });
                      }} />
                      SIGNATURE
                    </label>
                  )}
                </div>
                <div className="gst-inv-sign-label">Authorized Signatory</div>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="gst-inv-grid gst-inv-notes-terms">
          <tbody>
            <tr>
              <td className="gst-inv-notes-cell">
                <div className="gst-inv-section-title">Notes:</div>
                <textarea {...register('notes')} className="doc-inline-textarea gst-inv-preline" placeholder="Notes" rows={3} disabled={disabled} />
              </td>
              <td className="gst-inv-terms-cell">
                <div className="gst-inv-section-title">Terms and Conditions:</div>
                <ul className="gst-inv-terms-list">
                  {termsRows.map((row, idx) => (
                    <li key={row.id}>
                      <input {...register(`terms_rows.${idx}.text`)} className="doc-inline-input" placeholder="Term" disabled={disabled} style={{ width: '92%' }} />
                      {!disabled && <button type="button" onClick={() => removeTerm(idx)} className="text-red-600 ml-1">×</button>}
                    </li>
                  ))}
                </ul>
                {!disabled && (
                  <button type="button" onClick={() => appendTerm({ text: '' })} className="text-xs text-primary font-medium mt-1">+ Add term</button>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="gst-inv-page-footer">
          <input {...register('page_label')} className="doc-inline-input gst-inv-page-num" placeholder="Page 1/1" disabled={disabled} style={{ width: 80 }} />
          <input {...register('digital_sign_note')} className="doc-inline-input gst-inv-digital-note" placeholder="Digital sign note" disabled={disabled} style={{ flex: 1, textAlign: 'center' }} />
        </div>
      </div>
    </div>
  );
};
