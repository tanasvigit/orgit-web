import React, { useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDocumentBuilder, SectionType } from '../DocumentBuilderProvider';
import { SectionEditor } from './SectionEditor';

// --- Sortable Item Component ---

interface SortableItemProps {
    id: string;
    section: any;
    isActive: boolean;
    onActivate: () => void;
    onDelete: () => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, section, isActive, onActivate, onDelete }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative border rounded-lg bg-white dark:bg-slate-800 transition-all mb-3 ${isActive
                    ? 'border-primary ring-1 ring-primary shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
        >
            {/* Header / Drag Handle */}
            <div
                className={`flex items-center p-3 cursor-pointer ${isActive ? 'bg-primary/5' : ''}`}
                onClick={onActivate}
            >
                <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600 p-1 mr-2 touch-none">
                    <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {section.label || section.type.toUpperCase()}
                    </h4>
                    <p className="text-xs text-gray-500 capitalize">{section.type} Block</p>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this section?')) onDelete();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
            </div>

            {/* Expanded Editor */}
            {isActive && (
                <div className="p-3 border-t border-gray-100 dark:border-gray-700">
                    <SectionEditor section={section} />
                </div>
            )}
        </div>
    );
};

// --- Main List Component ---

export const SectionList: React.FC = () => {
    const { state, dispatch } = useDocumentBuilder();
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            const oldIndex = state.sections.findIndex((s) => s.id === active.id);
            const newIndex = state.sections.findIndex((s) => s.id === over?.id);
            dispatch({ type: 'REORDER_SECTIONS', payload: { fromIndex: oldIndex, toIndex: newIndex } });
        }
    };

    const addSection = (type: SectionType) => {
        dispatch({ type: 'ADD_SECTION', payload: { type } });
        // We'll auto-expand the new section. Since we don't have the ID yet (generated in reducer),
        // we might just let user click it. Or we could sync ID generation if critical.
        // For now, simple add.
    };

    return (
        <div className="space-y-6">
            {/* Helper Actions */}
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={() => addSection('text')}
                    className="flex items-center justify-center gap-2 p-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">text_fields</span>
                    Add Text
                </button>
                <button
                    onClick={() => addSection('table')}
                    className="flex items-center justify-center gap-2 p-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">table_chart</span>
                    Add Table
                </button>
                <button
                    onClick={() => addSection('signature')}
                    className="flex items-center justify-center gap-2 p-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors col-span-2"
                >
                    <span className="material-symbols-outlined text-[18px]">ink_pen</span>
                    Add Signature
                </button>
            </div>

            {/* Draggable List */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={state.sections.map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {state.sections.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            No sections added. Click buttons above to start.
                        </div>
                    ) : (
                        <div>
                            {state.sections.map((section) => (
                                <SortableItem
                                    key={section.id}
                                    id={section.id}
                                    section={section}
                                    isActive={section.id === activeSectionId}
                                    onActivate={() => setActiveSectionId(activeSectionId === section.id ? null : section.id)}
                                    onDelete={() => dispatch({ type: 'REMOVE_SECTION', payload: section.id })}
                                />
                            ))}
                        </div>
                    )}
                </SortableContext>
            </DndContext>
        </div>
    );
};
