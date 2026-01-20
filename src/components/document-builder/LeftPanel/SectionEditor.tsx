import React from 'react';
import { useDocumentBuilder, DocumentSection } from '../DocumentBuilderProvider';
import { TextBlockEditor } from './BlockEditors/TextBlockEditor';
import { TableBlockEditor } from './BlockEditors/TableBlockEditor';

// Placeholder for other editors
const PlaceholderEditor: React.FC<{ type: string }> = ({ type }) => (
    <div className="p-4 bg-gray-50 rounded text-sm text-gray-500 text-center">
        Editor for {type} coming soon
    </div>
);

export const SectionEditor: React.FC<{ section: DocumentSection }> = ({ section }) => {
    const { dispatch } = useDocumentBuilder();

    const updateLabel = (value: string) => {
        dispatch({
            type: 'UPDATE_SECTION',
            payload: { id: section.id, updates: { label: value } }
        });
    };

    return (
        <div className="space-y-4">
            {/* Common Fields */}
            <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    Section Label
                </label>
                <input
                    type="text"
                    value={section.label || ''}
                    onChange={(e) => updateLabel(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                />
            </div>

            {/* Specific Editors */}
            {section.type === 'text' && <TextBlockEditor section={section as any} />}
            {section.type === 'table' && <TableBlockEditor section={section as any} />}
            {section.type === 'key-value' && <PlaceholderEditor type="Key-Value" />}
            {section.type === 'amount-summary' && <PlaceholderEditor type="Amount Summary" />}
            {section.type === 'signature' && <PlaceholderEditor type="Signature" />}
        </div>
    );
};
