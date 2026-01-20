import React, { useState, useRef, useEffect } from 'react';
import { useDocumentBuilder, TextBlock } from '../../DocumentBuilderProvider';

interface EditableTextBlockProps {
    section: TextBlock;
}

export const EditableTextBlock: React.FC<EditableTextBlockProps> = ({ section }) => {
    const { dispatch } = useDocumentBuilder();
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(section.content || '');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setContent(section.content || '');
    }, [section.content]);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(
                textareaRef.current.value.length,
                textareaRef.current.value.length
            );
        }
    }, [isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        if (content !== section.content) {
            dispatch({
                type: 'UPDATE_SECTION_DATA',
                payload: { sectionId: section.id, data: { content } }
            });
        }
    };

    const handleDoubleClick = () => {
        setIsEditing(true);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            setContent(section.content || '');
            setIsEditing(false);
        } else if (e.key === 'Enter' && e.ctrlKey) {
            handleBlur();
        }
    };

    if (isEditing) {
        return (
            <div className="mb-4 relative">
                <textarea
                    ref={textareaRef}
                    className="w-full text-sm border-2 border-primary rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white resize-none"
                    rows={Math.max(3, content.split('\n').length)}
                    value={content}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter text content..."
                />
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    Press Ctrl+Enter to save, Esc to cancel
                </div>
            </div>
        );
    }

    return (
        <div
            className="mb-4 text-sm min-h-[24px] p-2 rounded-md transition-all cursor-text hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border hover:border-gray-300 dark:hover:border-gray-600"
            onDoubleClick={handleDoubleClick}
            title="Double-click to edit"
        >
            {content || (
                <span className="text-gray-400 italic">Double-click to add text</span>
            )}
        </div>
    );
};

