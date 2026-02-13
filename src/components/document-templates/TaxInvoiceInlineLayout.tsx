import React from 'react';
import { useFieldArray } from 'react-hook-form';
import type { UseFormRegister, Control, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import './inline-document.css';

async function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export interface TaxInvoiceInlineLayoutProps {
  register: UseFormRegister<any>;
  control: Control<any>;
  setValue: UseFormSetValue<any>;
  watch: UseFormWatch<any>;
  disabled?: boolean;
}

export const TaxInvoiceInlineLayout: React.FC<TaxInvoiceInlineLayoutProps> = ({
  register,
  control,
  setValue,
  watch,
  disabled,
}) => {
  const { fields: itemRows, append: appendItem, remove: removeItem } = useFieldArray({
    control,
    name: 'item_rows',
  });
  const { fields: termsRows, append: appendTerm, remove: removeTerm } = useFieldArray({
    control,
    name: 'terms_rows',
  });

  const companyLogo = watch('company_logo_data_uri');
  const qrCode = watch('qr_code_data_uri');

  return (
    <div className="inline-doc-viewport">
      <div className="inline-doc-page">
        <div className="topbar b-b">
          <span style={{ width: 140 }} />
          <div className="topbar-title">TAX INVOICE</div>
          <div className="topbar-copy">
            <input
              {...register('invoice_copy_label')}
              className="doc-inline-input"
              placeholder="ORIGINAL FOR RECIPIENT"
              disabled={disabled}
              style={{ textAlign: 'right', minWidth: 120 }}
            />
          </div>
        </div>

        {/* TOP SECTION: 50% | 25% | 25% - explicit widths to avoid merging */}
        <table className="section-table b-b">
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <div className="header-wrap">
                  <div className="logo">
                    {companyLogo && typeof companyLogo === 'string' && companyLogo.startsWith('data:image') ? (
                      <img src={companyLogo} alt="Company Logo" />
                    ) : (
                      <label style={{ cursor: 'pointer', fontSize: 9, display: 'block', minHeight: 18 }}>
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input {...register('company_name')} className="doc-inline-input h-title" placeholder="Company Name" disabled={disabled} />
                    <p className="h-meta strong">
                      GSTIN <input {...register('company_gstin')} className="doc-inline-input" placeholder="GSTIN" disabled={disabled} style={{ width: '60%' }} />
                    </p>
                    <input {...register('company_legal_name')} className="doc-inline-input h-meta strong" placeholder="Legal Name" disabled={disabled} />
                    <textarea {...register('company_address')} className="doc-inline-textarea h-muted preline" placeholder="Address" rows={2} disabled={disabled} />
                    <p className="h-muted">
                      Mobile <span className="strong"><input {...register('company_phone')} className="doc-inline-input" placeholder="Phone" disabled={disabled} style={{ width: '50%' }} /></span>
                    </p>
                  </div>
                </div>
              </td>
              <td style={{ width: '25%', verticalAlign: 'top' }}>
                <div className="label strong">Invoice #</div>
                <div className="value"><input {...register('invoice_number')} className="doc-inline-input" placeholder="Inv-001" disabled={disabled} /></div>
                <br />
                <div className="label strong">Place of Supply:</div>
                <div className="value"><input {...register('place_of_supply')} className="doc-inline-input" placeholder="State" disabled={disabled} /></div>
              </td>
              <td style={{ width: '25%', verticalAlign: 'top' }}>
                <div className="label strong">Invoice Date:</div>
                <div className="value"><input {...register('invoice_date')} type="date" className="doc-inline-input" disabled={disabled} /></div>
                <br />
                <div className="label strong">Due Date:</div>
                <div className="value"><input {...register('due_date')} className="doc-inline-input" placeholder="Due date" disabled={disabled} /></div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* CUSTOMER + SHIPPING: 50% | 50% - explicit widths to avoid merging */}
        <table className="section-table b-b">
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <div className="label strong u">Customer Details:</div>
                <div className="value"><input {...register('customer_name')} className="doc-inline-input" placeholder="Customer Name" disabled={disabled} /></div>
                <div className="strong mt-6">Billing address</div>
                <textarea {...register('customer_address')} className="doc-inline-textarea preline" placeholder="Address" rows={2} disabled={disabled} />
                <div>Ph: <input {...register('customer_phone')} className="doc-inline-input" placeholder="Phone" disabled={disabled} style={{ width: '40%' }} /></div>
                <div>GSTIN: <input {...register('customer_gstin')} className="doc-inline-input" placeholder="GSTIN" disabled={disabled} style={{ width: '50%' }} /></div>
                <div>State: <input {...register('customer_state')} className="doc-inline-input" placeholder="State" disabled={disabled} style={{ width: '40%' }} /></div>
              </td>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <div className="label strong u">Shipping Address:</div>
                <textarea {...register('shipping_address')} className="doc-inline-textarea preline" placeholder="Shipping address" rows={2} disabled={disabled} />
                <div>GSTIN: <input {...register('shipping_gstin')} className="doc-inline-input" placeholder="GSTIN" disabled={disabled} style={{ width: '60%' }} /></div>
                <div>State: <input {...register('shipping_state')} className="doc-inline-input" placeholder="State" disabled={disabled} style={{ width: '40%' }} /></div>
                <div className="label strong u mt-6">Reference:</div>
                <div className="value"><input {...register('reference')} className="doc-inline-input" placeholder="Ref" disabled={disabled} /></div>
              </td>
            </tr>
          </tbody>
        </table>

        <table aria-label="Invoice Items">
          <thead>
            <tr>
              <th className="col-idx">#</th>
              <th className="col-item">Item</th>
              <th className="col-hsn">HSN/SAC</th>
              <th className="col-rate">Rate/ Item</th>
              <th className="col-qty">Qty</th>
              <th className="col-taxable">Taxable Value</th>
              <th className="col-tax">Tax Amount</th>
              <th className="col-amount">Amount</th>
              {!disabled && <th style={{ width: 36 }} />}
            </tr>
          </thead>
          <tbody>
            {itemRows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 12 }}>
                  <button type="button" onClick={() => appendItem({})} className="text-primary text-sm font-medium">
                    + Add item row
                  </button>
                </td>
              </tr>
            )}
            {itemRows.map((row, idx) => (
              <tr key={row.id}>
                <td className="col-idx">{idx + 1}</td>
                <td className="col-item">
                  <input {...register(`item_rows.${idx}.item`)} className="doc-inline-input item-name" placeholder="Item" disabled={disabled} />
                  <textarea {...register(`item_rows.${idx}.detailsText`)} className="doc-inline-textarea item-meta" placeholder="Details (one per line)" rows={2} disabled={disabled} />
                </td>
                <td className="col-hsn"><input {...register(`item_rows.${idx}.hsn`)} className="doc-inline-input" disabled={disabled} /></td>
                <td className="col-rate"><input {...register(`item_rows.${idx}.rate`)} className="doc-inline-input" disabled={disabled} /></td>
                <td className="col-qty"><input {...register(`item_rows.${idx}.qty`)} className="doc-inline-input" disabled={disabled} /></td>
                <td className="col-taxable"><input {...register(`item_rows.${idx}.taxableValue`)} className="doc-inline-input" disabled={disabled} /></td>
                <td className="col-tax">
                  <input {...register(`item_rows.${idx}.taxAmount`)} className="doc-inline-input" disabled={disabled} />
                  <div className="tax-rate">(<input {...register(`item_rows.${idx}.taxRate`)} className="doc-inline-input" placeholder="%" disabled={disabled} style={{ width: 32 }} />)</div>
                </td>
                <td className="col-amount"><input {...register(`item_rows.${idx}.amount`)} className="doc-inline-input" disabled={disabled} /></td>
                {!disabled && (
                  <td>
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-600 hover:text-red-800" title="Remove row">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {itemRows.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <button type="button" onClick={() => appendItem({})} className="text-xs text-primary font-medium">
              + Add another item
            </button>
          </div>
        )}

        <div className="summary-row">
          <div className="summary-left">
            Total Items / Qty : <input {...register('total_items')} className="doc-inline-input" placeholder="0" disabled={disabled} style={{ width: 48 }} />
            {' / '}
            <input {...register('total_qty')} className="doc-inline-input" placeholder="0" disabled={disabled} style={{ width: 48 }} />
          </div>
          <div className="summary-right">
            <div className="sum-line">
              <span className="sum-label">Taxable Amount</span>
              <span className="sum-val"><input {...register('taxable_amount')} className="doc-inline-input" placeholder="0" disabled={disabled} style={{ width: 100, textAlign: 'right' }} /></span>
            </div>
            <div className="sum-line alt">
              <span className="sum-label">IGST <input {...register('igst_rate')} className="doc-inline-input" placeholder="%" disabled={disabled} style={{ width: 40 }} /></span>
              <span className="sum-val"><input {...register('igst_amount')} className="doc-inline-input" placeholder="0" disabled={disabled} style={{ width: 100, textAlign: 'right' }} /></span>
            </div>
            <div className="sum-total">
              <span className="t-label">Total</span>
              <span className="t-val"><input {...register('total_amount')} className="doc-inline-input" placeholder="0" disabled={disabled} style={{ width: 120, textAlign: 'right', fontSize: 18 }} /></span>
            </div>
          </div>
        </div>

        <div className="amount-words">
          Total amount (in words): <span className="strong"><input {...register('amount_words')} className="doc-inline-input" placeholder="Rupees ... only" disabled={disabled} style={{ width: '70%', display: 'inline-block' }} /></span>
        </div>
        <div className="amount-payable">
          Amount Payable: <input {...register('amount_payable')} className="doc-inline-input" placeholder="0" disabled={disabled} style={{ width: 120, textAlign: 'right' }} />
        </div>

        <div className="footer-two-cols">
          <div className="footer-left">
            <div className="bank">
              <h3>Bank Details</h3>
              <div className="bank-grid">
                <div className="k">Bank</div>
                <div className="strong"><input {...register('bank_name')} className="doc-inline-input" placeholder="Bank name" disabled={disabled} /></div>
                <div className="k">Account #</div>
                <div className="strong"><input {...register('bank_account_number')} className="doc-inline-input" placeholder="Account" disabled={disabled} /></div>
                <div className="k">IFSC</div>
                <div className="strong"><input {...register('bank_ifsc')} className="doc-inline-input" placeholder="IFSC" disabled={disabled} /></div>
                <div className="k">Branch</div>
                <div className="strong"><input {...register('bank_branch')} className="doc-inline-input" placeholder="Branch" disabled={disabled} /></div>
              </div>
            </div>
            <div className="notes">
              <div className="strong u mb-6">Notes:</div>
              <textarea {...register('notes')} className="doc-inline-textarea preline" placeholder="Notes" rows={3} disabled={disabled} />
            </div>
          </div>
          <div className="footer-right">
            <div className="qr">
              <div className="qr-title">Pay using UPI</div>
              <div className="qr-box">
                {qrCode && typeof qrCode === 'string' && qrCode.startsWith('data:image') ? (
                  <img src={qrCode} alt="UPI QR" />
                ) : (
                  <label className="qr-placeholder">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={disabled}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) setValue('qr_code_data_uri', await fileToDataUri(f), { shouldDirty: true });
                      }}
                    />
                    + QR
                  </label>
                )}
              </div>
              <div className="qr-note">Scan to verify / pay</div>
            </div>
            <div className="tc">
              <div className="strong u mb-6">Terms and Conditions:</div>
              <ol className="ol">
                {termsRows.map((row, idx) => (
                  <li key={row.id}>
                    <input {...register(`terms_rows.${idx}.text`)} className="doc-inline-input" placeholder="Term" disabled={disabled} style={{ width: '90%' }} />
                    {!disabled && <button type="button" onClick={() => removeTerm(idx)} className="ml-1 text-red-600">×</button>}
                  </li>
                ))}
              </ol>
              <button type="button" onClick={() => appendTerm({ text: '' })} className="text-xs text-primary font-medium mt-1">
                + Add term
              </button>
            </div>
          </div>
        </div>

        <div className="approval-sign">
          <div className="box">
            <div className="who">Prepared By</div>
            <div className="line"><input {...register('prepared_by')} className="doc-inline-input" placeholder="Name" disabled={disabled} /></div>
          </div>
          <div className="box">
            <div className="who">Checked By</div>
            <div className="line"><input {...register('checked_by')} className="doc-inline-input" placeholder="Name" disabled={disabled} /></div>
          </div>
          <div className="box">
            <div className="who">Approved By</div>
            <div className="line"><input {...register('approved_by')} className="doc-inline-input" placeholder="Name" disabled={disabled} /></div>
          </div>
        </div>
      </div>
    </div>
  );
};
