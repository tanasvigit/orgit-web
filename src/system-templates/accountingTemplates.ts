// System (locked) accounting templates seeded by Super Admin.
// Stored server-side in document_templates, but the "source of truth" lives here for install.

// Vite raw imports (string contents).
// eslint-disable-next-line import/no-unresolved
import taxInvoiceBodyTemplate from './tax-invoice.hbs?raw';
// eslint-disable-next-line import/no-unresolved
import paymentVoucherBodyTemplate from './payment-voucher.hbs?raw';

export type SystemTemplateKey = 'system.tax-invoice.v1' | 'system.payment-voucher.v1';

export interface SystemDocumentTemplateDefinition {
  systemTemplateKey: SystemTemplateKey;
  name: string;
  type: string;
  status: 'active' | 'draft' | 'inactive';
  bodyTemplate: string;
  templateSchema: any;
  pdfSettings?: Record<string, any>;
}

const commonCompanyFields = [
  { name: 'company_logo_data_uri', label: 'Company Logo', type: 'image', required: false },
  { name: 'company_name', label: 'Company Name', type: 'text', required: true },
  { name: 'company_legal_name', label: 'Company Legal Name', type: 'text', required: false },
  { name: 'company_address', label: 'Company Address', type: 'textarea', required: false },
  { name: 'company_phone', label: 'Company Phone', type: 'text', required: false },
  { name: 'company_email', label: 'Company Email', type: 'text', required: false },
  { name: 'company_gstin', label: 'Company GSTIN', type: 'text', required: false },
];

