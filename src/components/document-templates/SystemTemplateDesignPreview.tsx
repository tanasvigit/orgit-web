import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { GstInvoiceFigmaInlineLayout } from './GstInvoiceFigmaInlineLayout';

export function resolveSystemTemplateKey(template: any, schema: any): string {
  const raw = schema?.systemTemplateKey || template?.type || template?.systemTemplateKey || '';
  return String(raw);
}

export function isSystemInlineTemplate(systemKey: string): boolean {
  return /gst-invoice-figma|gst_invoice_figma/i.test(systemKey);
}

export function buildEmptyTemplateDefaults(): Record<string, any> {
  return {
    invoice_copy_label: '',
    company_name: '',
    company_legal_name: '',
    company_address: '',
    company_gstin: '',
    company_pan: '',
    company_cin: '',
    company_email: '',
    company_phone: '',
    invoice_number: '',
    invoice_date: '',
    mode_of_supply: '',
    place_of_supply: '',
    date_of_supply: '',
    billing_customer_name: '',
    billing_address: '',
    billing_phone: '',
    billing_gstin: '',
    billing_state: '',
    shipping_customer_name: '',
    shipping_address: '',
    shipping_gstin: '',
    shipping_state: '',
    total_taxable_value: '',
    total_tax: '',
    grand_total: '',
    amount_in_words: '',
    gst_summary_integrated_total: '',
    gst_summary_central_total: '',
    gst_summary_state_total: '',
    gst_summary_tax_total: '',
    gst_payable_reverse_charge: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_branch: '',
    notes: '',
    page_label: '',
    digital_sign_note: '',
    item_rows: [{}],
    gst_summary_rows: [{}],
    terms_rows: [],
  };
}

export interface SystemTemplateDesignPreviewProps {
  template: any;
  schema: any;
}

export const SystemTemplateDesignPreview: React.FC<SystemTemplateDesignPreviewProps> = () => {
  const defaultValues = useMemo(() => buildEmptyTemplateDefaults(), []);
  const { register, control, setValue, watch } = useForm({ defaultValues });
  const layoutProps = { register, control, setValue, watch, disabled: true, templateMode: true };

  return (
    <div className="doc-template-preview">
      <GstInvoiceFigmaInlineLayout {...layoutProps} />
    </div>
  );
};
