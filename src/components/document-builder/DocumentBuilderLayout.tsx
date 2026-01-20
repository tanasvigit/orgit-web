import React, { useState } from 'react';
import { DocumentBuilderProvider, useDocumentBuilder } from './DocumentBuilderProvider';
import { SectionList } from './LeftPanel/SectionList';
import { TemplateConfig } from './LeftPanel/TemplateConfig';
import { HeaderBuilder } from './LeftPanel/HeaderBuilder';
import { EditableDocumentEditor } from './RightPanel/EditableDocumentEditor';
import { FillerSidebar } from './LeftPanel/FillerSidebar';

export const DocumentBuilderContent: React.FC = () => {
    const { state } = useDocumentBuilder();
    const [activeTab, setActiveTab] = useState<'config' | 'sections' | 'header'>('sections');

    return (
        <div className="flex h-full overflow-hidden bg-gray-100 dark:bg-gray-900">
            {/* Left Panel - Configuration & Builder (only in design mode) */}
            {state.mode === 'design' && (
                <div className="w-[450px] flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2632] shadow-sm z-10">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'config'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            Config
                        </button>
                        <button
                            onClick={() => setActiveTab('header')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'header'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            Header
                        </button>
                        <button
                            onClick={() => setActiveTab('sections')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'sections'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            Sections
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {activeTab === 'config' && <TemplateConfig />}
                        {activeTab === 'header' && <HeaderBuilder />}
                        {activeTab === 'sections' && <SectionList />}
                    </div>
                </div>
            )}

            {/* Main Panel - Editable Document Editor */}
            <div className={`${state.mode === 'design' ? 'flex-1' : 'w-full'} overflow-auto p-8 flex justify-center bg-gray-100 dark:bg-gray-900`}>
                <EditableDocumentEditor />
            </div>
        </div>
    );
};

export const DocumentBuilderLayout: React.FC = () => {
    return (
        <DocumentBuilderProvider>
            <DocumentBuilderContent />
        </DocumentBuilderProvider>
    );
};
