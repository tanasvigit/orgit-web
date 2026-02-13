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

export interface PaymentVoucherInlineLayoutProps {
  register: UseFormRegister<any>;
  control: Control<any>;
  setValue: UseFormSetValue<any>;
  watch: UseFormWatch<any>;
  disabled?: boolean;
}

export const PaymentVoucherInlineLayout: React.FC<PaymentVoucherInlineLayoutProps> = ({
  register,
  control,
  setValue,
  watch,
  disabled,
}) => {
  const { fields: expenseRows, append: appendExpense, remove: removeExpense } = useFieldArray({
    control,
    name: 'expense_rows',
  });
  const { fields: dueEntries, append: appendDue, remove: removeDue } = useFieldArray({
    control,
    name: 'due_entries',
  });
  const { fields: paymentEntries, append: appendPayment, remove: removePayment } = useFieldArray({
    control,
    name: 'payment_entries',
  });

  const companyLogo = watch('company_logo_data_uri');

  return (
    <div className="inline-doc-viewport payment-voucher">
      <div className="inline-doc-page">
        <div className="top-header">
          <div className="logo-wrap">
            <div className="logo">
              {companyLogo && typeof companyLogo === 'string' && companyLogo.startsWith('data:image') ? (
                <img src={companyLogo} alt="Logo" />
              ) : (
                <label style={{ cursor: 'pointer', fontSize: 10 }}>
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
            <div>
              <p className="company-name"><input {...register('company_name')} className="doc-inline-input" placeholder="Company Name" disabled={disabled} style={{ width: '100%' }} /></p>
              <p className="company-meta"><textarea {...register('company_address')} className="doc-inline-textarea preline" placeholder="Address" rows={2} disabled={disabled} style={{ width: '100%', minHeight: 32 }} /></p>
              <p className="company-meta"><input {...register('company_phone')} className="doc-inline-input" placeholder="Phone" disabled={disabled} style={{ width: '60%' }} /></p>
            </div>
          </div>
          <div className="firm-details">
            <p className="company-name"><input {...register('company_name')} className="doc-inline-input" placeholder="Company" disabled={disabled} style={{ width: '100%', textAlign: 'right' }} /></p>
            <p className="company-meta"><textarea {...register('company_address')} className="doc-inline-textarea preline" placeholder="Address" rows={2} disabled={disabled} style={{ width: '100%', textAlign: 'right', minHeight: 32 }} /></p>
            <p className="company-meta">GSTIN: <input {...register('company_gstin')} className="doc-inline-input" placeholder="GSTIN" disabled={disabled} style={{ width: '50%', textAlign: 'right' }} /></p>
            <p className="company-meta">Email: <input {...register('company_email')} className="doc-inline-input" placeholder="Email" disabled={disabled} style={{ width: '60%', textAlign: 'right' }} /></p>
          </div>
        </div>

        <div className="title-bar">PAYMENT VOUCHER</div>

        <table className="grid-form" aria-label="Voucher Details">
          <tbody>
            <tr>
              <td><div className="label">Voucher No</div><div className="value"><input {...register('voucher_no')} className="doc-inline-input" placeholder="Voucher No" disabled={disabled} /></div></td>
              <td><div className="label">Voucher Date</div><div className="value"><input {...register('voucher_date')} type="date" className="doc-inline-input" disabled={disabled} /></div></td>
            </tr>
            <tr>
              <td><div className="label">Bill No</div><div className="value"><input {...register('bill_no')} className="doc-inline-input" placeholder="Bill No" disabled={disabled} /></div></td>
              <td><div className="label">Bill Date</div><div className="value"><input {...register('bill_date')} type="date" className="doc-inline-input" disabled={disabled} /></div></td>
            </tr>
            <tr>
              <td><div className="label">Payment Mode</div><div className="value"><input {...register('payment_mode')} className="doc-inline-input" placeholder="Mode" disabled={disabled} /></div></td>
              <td><div className="label">Payment Date</div><div className="value"><input {...register('payment_date')} type="date" className="doc-inline-input" disabled={disabled} /></div></td>
            </tr>
            <tr>
              <td><div className="label">Paid Through</div><div className="value"><input {...register('paid_through')} className="doc-inline-input" placeholder="Paid through" disabled={disabled} /></div></td>
              <td><div className="label">Cheque / UTR No</div><div className="value"><input {...register('cheque_utr_no')} className="doc-inline-input" placeholder="Cheque/UTR" disabled={disabled} /></div></td>
            </tr>
          </tbody>
        </table>

        <div className="pay-lines">
          <div className="pay-line">
            <div className="k">Paid To:</div>
            <div className="fill-line"><input {...register('paid_to')} className="doc-inline-input" placeholder="Name / Party" disabled={disabled} /></div>
          </div>
          <div className="pay-line">
            <div className="k">Amount (Rs.):</div>
            <div className="fill-line short"><input {...register('amount')} className="doc-inline-input" placeholder="0" disabled={disabled} /></div>
          </div>
          <div className="pay-line">
            <div className="k">Amount in Words:</div>
            <div className="fill-line"><input {...register('amount_words')} className="doc-inline-input" placeholder="Rupees ... only" disabled={disabled} /></div>
          </div>
        </div>

        <div className="section-title">Expense Details</div>
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-sn">S.No</th>
              <th>Particulars</th>
              <th>Ledger Account</th>
              <th className="w-amt">Amount (Rs)</th>
              {!disabled && <th style={{ width: 36 }} />}
            </tr>
          </thead>
          <tbody>
            {expenseRows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 8 }}>
                  <button type="button" onClick={() => appendExpense({})} className="text-primary text-sm font-medium">+ Add expense row</button>
                </td>
              </tr>
            )}
            {expenseRows.map((row, idx) => (
              <tr key={row.id}>
                <td className="w-sn">{idx + 1}</td>
                <td><input {...register(`expense_rows.${idx}.particulars`)} className="doc-inline-input" placeholder="Particulars" disabled={disabled} /></td>
                <td><input {...register(`expense_rows.${idx}.ledgerAccount`)} className="doc-inline-input" placeholder="Ledger" disabled={disabled} /></td>
                <td className="w-amt"><input {...register(`expense_rows.${idx}.amount`)} className="doc-inline-input" placeholder="Amount" disabled={disabled} /></td>
                {!disabled && <td><button type="button" onClick={() => removeExpense(idx)} className="text-red-600"><span className="material-symbols-outlined text-lg">delete</span></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {expenseRows.length > 0 && (
          <button type="button" onClick={() => appendExpense({})} className="text-xs text-primary font-medium mb-2">+ Add expense</button>
        )}

        <div className="section-title">Journal Entries</div>
        <div className="journal-block">
          <div className="journal-title">
            Due Entry (Date: <span className="journal-date"><input {...register('due_entry_date')} type="date" className="doc-inline-input" disabled={disabled} style={{ minWidth: 140 }} /></span>)
          </div>
          {dueEntries.map((row, idx) => (
            <div key={row.id} className="je-line">
              <div className="je-field">
                <label><input type="checkbox" {...register(`due_entries.${idx}.isTo`)} disabled={disabled} /> To </label>
                <input {...register(`due_entries.${idx}.accountName`)} className="doc-inline-input" placeholder="Account" disabled={disabled} style={{ width: 'calc(100% - 32px)' }} />
              </div>
              <div className="je-field"><input {...register(`due_entries.${idx}.drCr`)} className="doc-inline-input" placeholder="Dr/Cr" disabled={disabled} /></div>
              <div className="je-field"><input {...register(`due_entries.${idx}.amount`)} className="doc-inline-input" placeholder="Amount" disabled={disabled} /></div>
              {!disabled && <button type="button" onClick={() => removeDue(idx)} className="text-red-600 ml-1">×</button>}
            </div>
          ))}
          <button type="button" onClick={() => appendDue({})} className="text-xs text-primary font-medium mt-1">+ Due line</button>

          <div style={{ height: 8 }} />

          <div className="journal-title">
            Payment Entry (Date: <span className="journal-date"><input {...register('payment_entry_date')} type="date" className="doc-inline-input" disabled={disabled} style={{ minWidth: 140 }} /></span>)
          </div>
          {paymentEntries.map((row, idx) => (
            <div key={row.id} className="je-line">
              <div className="je-field">
                <label><input type="checkbox" {...register(`payment_entries.${idx}.isTo`)} disabled={disabled} /> To </label>
                <input {...register(`payment_entries.${idx}.accountName`)} className="doc-inline-input" placeholder="Account" disabled={disabled} style={{ width: 'calc(100% - 32px)' }} />
              </div>
              <div className="je-field"><input {...register(`payment_entries.${idx}.drCr`)} className="doc-inline-input" placeholder="Dr/Cr" disabled={disabled} /></div>
              <div className="je-field"><input {...register(`payment_entries.${idx}.amount`)} className="doc-inline-input" placeholder="Amount" disabled={disabled} /></div>
              {!disabled && <button type="button" onClick={() => removePayment(idx)} className="text-red-600 ml-1">×</button>}
            </div>
          ))}
          <button type="button" onClick={() => appendPayment({})} className="text-xs text-primary font-medium mt-1">+ Payment line</button>
        </div>

        <table className="signatures">
          <tbody>
            <tr>
              <td><div className="value"><input {...register('prepared_by')} className="doc-inline-input" placeholder="Name" disabled={disabled} /></div><div className="sign-label">Prepared By</div></td>
              <td><div className="value"><input {...register('checked_by')} className="doc-inline-input" placeholder="Name" disabled={disabled} /></div><div className="sign-label">Checked By</div></td>
              <td><div className="value"><input {...register('approved_by')} className="doc-inline-input" placeholder="Name" disabled={disabled} /></div><div className="sign-label">Approved By</div></td>
              <td><div className="value"><input {...register('payee_signature')} className="doc-inline-input" placeholder="Payee" disabled={disabled} /></div><div className="sign-label">Signature of Payee</div></td>
            </tr>
          </tbody>
        </table>

        <p className="muted mt-8">This is a computer-generated document.</p>
      </div>
    </div>
  );
};
