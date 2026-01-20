import React, { useState } from 'react';
import { useDocumentBuilder } from '../../DocumentBuilderProvider';

export const EditableDocumentMetadata: React.FC = () => {
    const { state, dispatch } = useDocumentBuilder();
    const [editingField, setEditingField] = useState<string | null>(null);
    const [tempValues, setTempValues] = useState<Record<string, string>>({});

    const handleFieldChange = (field: string, value: string) => {
        setTempValues({ ...tempValues, [field]: value });
    };

    const handleFieldBlur = (field: string) => {
        if (tempValues[field] !== undefined) {
            dispatch({
                type: 'SET_DOCUMENT_DATA',
                payload: { [field]: tempValues[field] }
            });
        }
        setEditingField(null);
        setTempValues({});
    };

    const handleFieldFocus = (field: string) => {
        setEditingField(field);
        setTempValues({ [field]: state.documentData[field as keyof typeof state.documentData] as string || '' });
    };

    const getValue = (field: string) => {
        if (editingField === field && tempValues[field] !== undefined) {
            return tempValues[field];
        }
        return state.documentData[field as keyof typeof state.documentData] as string || '';
    };

    return (
        <div className="mb-8 border-b border-gray-900 pb-2">
            <h2 className="text-xl font-bold text-gray-900 uppercase mb-2">{state.meta.type}</h2>
            <div className="flex justify-between text-sm mt-2">
                <div>
                    <span className="font-semibold">To:</span>{' '}
                    <input
                        type="text"
                        className="bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors inline-block min-w-[150px]"
                        value={getValue('clientName')}
                        onChange={(e) => handleFieldChange('clientName', e.target.value)}
                        onFocus={() => handleFieldFocus('clientName')}
                        onBlur={() => handleFieldBlur('clientName')}
                        placeholder="Client Name"
                    />
                </div>
                <div className="text-right">
                    <div>
                        <span className="font-semibold">Date:</span>{' '}
                        <input
                            type="date"
                            className="bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors inline-block"
                            value={getValue('date') || new Date().toISOString().split('T')[0]}
                            onChange={(e) => handleFieldChange('date', e.target.value)}
                            onFocus={() => handleFieldFocus('date')}
                            onBlur={() => handleFieldBlur('date')}
                        />
                    </div>
                    <div>
                        <span className="font-semibold">Ref:</span>{' '}
                        <input
                            type="text"
                            className="bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors inline-block min-w-[100px]"
                            value={getValue('referenceNo')}
                            onChange={(e) => handleFieldChange('referenceNo', e.target.value)}
                            onFocus={() => handleFieldFocus('referenceNo')}
                            onBlur={() => handleFieldBlur('referenceNo')}
                            placeholder="REF-001"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

