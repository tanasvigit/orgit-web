import React from 'react';
import { useDocumentBuilder, DocumentSection, TableBlock } from '../DocumentBuilderProvider';

// --- Block Renderers (Internal or External) ---

const TextBlockRenderer: React.FC<{ section: any }> = ({ section }) => (
    <div
        className="mb-4 text-sm"
        dangerouslySetInnerHTML={{ __html: section.content || '' }}
    />
);

const TableBlockRenderer: React.FC<{ section: TableBlock }> = ({ section }) => {
    const rows = section.rows || [];

    // Find the correct amount column - prioritize key === 'amount'
    let amountColumn = section.columns.find(col => col.key === 'amount');

    // Fallback: search for last column of type 'amount' (usually the total column)
    if (!amountColumn) {
        const amountCols = section.columns.filter(col => col.type === 'amount');
        if (amountCols.length > 0) {
            amountColumn = amountCols[amountCols.length - 1];
        }
    }

    const totalAmount = rows.reduce((sum, row) => {
        const val = row[amountColumn?.key || 'amount'];
        const value = parseFloat(val || 0);
        return sum + (isNaN(value) ? 0 : value);
    }, 0);

    return (
        <div className="mb-6">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b-2 border-gray-800">
                        {section.columns.map((col: any) => (
                            <th
                                key={col.id}
                                className="py-2 text-left text-xs font-bold uppercase"
                                style={{ width: col.width }}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length > 0 ? rows.map((row: Record<string, any>, idx: number) => (
                        <tr key={idx} className="border-b border-gray-200">
                            {section.columns.map((col: any) => (
                                <td key={col.id} className="py-2 text-sm text-gray-700">
                                    {col.type === 'amount' ? `₹${parseFloat(row[col.key] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : row[col.key] || '-'}
                                </td>
                            ))}
                        </tr>
                    )) : (
                        <tr className="border-b border-gray-200">
                            <td colSpan={section.columns.length} className="py-8 text-center text-sm text-gray-400 italic">
                                No items added yet
                            </td>
                        </tr>
                    )}
                </tbody>
                {section.showTotal && (
                    <tfoot>
                        <tr>
                            <td colSpan={section.columns.length - 1} className="py-2 text-right font-bold text-sm">
                                Total:
                            </td>
                            <td className="py-2 font-bold text-sm text-right">
                                ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
};

const SignatureBlockRenderer: React.FC<{ section: any }> = ({ section }) => (
    <div className="mt-8 pt-8 border-t border-gray-200">
        <div className="flex justify-end">
            <div className="text-center min-w-[200px]">
                <div className="h-16 flex items-center justify-center text-gray-300 italic mb-2">
                    (Authorized Signatory)
                </div>
                <div className="border-t border-gray-900 pt-1">
                    <p className="text-sm font-bold text-gray-900">{section.signatoryLabel || 'Authorized Signatory'}</p>
                    <p className="text-xs text-gray-500">{section.label || 'Signature'}</p>
                </div>
            </div>
        </div>
    </div>
);

const AmountSummaryRenderer: React.FC<{ section: any }> = ({ section }) => {
    const { state } = useDocumentBuilder();
    const fields = section.fields || [];

    // Calculate grand total from all tables
    const grandTotal = state.sections.reduce((total, s) => {
        if (s.type === 'table') {
            const table = s as TableBlock;
            // Find correct amount column
            let amountCol = table.columns.find(col => col.key === 'amount');
            if (!amountCol) {
                const amountCols = table.columns.filter(col => col.type === 'amount');
                if (amountCols.length > 0) amountCol = amountCols[amountCols.length - 1];
            }

            const tableSum = (table.rows || []).reduce((sum, row) => {
                const val = row[amountCol?.key || 'amount'];
                const value = parseFloat(val || 0);
                return sum + (isNaN(value) ? 0 : value);
            }, 0);
            return total + tableSum;
        }
        return total;
    }, 0);

    return (
        <div className="flex justify-end mt-4">
            <div className="w-1/2">
                <table className="w-full">
                    <tbody>
                        {fields.map((field: any, idx: number) => {
                            const isTotal = field.label.toLowerCase().includes('total');
                            const value = isTotal ? grandTotal : 0; // Currently only calculating Grand Total

                            return (
                                <tr key={idx} className={isTotal ? 'border-t-2 border-gray-900' : ''}>
                                    <td className="py-1 text-sm text-gray-600 font-medium">{field.label}</td>
                                    <td className={`py-1 text-sm text-right ${isTotal ? 'font-bold' : 'font-semibold'}`}>
                                        ₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const SectionRenderer: React.FC<{ section: DocumentSection }> = ({ section }) => {
    switch (section.type) {
        case 'text': return <TextBlockRenderer section={section} />;
        case 'table': return <TableBlockRenderer section={section} />;
        case 'signature': return <SignatureBlockRenderer section={section} />;
        case 'amount-summary': return <AmountSummaryRenderer section={section} />;
        default: return <div className="p-2 border border-dashed border-gray-300 mb-4 text-xs text-gray-400">Preview for {section.type}</div>;
    }
};

// --- Main Preview Component ---

export const LivePreview: React.FC = () => {
    const { state } = useDocumentBuilder();
    const headerLayout = state.header.layout;

    return (
        <div className="flex flex-col items-center">
            {/* A4 Container */}
            <div
                className="bg-white shadow-lg transition-all"
                style={{
                    width: '210mm',
                    minHeight: '297mm',
                    padding: '20mm', // standard margin
                    position: 'relative'
                }}
            >
                {/* Header */}
                <header className={`flex flex-col gap-4 border-b pb-6 mb-8 items-${headerLayout}`}>
                    {state.header.showLogo && (
                        <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                            {state.header.orgLogoUrl ? (
                                <img 
                                    src={state.header.orgLogoUrl} 
                                    alt="Company Logo" 
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                        // Fallback to placeholder if image fails to load
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        if (target.parentElement) {
                                            target.parentElement.innerHTML = '<span class="text-gray-400 text-xs">Logo</span>';
                                        }
                                    }}
                                />
                            ) : (
                                <span className="text-gray-400 text-xs">Logo</span>
                            )}
                        </div>
                    )}
                    {state.header.orgDetailsVisible && (
                        <div className={`text-${headerLayout === 'center' ? 'center' : headerLayout === 'right' ? 'right' : 'left'}`}>
                            <h1 className="text-xl font-bold text-gray-900">{state.header.orgName || 'Organization Name'}</h1>
                            <p className="text-xs text-gray-500 whitespace-pre-wrap">{state.header.orgAddress || 'Organization Address'}</p>
                            <div className="mt-1 text-xs text-gray-500">
                                {state.header.orgGstin && <span>GSTIN: {state.header.orgGstin}</span>}
                                {state.header.orgEmail && <span className="ml-2">| Email: {state.header.orgEmail}</span>}
                            </div>
                        </div>
                    )}
                </header>

                {/* Title (if standard) */}
                <div className="mb-8 border-b border-gray-900 pb-2">
                    <h2 className="text-xl font-bold text-gray-900 uppercase">{state.meta.type}</h2>
                    <div className="flex justify-between text-sm mt-2">
                        <div>
                            <span className="font-semibold">To:</span> {state.documentData.clientName || 'Client Name'}
                        </div>
                        <div className="text-right">
                            <div><span className="font-semibold">Date:</span> {state.documentData.date || new Date().toLocaleDateString()}</div>
                            <div><span className="font-semibold">Ref:</span> {state.documentData.referenceNo || 'REF-001'}</div>
                        </div>
                    </div>
                </div>

                {/* Sections */}
                <div>
                    {state.sections.map(section => (
                        <SectionRenderer key={section.id} section={section} />
                    ))}
                </div>

                {/* Footer (Sticky/Bottom of page usually, but relative here for scrolling) */}
                <div className="mt-12 pt-4 border-t border-gray-200">
                    <div className="text-xs text-center text-gray-400">
                        Page 1 of 1
                    </div>
                </div>
            </div>

            <div className="mt-4 text-xs text-gray-500">
                A4 Preview (Scale 100%)
            </div>
        </div>
    );
};
