import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useDocumentBuilder, TableBlock, TableColumn } from '../../DocumentBuilderProvider';

export const TableBlockEditor: React.FC<{ section: TableBlock }> = ({ section }) => {
    const { dispatch } = useDocumentBuilder();

    const updateColumn = (columnId: string, data: Partial<TableColumn>) => {
        const newColumns = section.columns.map(col =>
            col.id === columnId ? { ...col, ...data } : col
        );
        dispatch({
            type: 'UPDATE_SECTION',
            payload: { id: section.id, updates: { columns: newColumns } }
        });
    };

    const addColumn = () => {
        const newCol: TableColumn = {
            id: uuidv4(),
            header: 'New Column',
            key: 'key',
            width: '20%',
            type: 'text'
        };
        dispatch({
            type: 'UPDATE_SECTION',
            payload: { id: section.id, updates: { columns: [...section.columns, newCol] } }
        });
    };

    const removeColumn = (columnId: string) => {
        dispatch({
            type: 'UPDATE_SECTION',
            payload: { id: section.id, updates: { columns: section.columns.filter(c => c.id !== columnId) } }
        });
    };

    return (
        <div className="space-y-4">
            {/* Options */}
            <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                        type="checkbox"
                        checked={section.showTax}
                        onChange={(e) => dispatch({ type: 'UPDATE_SECTION', payload: { id: section.id, updates: { showTax: e.target.checked } } })}
                        className="rounded text-primary focus:ring-primary"
                    />
                    Show Tax
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                        type="checkbox"
                        checked={section.showTotal}
                        onChange={(e) => dispatch({ type: 'UPDATE_SECTION', payload: { id: section.id, updates: { showTotal: e.target.checked } } })}
                        className="rounded text-primary focus:ring-primary"
                    />
                    Show Total
                </label>
            </div>

            {/* Columns Config */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-gray-500 uppercase">Columns</label>
                    <button
                        onClick={addColumn}
                        className="text-xs text-primary hover:underline font-medium"
                    >
                        + Add Column
                    </button>
                </div>

                <div className="space-y-2">
                    {section.columns.map((col, index) => (
                        <div key={col.id} className="flex gap-2 items-start p-2 bg-gray-50 dark:bg-slate-900 rounded border border-gray-200 dark:border-gray-700">
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={col.header}
                                    onChange={(e) => updateColumn(col.id, { header: e.target.value })}
                                    placeholder="Header Label"
                                    className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                                />
                                <input
                                    type="text"
                                    value={col.key}
                                    onChange={(e) => updateColumn(col.id, { key: e.target.value })}
                                    placeholder="Data Key"
                                    className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 font-mono"
                                />
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={col.width}
                                        onChange={(e) => updateColumn(col.id, { width: e.target.value })}
                                        placeholder="Width %"
                                        className="w-16 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                                    />
                                    <select
                                        value={col.type}
                                        onChange={(e) => updateColumn(col.id, { type: e.target.value as any })}
                                        className="flex-1 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                                    >
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="amount">Amount</option>
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={() => removeColumn(col.id)}
                                className="p-1 text-gray-400 hover:text-red-500"
                                title="Remove Column"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
