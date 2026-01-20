import React from 'react';
import { useDocumentBuilder } from '../DocumentBuilderProvider';

export const TemplateConfig: React.FC = () => {
    const { state, dispatch } = useDocumentBuilder();

    return (
        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template Name <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={state.meta.name}
                    onChange={(e) =>
                        dispatch({ type: 'SET_META', payload: { name: e.target.value } })
                    }
                    placeholder="e.g., Service Invoice v1"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Document Type
                </label>
                <select
                    value={state.meta.type}
                    onChange={(e) =>
                        dispatch({ type: 'SET_META', payload: { type: e.target.value } })
                    }
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                >
                    <option>Tax Invoice</option>
                    <option>Proforma Invoice</option>
                    <option>Quotation</option>
                    <option>Purchase Order</option>
                    <option>Receipt</option>
                    <option>Contract / Agreement</option>
                    <option>Letterhead</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                </label>
                <textarea
                    value={state.meta.description || ''}
                    onChange={(e) =>
                        dispatch({ type: 'SET_META', payload: { description: e.target.value } })
                    }
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    rows={3}
                    placeholder="Internal reference or notes..."
                />
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Template Status
                </label>
                <div className="flex items-center gap-3">
                    <select
                        value={state.meta.status}
                        onChange={(e) =>
                            dispatch({
                                type: 'SET_META',
                                payload: { status: e.target.value as 'draft' | 'active' | 'archived' }
                            })
                        }
                        className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                    </select>

                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${state.meta.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : state.meta.status === 'draft'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                        {state.meta.status.toUpperCase()}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Set to "Active" to make this template available for document creation.
                </p>
            </div>
        </div>
    );
};
