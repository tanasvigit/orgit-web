import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../shared';
import { TaxInvoiceInlineLayout } from './TaxInvoiceInlineLayout';
import { PaymentVoucherInlineLayout } from './PaymentVoucherInlineLayout';

export interface InlineDocumentEditorProps {
  /** Template schema (editableFields, systemTemplateKey, defaultValues) */
  schema: { systemTemplateKey?: string; editableFields?: any[]; defaultValues?: Record<string, any>; [k: string]: any };
  initialValues: Record<string, any>;
  submitLabel?: string;
  onSubmit: (data: Record<string, any>) => Promise<void> | void;
  onCancel?: () => void;
  disabled?: boolean;
}

function normalizeTaxInvoiceForSubmit(data: Record<string, any>): Record<string, any> {
  const out = { ...data };
  if (Array.isArray(out.item_rows)) {
    out.item_rows = out.item_rows.map((row: any) => {
      const r = { ...row };
      if (typeof r.detailsText === 'string' && r.detailsText.trim()) {
        r.details = r.detailsText.split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);
      }
      delete r.detailsText;
      return r;
    });
  }
  if (Array.isArray(out.item_rows)) {
    if (!out.total_items) out.total_items = String(out.item_rows.length);
    if (!out.total_qty && out.item_rows.length) {
      const qty = out.item_rows.reduce((sum: number, r: any) => sum + Number(r?.qty || 0), 0);
      out.total_qty = qty ? String(qty) : '';
    }
  }
  return out;
}

function normalizePaymentVoucherForSubmit(data: Record<string, any>): Record<string, any> {
  const out = { ...data };
  // Ensure due_entries / payment_entries have isTo as boolean for backend
  if (Array.isArray(out.due_entries)) {
    out.due_entries = out.due_entries.map((e: any) => ({
      ...e,
      isTo: !!e.isTo,
    }));
  }
  if (Array.isArray(out.payment_entries)) {
    out.payment_entries = out.payment_entries.map((e: any) => ({
      ...e,
      isTo: !!e.isTo,
    }));
  }
  return out;
}

export const InlineDocumentEditor: React.FC<InlineDocumentEditorProps> = ({
  schema,
  initialValues,
  submitLabel = 'Create Document',
  onSubmit,
  onCancel,
  disabled,
}) => {
  const systemKey = schema?.systemTemplateKey || '';
  const defaultValues = useMemo(() => {
    const base = { ...(schema?.defaultValues || {}), ...(initialValues || {}) };
    if (systemKey.includes('tax-invoice')) {
      if (!Array.isArray(base.item_rows) || base.item_rows.length === 0) base.item_rows = [{}];
      if (!Array.isArray(base.terms_rows)) base.terms_rows = [];
    }
    if (systemKey.includes('payment-voucher')) {
      if (!Array.isArray(base.due_entries) || base.due_entries.length === 0) base.due_entries = [{}, {}, {}];
      if (!Array.isArray(base.payment_entries) || base.payment_entries.length === 0) base.payment_entries = [{}, {}, {}];
      if (!Array.isArray(base.expense_rows)) base.expense_rows = [];
    }
    return base;
  }, [schema?.defaultValues, initialValues, systemKey]);

  const { register, control, setValue, watch, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues,
  });

  const isTaxInvoice = systemKey.includes('tax-invoice');
  const isPaymentVoucher = systemKey.includes('payment-voucher');

  const handleFormSubmit = handleSubmit((data) => {
    const normalized = isTaxInvoice
      ? normalizeTaxInvoiceForSubmit(data)
      : isPaymentVoucher
        ? normalizePaymentVoucherForSubmit(data)
        : data;
    return onSubmit(normalized);
  });

  const layoutProps = { register, control, setValue, watch, disabled: disabled || isSubmitting };

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900 py-6">
        {isTaxInvoice && <TaxInvoiceInlineLayout {...layoutProps} />}
        {isPaymentVoucher && <PaymentVoucherInlineLayout {...layoutProps} />}
        {!isTaxInvoice && !isPaymentVoucher && (
          <div className="max-w-2xl mx-auto p-8 text-center text-gray-500">
            This template does not support inline editing. Use the form view instead.
          </div>
        )}
      </div>
      <div className="shrink-0 flex gap-3 justify-end px-6 py-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-gray-700">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={disabled || isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={disabled || isSubmitting}>
          {isSubmitting ? 'Creating...' : submitLabel}
        </Button>
      </div>
    </form>
  );
};
