const path = require('path');
const {
  generatePdfFromTemplate,
  generateItemRows,
  generateFillerRows,
  generateTermsRows,
  fileToDataUri,
  formatINR,
} = require('../generatePdf');

async function main() {
  // Optional: point this to your logo file to "upload" it into the template.
  // Example: const companyLogo = await fileToDataUri(path.join(__dirname, 'logo.png'));
  const companyLogo = '';

  const items = [
    {
      item: 'Tata Nexon',
      hsn: '87038070',
      rate: 577343.75,
      qty: 1,
      taxRate: '28%',
      taxAmount: 161656.25,
      amount: 739000,
    },
    {
      item: 'DECARBONISING GASKET KIT',
      hsn: '87089900',
      rate: 2717.97,
      qty: 1,
      taxRate: '28%',
      taxAmount: 761.03,
      amount: 3479,
      details: [
        'Part No - 252700990123',
        'VC No : 55075333000R',
        'ENGINE TABLE : 2527352700R.03',
      ],
    },
  ];

  const taxable = 580061.72;
  const igst = 162417.28;
  const total = 742479.0;

  const htmlData = {
    invoice_copy_label: 'ORIGINAL FOR RECIPIENT',

    company_logo: companyLogo,
    company_name: 'TATA MOTORS LIMITED',
    company_gstin: '27AAACT2727Q1ZW',
    company_legal_name: 'TATA MOTORS LIMITED',
    company_address: 'Nigadi Bhosari Road, PIMPRI\nPune, 27-MAHARASHTRA, 411018',
    company_phone: '9999999999',

    invoice_number: 'INV-8',
    invoice_date: '11 Mar 2022',
    place_of_supply: '36-TELANGANA',
    due_date: 'Immediate on Receipt',

    customer_name: 'Shiwani',
    customer_address:
      'Survey 115/1, ISB Rd, Financial District, Gachibowli, Nanakaramguda\nHyderabad, 36-TELANGANA',
    customer_phone: '9999999999',
    customer_gstin: '',
    customer_state: '36-TELANGANA',

    shipping_address:
      'Survey 115/1, ISB Rd, Financial District, Gachibowli, Nanakaramguda\nHyderabad, 36-TELANGANA',
    shipping_gstin: '',
    shipping_state: '36-TELANGANA',

    reference: '',

    item_rows: generateItemRows(items),
    filler_rows: generateFillerRows({ columns: 8, heightPx: 220 }),

    total_items: String(items.length),
    total_qty: formatINR(
      items.reduce((sum, it) => sum + Number(it.qty || 0), 0),
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    ),

    taxable_amount: `₹ ${formatINR(taxable)}`,
    igst_rate: '28.0%',
    igst_amount: `₹ ${formatINR(igst)}`,
    total_amount: `₹ ${formatINR(total)}`,
    amount_words: 'INR Seven Lakh, Forty-Two Thousand, Four Hundred And Seventy-Nine Rupees Only.',
    amount_payable: `₹ ${formatINR(total)}`,

    bank_name: 'Yes Bank',
    bank_account_number: '999999999999999',
    bank_ifsc: 'YES99999',
    bank_branch: 'Somajiguda',

    // You can replace this with: `<img src="${await fileToDataUri('qr.png')}" alt="UPI QR" />`
    qr_code: '<span style="font-size:10px;color:#6b7280">QR</span>',

    notes: 'Thank you for the Business',
    terms_rows: generateTermsRows([
      'Goods once sold cannot be taken back or exchanged.',
      'Subject to local jurisdiction.',
    ]),

    prepared_by: 'Prepared User',
    checked_by: 'Checked User',
    approved_by: 'Approved User',
  };

  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const templatePath = path.resolve(__dirname, '..', '..', 'templates', 'tax-invoice.html');
  const outPath = path.join(repoRoot, 'output', 'tax-invoice-sample.pdf');

  await generatePdfFromTemplate({
    templatePath,
    data: htmlData,
    outputPath: outPath,
    rawKeys: ['item_rows', 'filler_rows', 'qr_code', 'terms_rows'],
  });

  console.log(`Generated: ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

