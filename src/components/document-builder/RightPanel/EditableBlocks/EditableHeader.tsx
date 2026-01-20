import React, { useState } from 'react';
import { useDocumentBuilder } from '../../DocumentBuilderProvider';

export const EditableHeader: React.FC = () => {
    const { state, dispatch } = useDocumentBuilder();
    const [editingField, setEditingField] = useState<string | null>(null);
    const [tempValues, setTempValues] = useState<Record<string, string>>({});

    const headerLayout = state.header.layout;

    const handleFieldChange = (field: string, value: string) => {
        setTempValues({ ...tempValues, [field]: value });
    };

    const handleFieldBlur = (field: string) => {
        if (tempValues[field] !== undefined) {
            dispatch({
                type: 'UPDATE_HEADER',
                payload: { [field]: tempValues[field] }
            });
        }
        setEditingField(null);
        setTempValues({});
    };

    const handleFieldFocus = (field: string) => {
        setEditingField(field);
        setTempValues({ [field]: state.header[field as keyof typeof state.header] as string || '' });
    };

    const getValue = (field: string) => {
        if (editingField === field && tempValues[field] !== undefined) {
            return tempValues[field];
        }
        return state.header[field as keyof typeof state.header] as string || '';
    };

    return (
        <header className={`flex flex-col gap-4 border-b pb-6 mb-8 items-${headerLayout}`}>
            {state.header.showLogo && (
                <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                    {state.header.orgLogoUrl ? (
                        <img 
                            src={state.header.orgLogoUrl} 
                            alt="Company Logo" 
                            className="w-full h-full object-contain"
                            onError={(e) => {
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
                    <input
                        type="text"
                        className="text-xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors w-full max-w-md"
                        value={getValue('orgName')}
                        onChange={(e) => handleFieldChange('orgName', e.target.value)}
                        onFocus={() => handleFieldFocus('orgName')}
                        onBlur={() => handleFieldBlur('orgName')}
                        placeholder="Organization Name"
                    />
                    <textarea
                        className="text-xs text-gray-500 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors w-full max-w-md resize-none mt-1 whitespace-pre-wrap"
                        rows={3}
                        value={getValue('orgAddress')}
                        onChange={(e) => handleFieldChange('orgAddress', e.target.value)}
                        onFocus={() => handleFieldFocus('orgAddress')}
                        onBlur={() => handleFieldBlur('orgAddress')}
                        placeholder="Organization Address"
                    />
                    <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-2">
                        {state.header.orgGstin && (
                            <span>
                                GSTIN:{' '}
                                <input
                                    type="text"
                                    className="bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors inline-block min-w-[120px]"
                                    value={getValue('orgGstin')}
                                    onChange={(e) => handleFieldChange('orgGstin', e.target.value)}
                                    onFocus={() => handleFieldFocus('orgGstin')}
                                    onBlur={() => handleFieldBlur('orgGstin')}
                                    placeholder="GSTIN"
                                />
                            </span>
                        )}
                        {state.header.orgEmail && (
                            <span>
                                Email:{' '}
                                <input
                                    type="email"
                                    className="bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors inline-block min-w-[150px]"
                                    value={getValue('orgEmail')}
                                    onChange={(e) => handleFieldChange('orgEmail', e.target.value)}
                                    onFocus={() => handleFieldFocus('orgEmail')}
                                    onBlur={() => handleFieldBlur('orgEmail')}
                                    placeholder="Email"
                                />
                            </span>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

