import React from 'react';
import { useDocumentBuilder, TableBlock, TextBlock, KeyValueBlock, SignatureBlock, AmountSummaryBlock } from '../DocumentBuilderProvider';
import { useAuth } from '../../../context/AuthContext';
import { organizationService } from '../../../services/organizationService';

const TextFiller: React.FC<{ section: TextBlock }> = ({ section }) => {
    // In a real implementation, we would extract {{data}} variables and show inputs.
    // For now, we allow direct editing of the HTML content if it's dynamic text.
    const { dispatch } = useDocumentBuilder();

    return (
        <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                {section.label || 'Text Section'}
            </label>
            <textarea
                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                rows={3}
                value={section.content}
                onChange={(e) => dispatch({
                    type: 'UPDATE_SECTION_DATA',
                    payload: { sectionId: section.id, data: { content: e.target.value } }
                })}
            />
        </div>
    );
};

const TableFiller: React.FC<{ section: TableBlock }> = ({ section }) => {
    const { dispatch } = useDocumentBuilder();
    const rows = section.rows || [];

    const handleAddRow = () => {
        const newRow = {};
        dispatch({
            type: 'UPDATE_SECTION_DATA',
            payload: { sectionId: section.id, data: { rows: [...rows, newRow] } }
        });
    };

    const handleUpdateRow = (index: number, key: string, value: any) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], [key]: value };
        dispatch({
            type: 'UPDATE_SECTION_DATA',
            payload: { sectionId: section.id, data: { rows: newRows } }
        });
    };

    const handleRemoveRow = (index: number) => {
        const newRows = [...rows];
        newRows.splice(index, 1);
        dispatch({
            type: 'UPDATE_SECTION_DATA',
            payload: { sectionId: section.id, data: { rows: newRows } }
        });
    }

    return (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <label className="text-sm font-bold text-gray-800">
                    {section.label || 'Table Details'}
                </label>
                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">
                    {rows.length} {rows.length === 1 ? 'Item' : 'Items'}
                </span>
            </div>

            <div className="space-y-4">
                {rows.map((row, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative group transition-colors hover:border-blue-200">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Item #{idx + 1}</span>
                            <button
                                onClick={() => handleRemoveRow(idx)}
                                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                title="Remove row"
                            >
                                <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {section.columns?.map(col => (
                                <div key={col.id} className={`${col.width === '40%' || col.header.toLowerCase().includes('item') ? 'col-span-2' : 'col-span-1'}`}>
                                    <label className="block text-[10px] text-gray-500 font-medium mb-1">{col.header}</label>
                                    <input
                                        type={col.type === 'number' || col.type === 'amount' ? 'number' : 'text'}
                                        className="w-full text-xs border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-primary focus:border-primary"
                                        value={row[col.key] || ''}
                                        placeholder={`Enter ${col.header.toLowerCase()}`}
                                        onChange={(e) => handleUpdateRow(idx, col.key, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {rows.length === 0 && (
                    <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-lg">
                        <p className="text-xs text-gray-400">No items added yet</p>
                    </div>
                )}
            </div>

            <button
                onClick={handleAddRow}
                className="mt-4 w-full py-2 text-xs font-bold text-primary bg-blue-50 border border-primary border-dashed rounded-lg hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
            >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                Add New Item
            </button>
        </div>
    );
};

const KeyValueFiller: React.FC<{ section: KeyValueBlock }> = ({ section }) => {
    const { dispatch } = useDocumentBuilder();
    const items = section.items || [];

    const handleUpdateItem = (itemId: string, newValue: string) => {
        const newItems = items.map(item =>
            item.id === itemId ? { ...item, value: newValue } : item
        );
        dispatch({
            type: 'UPDATE_SECTION_DATA',
            payload: { sectionId: section.id, data: { items: newItems } }
        });
    };

    return (
        <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                {section.label || 'Details'}
            </label>
            <div className="space-y-3">
                {items.map(item => (
                    <div key={item.id}>
                        <label className="block text-xs text-gray-600 mb-1">{item.key}</label>
                        <input
                            type="text" // Could detect date/number types based on key name heuristics if strictly needed, but text covers all
                            className="w-full text-xs border-gray-300 rounded px-2 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary"
                            value={item.value || ''}
                            onChange={(e) => handleUpdateItem(item.id, e.target.value)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

const SignatureFiller: React.FC<{ section: SignatureBlock }> = ({ section }) => {
    const { dispatch } = useDocumentBuilder();

    return (
        <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                {section.label || 'Signature'}
            </label>
            <div>
                <label className="block text-xs text-gray-600 mb-1">Signatory Label</label>
                <input
                    type="text"
                    className="w-full text-xs border-gray-300 rounded px-2 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary"
                    value={section.signatoryLabel || ''}
                    onChange={(e) => dispatch({
                        type: 'UPDATE_SECTION_DATA',
                        payload: { sectionId: section.id, data: { signatoryLabel: e.target.value } }
                    })}
                    placeholder="e.g. Authorized Signatory"
                />
            </div>
        </div>
    );
};

const AmountSummaryFiller: React.FC<{ section: AmountSummaryBlock }> = ({ section }) => {
    const { state, dispatch } = useDocumentBuilder();
    const fields = section.fields || [];

    // Calculate grand total from all tables
    const grandTotal = state.sections.reduce((total, s) => {
        if (s.type === 'table') {
            const table = s as TableBlock;
            // Find correct amount column - prioritize key === 'amount'
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

    const handleUpdateField = (index: number, newLabel: string) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], label: newLabel };
        dispatch({
            type: 'UPDATE_SECTION_DATA',
            payload: { sectionId: section.id, data: { fields: newFields } }
        });
    };

    return (
        <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                {section.label || 'Summary'}
            </label>
            <div className="space-y-3">
                {fields.map((field, idx) => {
                    const isTotal = field.label.toLowerCase().includes('total');
                    return (
                        <div key={idx} className={isTotal ? 'bg-blue-50 p-2 rounded border border-blue-100' : ''}>
                            <label className="block text-xs text-gray-600 mb-1">
                                {isTotal ? 'Calculated Total' : 'Row Label'}
                            </label>
                            {isTotal ? (
                                <div className="flex justify-between items-center px-2 py-1.5">
                                    <span className="text-xs font-bold text-gray-700">{field.label}</span>
                                    <span className="text-sm font-bold text-primary">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    className="w-full text-xs border-gray-300 rounded px-2 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary"
                                    value={field.label || ''}
                                    onChange={(e) => handleUpdateField(idx, e.target.value)}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const DocumentDataFiller: React.FC = () => {
    const { state, dispatch } = useDocumentBuilder();
    const data = state.documentData;

    const updateData = (payload: Partial<typeof data>) => {
        dispatch({ type: 'SET_DOCUMENT_DATA', payload });
    };

    return (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2">Document Details</h3>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs text-gray-500 font-medium mb-1">To: (Client Name)</label>
                    <input
                        type="text"
                        className="w-full text-sm border-gray-300 rounded px-3 py-2"
                        value={data.clientName || ''}
                        onChange={(e) => updateData({ clientName: e.target.value })}
                        placeholder="Enter Client Name"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs text-gray-500 font-medium mb-1">Date</label>
                        <input
                            type="date"
                            className="w-full text-sm border-gray-300 rounded px-3 py-2"
                            value={data.date || ''}
                            onChange={(e) => updateData({ date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 font-medium mb-1">Reference No.</label>
                        <input
                            type="text"
                            className="w-full text-sm border-gray-300 rounded px-3 py-2 font-mono"
                            value={data.referenceNo || ''}
                            onChange={(e) => updateData({ referenceNo: e.target.value })}
                            placeholder="INV-001"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const HeaderFiller: React.FC = () => {
    const { state, dispatch } = useDocumentBuilder();
    const header = state.header;
    const { user } = useAuth();
    const [isLoadingOrg, setIsLoadingOrg] = React.useState(false);

    const updateHeader = (payload: Partial<typeof header>) => {
        dispatch({ type: 'UPDATE_HEADER', payload });
    };

    const loadFromEntityMaster = async () => {
        if (!user?.organizationId) {
            alert('Organization not found. Please ensure you are associated with an organization.');
            return;
        }

        setIsLoadingOrg(true);
        try {
            const response = user?.role === 'admin' 
                ? await organizationService.getMyOrganization()
                : await organizationService.getById(user.organizationId);
            const orgData = response.data.data;

            const updates: any = {};
            if (orgData.name) updates.orgName = orgData.name;
            if (orgData.address) updates.orgAddress = orgData.address;
            if (orgData.gst) updates.orgGstin = orgData.gst;
            if (orgData.email) updates.orgEmail = orgData.email;
            if (orgData.mobile) updates.orgMobile = orgData.mobile;
            
            if (orgData.logoUrl && header.showLogo) {
                let logoUrl = orgData.logoUrl;
                if (logoUrl.startsWith('/')) {
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                    logoUrl = `${apiUrl}${logoUrl}`;
                }
                updates.orgLogoUrl = logoUrl;
            }

            dispatch({ type: 'UPDATE_HEADER', payload: updates });
        } catch (error: any) {
            console.error('Error loading organization data:', error);
            alert(`Failed to load Entity Master Data: ${error.response?.data?.error || error.message}`);
        } finally {
            setIsLoadingOrg(false);
        }
    };

    return (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
                <h3 className="text-sm font-bold text-gray-800">Business Details</h3>
                <button
                    onClick={loadFromEntityMaster}
                    disabled={isLoadingOrg}
                    className="text-xs px-2 py-1 text-primary hover:text-primary-700 hover:bg-primary/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title="Load from Entity Master Data"
                >
                    <span className="material-symbols-outlined text-sm">refresh</span>
                    <span>Auto-fill</span>
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs text-gray-500 font-medium mb-1">Organization Name</label>
                    <input
                        type="text"
                        className="w-full text-sm border-gray-300 rounded px-3 py-2"
                        value={header.orgName || ''}
                        onChange={(e) => updateHeader({ orgName: e.target.value })}
                        placeholder="Organization Name"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 font-medium mb-1">GSTIN</label>
                    <input
                        type="text"
                        className="w-full text-sm border-gray-300 rounded px-3 py-2 font-mono"
                        value={header.orgGstin || ''}
                        onChange={(e) => updateHeader({ orgGstin: e.target.value })}
                        placeholder="GSTIN Number"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 font-medium mb-1">Address</label>
                    <textarea
                        className="w-full text-sm border-gray-300 rounded px-3 py-2"
                        rows={2}
                        value={header.orgAddress || ''}
                        onChange={(e) => updateHeader({ orgAddress: e.target.value })}
                        placeholder="Full Address"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs text-gray-500 font-medium mb-1">Email</label>
                        <input
                            type="email"
                            className="w-full text-sm border-gray-300 rounded px-3 py-2"
                            value={header.orgEmail || ''}
                            onChange={(e) => updateHeader({ orgEmail: e.target.value })}
                            placeholder="Email"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 font-medium mb-1">Mobile</label>
                        <input
                            type="text"
                            className="w-full text-sm border-gray-300 rounded px-3 py-2"
                            value={header.orgMobile || ''}
                            onChange={(e) => updateHeader({ orgMobile: e.target.value })}
                            placeholder="Mobile"
                        />
                    </div>
                </div>
            </div>
            <p className="mt-3 text-[10px] text-gray-400 italic">
                These details will appear in the document header.
            </p>
        </div>
    );
};

export const FillerSidebar: React.FC = () => {
    const { state } = useDocumentBuilder();

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Document Content</h2>
                <p className="text-xs text-gray-500">Fill in the details below</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/50">
                {/* Header Information Area */}
                {state.header.orgDetailsVisible && <HeaderFiller />}

                {/* Instance Data Area (Client, Date, Ref) */}
                <DocumentDataFiller />

                <div className="my-6 border-t border-gray-200 dark:border-gray-700"></div>

                {state.sections.length === 0 && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 rounded-md">
                        <p className="text-yellow-700 dark:text-yellow-400 text-xs font-medium">
                            No editable sections found in this template.
                        </p>
                        <p className="text-yellow-600 dark:text-yellow-500 text-[10px] mt-1">
                            Please ensure the template was saved correctly by the Super Admin.
                        </p>
                    </div>
                )}

                {state.sections.map(section => {
                    if (section.type === 'text') return <TextFiller key={section.id} section={section as TextBlock} />;
                    if (section.type === 'table') return <TableFiller key={section.id} section={section as TableBlock} />;
                    if (section.type === 'key-value') return <KeyValueFiller key={section.id} section={section as KeyValueBlock} />;
                    if (section.type === 'signature') return <SignatureFiller key={section.id} section={section as SignatureBlock} />;
                    if (section.type === 'amount-summary') return <AmountSummaryFiller key={section.id} section={section as AmountSummaryBlock} />;
                    return null;
                })}
            </div>
        </div>
    );
};
