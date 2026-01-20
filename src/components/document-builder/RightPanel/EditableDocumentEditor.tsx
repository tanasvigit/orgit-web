import React from 'react';
import { useDocumentBuilder, DocumentSection, TableBlock } from '../DocumentBuilderProvider';
import { EditableTextBlock } from './EditableBlocks/EditableTextBlock';
import { EditableTableBlock } from './EditableBlocks/EditableTableBlock';
import { EditableHeader } from './EditableBlocks/EditableHeader';
import { EditableDocumentMetadata } from './EditableBlocks/EditableDocumentMetadata';

// Non-editable block renderers for signature and amount-summary
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
        case 'text':
            return <EditableTextBlock section={section} />;
        case 'table':
            return <EditableTableBlock section={section} />;
        case 'signature':
            return <SignatureBlockRenderer section={section} />;
        case 'amount-summary':
            return <AmountSummaryRenderer section={section} />;
        default:
            return (
                <div className="p-2 border border-dashed border-gray-300 mb-4 text-xs text-gray-400">
                    Preview for {section.type}
                </div>
            );
    }
};

export const EditableDocumentEditor: React.FC = () => {
    const { state } = useDocumentBuilder();

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
                <EditableHeader />

                {/* Document Metadata */}
                <EditableDocumentMetadata />

                {/* Sections */}
                <div>
                    {state.sections.map(section => (
                        <SectionRenderer key={section.id} section={section} />
                    ))}
                </div>

                {/* Footer */}
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

