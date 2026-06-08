// System (locked) accounting templates seeded by Super Admin.
// Stored server-side in document_templates, but the "source of truth" lives here for install.

// eslint-disable-next-line import/no-unresolved
import gstInvoiceFigmaHbs from './gst-invoice-figma.hbs?raw';
// eslint-disable-next-line import/no-unresolved
import gstInvoiceFigmaCss from './gst-invoice-figma.css?raw';

export type SystemTemplateKey = 'system.gst-invoice-figma.v1';

const gstInvoiceFigmaBodyTemplate = `<style>\n${gstInvoiceFigmaCss}\n</style>\n${gstInvoiceFigmaHbs}`;

export interface SystemDocumentTemplateDefinition {
  systemTemplateKey: SystemTemplateKey;
  name: string;
  type: string;
  status: 'active' | 'draft' | 'inactive';
  bodyTemplate: string;
  templateSchema: any;
  pdfSettings?: Record<string, any>;
}

const gstInvoiceFigmaCompanyFields = [
  { name: 'company_logo_data_uri', label: 'Company Logo', type: 'image', required: false },
  { name: 'company_name', label: 'Company Name', type: 'text', required: true },
  { name: 'company_legal_name', label: 'Company Legal Name', type: 'text', required: false },
  { name: 'company_address', label: 'Company Address', type: 'textarea', required: false },
  { name: 'company_phone', label: 'Company Phone', type: 'text', required: false },
  { name: 'company_email', label: 'Company Email', type: 'text', required: false },
  { name: 'company_gstin', label: 'Company GSTIN', type: 'text', required: false },
  { name: 'company_pan', label: 'Company PAN', type: 'text', required: false },
  { name: 'company_cin', label: 'Company CIN', type: 'text', required: false },
];

export const SYSTEM_TEMPLATES: SystemDocumentTemplateDefinition[] = [
  {
    systemTemplateKey: 'system.gst-invoice-figma.v1',
    name: 'GST Invoice (Figma)',
    type: 'gst_invoice_figma',
    status: 'active',
    bodyTemplate: gstInvoiceFigmaBodyTemplate,
    templateSchema: {
      systemTemplateKey: 'system.gst-invoice-figma.v1',
      lockedStructure: true,
      editableFields: [
        { name: 'invoice_copy_label', label: 'Invoice Copy Label', type: 'text', required: false },
        ...gstInvoiceFigmaCompanyFields,

        { name: 'invoice_number', label: 'Invoice Number', type: 'text', required: true },
        { name: 'invoice_date', label: 'Invoice Date', type: 'date', required: true },
        { name: 'mode_of_supply', label: 'Mode of Supply', type: 'text', required: false },
        { name: 'place_of_supply', label: 'Place of Supply', type: 'text', required: false },
        { name: 'date_of_supply', label: 'Date of Supply', type: 'date', required: false },

        { name: 'billing_customer_name', label: 'Billing Customer', type: 'text', required: true },
        { name: 'billing_address', label: 'Billing Address', type: 'textarea', required: false },
        { name: 'billing_phone', label: 'Billing Phone', type: 'text', required: false },
        { name: 'billing_gstin', label: 'Billing GSTIN', type: 'text', required: false },
        { name: 'billing_state', label: 'Billing State', type: 'text', required: false },

        { name: 'shipping_customer_name', label: 'Shipping Customer', type: 'text', required: false },
        { name: 'shipping_address', label: 'Shipping Address', type: 'textarea', required: false },
        { name: 'shipping_gstin', label: 'Shipping GSTIN', type: 'text', required: false },
        { name: 'shipping_state', label: 'Shipping State', type: 'text', required: false },
        {
          name: 'item_rows',
          label: 'Items',
          type: 'array',
          required: true,
          fields: [
            { name: 'description', label: 'Description', type: 'text', required: true },
            { name: 'hsn', label: 'HSN/SAC', type: 'text', required: false },
            { name: 'rate', label: 'Rate (Rs.)', type: 'text', required: false },
            { name: 'qty', label: 'Qty', type: 'text', required: false },
            { name: 'taxable_value', label: 'Taxable Value', type: 'text', required: false },
            { name: 'cgst_rate', label: 'CGST %', type: 'text', required: false },
            { name: 'cgst', label: 'CGST Amount', type: 'text', required: false },
            { name: 'sgst_rate', label: 'SGST %', type: 'text', required: false },
            { name: 'sgst', label: 'SGST Amount', type: 'text', required: false },
            { name: 'amount', label: 'Amount', type: 'text', required: false },
            { name: 'detailsText', label: 'Item Details (one per line)', type: 'textarea', required: false },
          ],
        },

        { name: 'total_taxable_value', label: 'Total Taxable Value', type: 'text', required: false },
        { name: 'total_tax', label: 'Total Tax', type: 'text', required: false },
        { name: 'grand_total', label: 'Total Amount after Tax', type: 'text', required: false },
        { name: 'amount_in_words', label: 'Amount in Words', type: 'textarea', required: false },

        {
          name: 'gst_summary_rows',
          label: 'GST Summary',
          type: 'array',
          required: false,
          fields: [
            { name: 'hsn', label: 'HSN/SAC', type: 'text', required: false },
            { name: 'rate', label: 'Rate', type: 'text', required: false },
            { name: 'integrated_tax_amount', label: 'Integrated Tax Amount', type: 'text', required: false },
            { name: 'central_tax_amount', label: 'Central Tax Amount', type: 'text', required: false },
            { name: 'state_tax_amount', label: 'State Tax Amount', type: 'text', required: false },
            { name: 'total_tax_amount', label: 'Total Tax Amount', type: 'text', required: false },
          ],
        },
        { name: 'gst_summary_integrated_total', label: 'GST Summary Integrated Total', type: 'text', required: false },
        { name: 'gst_summary_central_total', label: 'GST Summary Central Total', type: 'text', required: false },
        { name: 'gst_summary_state_total', label: 'GST Summary State Total', type: 'text', required: false },
        { name: 'gst_summary_tax_total', label: 'GST Summary Tax Total', type: 'text', required: false },
        { name: 'gst_payable_reverse_charge', label: 'GST Payable on Reverse Charge', type: 'text', required: false },

        { name: 'bank_name', label: 'Bank Name', type: 'text', required: false },
        { name: 'bank_account_number', label: 'Account Number', type: 'text', required: false },
        { name: 'bank_ifsc', label: 'IFSC', type: 'text', required: false },
        { name: 'bank_branch', label: 'Branch', type: 'text', required: false },
        { name: 'qr_code_data_uri', label: 'QR Code', type: 'image', required: false },
        { name: 'signature_stamp_data_uri', label: 'Signature Stamp', type: 'image', required: false },
        { name: 'notes', label: 'Notes', type: 'textarea', required: false },
        {
          name: 'terms_rows',
          label: 'Terms & Conditions',
          type: 'array',
          required: false,
          fields: [{ name: 'text', label: 'Term', type: 'text', required: true }],
        },
        { name: 'page_label', label: 'Page Label', type: 'text', required: false },
        { name: 'digital_sign_note', label: 'Digital Sign Note', type: 'text', required: false },
      ],
      defaultValues: {
        invoice_copy_label: '',
        item_rows: [{}],
        gst_summary_rows: [{}],
        terms_rows: [],
        page_label: '',
        digital_sign_note: '',
      },
    },
    pdfSettings: {
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' },
    },
  },
];
