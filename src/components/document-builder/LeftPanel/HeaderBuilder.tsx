import React from 'react';
import { useDocumentBuilder } from '../DocumentBuilderProvider';

export const HeaderBuilder: React.FC = () => {
    const { state, dispatch } = useDocumentBuilder();

    return (
        <div className="space-y-8">
            {/* Logo Configuration */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                        Show Company Logo
                    </label>
                    <button
                        onClick={() =>
                            dispatch({
                                type: 'UPDATE_HEADER',
                                payload: { showLogo: !state.header.showLogo },
                            })
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${state.header.showLogo ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.header.showLogo ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>
                <div className="text-xs text-gray-500">
                    Logo will be pulled automatically from Entity Master settings.
                </div>
            </div>

            {/* Org Details Configuration */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                        Show Organization Details
                    </label>
                    <button
                        onClick={() =>
                            dispatch({
                                type: 'UPDATE_HEADER',
                                payload: { orgDetailsVisible: !state.header.orgDetailsVisible },
                            })
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${state.header.orgDetailsVisible ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.header.orgDetailsVisible ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>
                {state.header.orgDetailsVisible && (
                    <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded text-xs text-gray-500 font-mono border border-gray-200 dark:border-gray-700">
                        Includes: Name, Address, GSTIN, PAN, Email, Phone
                    </div>
                )}
            </div>

            {/* Layout Configuration */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                    Header Layout
                </label>
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() =>
                            dispatch({ type: 'UPDATE_HEADER', payload: { layout: 'left' } })
                        }
                        className={`p-2 border rounded-lg flex flex-col items-start gap-2 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all ${state.header.layout === 'left'
                                ? 'border-primary ring-1 ring-primary bg-primary/5'
                                : 'border-gray-200 dark:border-gray-700'
                            }`}
                    >
                        <div className="flex gap-1 w-full">
                            <div className="w-3 h-3 bg-gray-300 rounded"></div>
                            <div className="flex-1 space-y-1">
                                <div className="h-1 w-full bg-gray-200 rounded"></div>
                                <div className="h-1 w-2/3 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                        <div className="text-[10px] text-gray-500 font-medium">Left Aligned</div>
                    </button>

                    <button
                        onClick={() =>
                            dispatch({ type: 'UPDATE_HEADER', payload: { layout: 'center' } })
                        }
                        className={`p-2 border rounded-lg flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all ${state.header.layout === 'center'
                                ? 'border-primary ring-1 ring-primary bg-primary/5'
                                : 'border-gray-200 dark:border-gray-700'
                            }`}
                    >
                        <div className="flex flex-col items-center gap-1 w-full">
                            <div className="w-3 h-3 bg-gray-300 rounded mb-1"></div>
                            <div className="h-1 w-full bg-gray-200 rounded"></div>
                            <div className="h-1 w-2/3 bg-gray-200 rounded"></div>
                        </div>
                        <div className="text-[10px] text-gray-500 font-medium">Centered</div>
                    </button>

                    <button
                        onClick={() =>
                            dispatch({ type: 'UPDATE_HEADER', payload: { layout: 'right' } })
                        }
                        className={`p-2 border rounded-lg flex flex-col items-end gap-2 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all ${state.header.layout === 'right'
                                ? 'border-primary ring-1 ring-primary bg-primary/5'
                                : 'border-gray-200 dark:border-gray-700'
                            }`}
                    >
                        <div className="flex flex-row-reverse gap-1 w-full">
                            <div className="w-3 h-3 bg-gray-300 rounded"></div>
                            <div className="flex-1 space-y-1 flex flex-col items-end">
                                <div className="h-1 w-full bg-gray-200 rounded"></div>
                                <div className="h-1 w-2/3 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                        <div className="text-[10px] text-gray-500 font-medium">Right Aligned</div>
                    </button>
                </div>
            </div>
        </div>
    );
};
