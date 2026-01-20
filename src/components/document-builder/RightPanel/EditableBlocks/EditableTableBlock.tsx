import React, { useState } from 'react';
import { useDocumentBuilder, TableBlock } from '../../DocumentBuilderProvider';

interface EditableTableBlockProps {
    section: TableBlock;
}

export const EditableTableBlock: React.FC<EditableTableBlockProps> = ({ section }) => {
    const { dispatch } = useDocumentBuilder();
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);
    const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
    const rows = section.rows || [];

    // Find the correct amount column
    let amountColumn = section.columns.find(col => col.key === 'amount');
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

    const handleCellChange = (rowIndex: number, colKey: string, value: string) => {
        const newRows = [...rows];
        if (!newRows[rowIndex]) {
            newRows[rowIndex] = {};
        }
        newRows[rowIndex] = { ...newRows[rowIndex], [colKey]: value };
        dispatch({
            type: 'UPDATE_SECTION_DATA',
            payload: { sectionId: section.id, data: { rows: newRows } }
        });
    };

    const handleAddRow = () => {
        const newRow: Record<string, any> = {};
        section.columns.forEach(col => {
            newRow[col.key] = '';
        });
        dispatch({
            type: 'UPDATE_SECTION_DATA',
            payload: { sectionId: section.id, data: { rows: [...rows, newRow] } }
        });
    };

    const handleRemoveRow = (index: number) => {
        const newRows = [...rows];
        newRows.splice(index, 1);
        dispatch({
            type: 'UPDATE_SECTION_DATA',
            payload: { sectionId: section.id, data: { rows: newRows } }
        });
    };

    return (
        <div className="mb-6 relative group">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b-2 border-gray-800">
                        {section.columns.map((col) => (
                            <th
                                key={col.id}
                                className="py-2 text-left text-xs font-bold uppercase"
                                style={{ width: col.width }}
                            >
                                {col.header}
                            </th>
                        ))}
                        <th className="py-2 text-left text-xs font-bold uppercase w-12"></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length > 0 ? rows.map((row: Record<string, any>, idx: number) => (
                        <tr
                            key={idx}
                            className="border-b border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                            onMouseEnter={() => setHoveredRow(idx)}
                            onMouseLeave={() => setHoveredRow(null)}
                        >
                            {section.columns.map((col) => (
                                <td key={col.id} className="py-2">
                                    {col.type === 'amount' ? (
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm text-gray-500">₹</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-full text-sm text-gray-700 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                value={row[col.key] || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    handleCellChange(idx, col.key, value);
                                                }}
                                                onFocus={() => setEditingCell({ row: idx, col: col.key })}
                                                onBlur={() => setEditingCell(null)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    ) : (
                                        <input
                                            type={col.type === 'number' ? 'number' : 'text'}
                                            className="w-full text-sm text-gray-700 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            value={row[col.key] || ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                handleCellChange(idx, col.key, value);
                                            }}
                                            onFocus={() => setEditingCell({ row: idx, col: col.key })}
                                            onBlur={() => setEditingCell(null)}
                                            placeholder={`Enter ${col.header.toLowerCase()}`}
                                        />
                                    )}
                                </td>
                            ))}
                            <td className="py-2">
                                {hoveredRow === idx && (
                                    <button
                                        onClick={() => handleRemoveRow(idx)}
                                        className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                                        title="Remove row"
                                    >
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                )}
                            </td>
                        </tr>
                    )) : (
                        <tr className="border-b border-gray-200">
                            <td colSpan={section.columns.length + 1} className="py-8 text-center text-sm text-gray-400 italic">
                                <button
                                    onClick={handleAddRow}
                                    className="text-primary hover:text-primary-dark underline"
                                >
                                    Click to add first row
                                </button>
                            </td>
                        </tr>
                    )}
                </tbody>
                {section.showTotal && rows.length > 0 && (
                    <tfoot>
                        <tr>
                            <td colSpan={section.columns.length} className="py-2 text-right font-bold text-sm">
                                Total:
                            </td>
                            <td className="py-2 font-bold text-sm text-right">
                                ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                )}
            </table>
            <div className="mt-2 flex justify-end">
                <button
                    onClick={handleAddRow}
                    className="text-xs text-primary hover:text-primary-dark flex items-center gap-1 px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Row
                </button>
            </div>
        </div>
    );
};

