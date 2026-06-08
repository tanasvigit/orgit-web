import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../shared';
import { GstInvoiceFigmaInlineLayout } from './GstInvoiceFigmaInlineLayout';

export interface InlineDocumentEditorProps {
  schema: { systemTemplateKey?: string; editableFields?: any[]; defaultValues?: Record<string, any>; [k: string]: any };
  initialValues: Record<string, any>;
  submitLabel?: string;
  onSubmit: (data: Record<string, any>) => Promise<void> | void;
  onCancel?: () => void;
  disabled?: boolean;
}

function normalizeGstInvoiceFigmaForSubmit(data: Record<string, any>): Record<string, any> {
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
    if (!Array.isArray(base.item_rows) || base.item_rows.length === 0) base.item_rows = [{}];
    if (!Array.isArray(base.gst_summary_rows) || base.gst_summary_rows.length === 0) base.gst_summary_rows = [{}];
    if (!Array.isArray(base.terms_rows)) base.terms_rows = [];
    return base;
  }, [schema?.defaultValues, initialValues]);

  const { register, control, setValue, watch, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues,
  });

  const isGstInvoiceFigma =
    systemKey.includes('gst-invoice-figma') || systemKey.includes('gst_invoice_figma');

  const handleFormSubmit = handleSubmit((data) => onSubmit(normalizeGstInvoiceFigmaForSubmit(data)));

  const layoutProps = { register, control, setValue, watch, disabled: disabled || isSubmitting };

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900 py-6">
        {isGstInvoiceFigma ? (
          <GstInvoiceFigmaInlineLayout {...layoutProps} />
        ) : (
          <div className="max-w-2xl mx-auto p-8 text-center text-gray-500">
            This template does not support inline editing.
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
