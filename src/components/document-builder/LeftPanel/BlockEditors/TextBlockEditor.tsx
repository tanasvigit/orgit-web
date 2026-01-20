import React from 'react';
import { useDocumentBuilder, TextBlock } from '../../DocumentBuilderProvider';

export const TextBlockEditor: React.FC<{ section: TextBlock }> = ({ section }) => {
    const { dispatch } = useDocumentBuilder();

    const handleChange = (content: string) => {
        dispatch({
            type: 'UPDATE_SECTION',
            payload: { id: section.id, updates: { content } }
        });
    };

    return (
        <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Content
            </label>
            <div className="relative">
                <textarea
                    rows={6}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-sm font-mono"
                    value={section.content}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder="Enter text here. Use {{variable}} for dynamic data."
                />
                <div className="absolute bottom-2 right-2 flex gap-1">
                    <button className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-primary">
                        Insert Variable
                    </button>
                </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
                Supports basic HTML tags like &lt;b&gt;, &lt;i&gt;, &lt;br&gt;
            </p>
        </div>
    );
};