export const SYSTEM_TEMPLATES: SystemDocumentTemplateDefinition[] = [
  {
    systemTemplateKey: 'system.tax-invoice.v1',
    name: 'Tax Invoice',
    type: 'tax_invoice',
    status: 'active',
    bodyTemplate: taxInvoiceBodyTemplate,
    templateSchema: {
      systemTemplateKey: 'system.tax-invoice.v1',
      lockedStructure: true,
      editableFields: [
        { name: 'invoice_copy_label', label: 'Invoice Copy Label', type: 'text', required: false },
        ...commonCompanyFields,

        { name: 'prepared_by', label: 'Prepared By', type: 'text', required: false },
        { name: 'checked_by', label: 'Checked By', type: 'text', required: false },
        { name: 'approved_by', label: 'Approved By', type: 'text', required: false },

        { name: 'invoice_number', label: 'Invoice Number', type: 'text', required: true },
        { name: 'invoice_date', label: 'Invoice Date', type: 'date', required: true },
        { name: 'place_of_supply', label: 'Place of Supply', type: 'text', required: false },
        { name: 'due_date', label: 'Due Date', type: 'text', required: false },

        { name: 'customer_name', label: 'Customer Name', type: 'text', required: true },
        { name: 'customer_address', label: 'Customer Address', type: 'textarea', required: false },
        { name: 'customer_phone', label: 'Customer Phone', type: 'text', required: false },
        { name: 'customer_gstin', label: 'Customer GSTIN', type: 'text', required: false },
        { name: 'customer_state', label: 'Customer State', type: 'text', required: false },

        { name: 'shipping_address', label: 'Shipping Address', type: 'textarea', required: false },
        { name: 'shipping_gstin', label: 'Shipping GSTIN', type: 'text', required: false },
        { name: 'shipping_state', label: 'Shipping State', type: 'text', required: false },

        { name: 'reference', label: 'Reference', type: 'text', required: false },

        {
          name: 'item_rows',
          label: 'Items',
          type: 'array',
          required: true,
          fields: [
            { name: 'item', label: 'Item', type: 'text', required: true },
            { name: 'hsn', label: 'HSN/SAC', type: 'text', required: false },
            { name: 'rate', label: 'Rate', type: 'text', required: false },
            { name: 'qty', label: 'Qty', type: 'text', required: false },
            { name: 'taxableValue', label: 'Taxable Value', type: 'text', required: false },
            { name: 'taxRate', label: 'Tax %', type: 'text', required: false },
            { name: 'taxAmount', label: 'Tax Amount', type: 'text', required: false },
            { name: 'amount', label: 'Amount', type: 'text', required: false },
            // Optional: details as a multiline textarea, stored as string and split client-side if needed.
            { name: 'detailsText', label: 'Item Details (one per line)', type: 'textarea', required: false },
          ],
        },

        { name: 'total_items', label: 'Total Items', type: 'text', required: false },
        { name: 'total_qty', label: 'Total Qty', type: 'text', required: false },
        { name: 'taxable_amount', label: 'Taxable Amount', type: 'text', required: false },
        { name: 'igst_rate', label: 'IGST Rate', type: 'text', required: false },
        { name: 'igst_amount', label: 'IGST Amount', type: 'text', required: false },
        { name: 'total_amount', label: 'Total Amount', type: 'text', required: false },
        { name: 'amount_words', label: 'Amount in Words', type: 'textarea', required: false },
        { name: 'amount_payable', label: 'Amount Payable', type: 'text', required: false },

        { name: 'bank_name', label: 'Bank Name', type: 'text', required: false },
        { name: 'bank_account_number', label: 'Account Number', type: 'text', required: false },
        { name: 'bank_ifsc', label: 'IFSC', type: 'text', required: false },
        { name: 'bank_branch', label: 'Branch', type: 'text', required: false },

        { name: 'qr_code_data_uri', label: 'UPI QR Code', type: 'image', required: false },

        { name: 'notes', label: 'Notes', type: 'textarea', required: false },
        {
          name: 'terms_rows',
          label: 'Terms & Conditions',
          type: 'array',
          required: false,
          fields: [{ name: 'text', label: 'Term', type: 'text', required: true }],
        },
      ],
    },
    pdfSettings: {
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    },
  },
  {
    systemTemplateKey: 'system.payment-voucher.v1',
    name: 'Payment Voucher',
    type: 'payment_voucher',
    status: 'active',
    bodyTemplate: paymentVoucherBodyTemplate,
    templateSchema: {
      systemTemplateKey: 'system.payment-voucher.v1',
      lockedStructure: true,
      editableFields: [
        ...commonCompanyFields,
        { name: 'voucher_no', label: 'Voucher No', type: 'text', required: true },
        { name: 'voucher_date', label: 'Voucher Date', type: 'date', required: true },
        { name: 'bill_no', label: 'Bill No', type: 'text', required: false },
        { name: 'bill_date', label: 'Bill Date', type: 'date', required: false },
        { name: 'payment_mode', label: 'Payment Mode', type: 'text', required: false },
        { name: 'payment_date', label: 'Payment Date', type: 'date', required: false },
        { name: 'paid_through', label: 'Paid Through', type: 'text', required: false },
        { name: 'cheque_utr_no', label: 'Cheque / UTR No', type: 'text', required: false },
        { name: 'paid_to', label: 'Paid To', type: 'text', required: true },
        { name: 'amount', label: 'Amount (Rs)', type: 'text', required: true },
        { name: 'amount_words', label: 'Amount in Words', type: 'textarea', required: false },

        {
          name: 'expense_rows',
          label: 'Expense Rows',
          type: 'array',
          required: false,
          fields: [
            { name: 'particulars', label: 'Particulars', type: 'text', required: true },
            { name: 'ledgerAccount', label: 'Ledger Account', type: 'text', required: false },
            { name: 'amount', label: 'Amount', type: 'text', required: false },
          ],
        },

        {
          name: 'due_entry_date',
          label: 'Due Entry Date',
          type: 'date',
          required: false,
        },
        {
          name: 'due_entries',
          label: 'Due Entry Lines',
          type: 'array',
          required: false,
          fields: [
            { name: 'isTo', label: 'To (prefix: true/false)', type: 'text', required: false },
            { name: 'accountName', label: 'Account Name', type: 'text', required: false },
            { name: 'drCr', label: 'Dr / Cr', type: 'text', required: false },
            { name: 'amount', label: 'Amount', type: 'text', required: false },
          ],
        },

        {
          name: 'payment_entry_date',
          label: 'Payment Entry Date',
          type: 'date',
          required: false,
        },
        {
          name: 'payment_entries',
          label: 'Payment Entry Lines',
          type: 'array',
          required: false,
          fields: [
            { name: 'isTo', label: 'To (prefix: true/false)', type: 'text', required: false },
            { name: 'accountName', label: 'Account Name', type: 'text', required: false },
            { name: 'drCr', label: 'Dr / Cr', type: 'text', required: false },
            { name: 'amount', label: 'Amount', type: 'text', required: false },
          ],
        },

        { name: 'prepared_by', label: 'Prepared By', type: 'text', required: false },
        { name: 'checked_by', label: 'Checked By', type: 'text', required: false },
        { name: 'approved_by', label: 'Approved By', type: 'text', required: false },
        { name: 'payee_signature', label: 'Payee Signature', type: 'text', required: false },
      ],
      defaultValues: {
        due_entries: [{}, {}, {}],
        payment_entries: [{}, {}, {}],
      },
    },
    pdfSettings: {
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    },
  },
];

