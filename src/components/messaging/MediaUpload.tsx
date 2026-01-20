import React, { useRef, useState } from 'react';

interface MediaUploadProps {
  onSelect: (file: File, type: 'image' | 'video' | 'audio' | 'document') => void;
  onClose: () => void;
  visible: boolean;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({ onSelect, onClose, visible }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  if (!visible) return null;

  const handleFileSelect = (file: File) => {
    const fileType = file.type;
    let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';

    if (fileType.startsWith('image/')) {
      mediaType = 'image';
    } else if (fileType.startsWith('video/')) {
      mediaType = 'video';
    } else if (fileType.startsWith('audio/')) {
      mediaType = 'audio';
    }

    onSelect(file, mediaType);
    onClose();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const openFilePicker = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-t-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Send Media</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => openFilePicker('image/*')}
              className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <span className="material-symbols-outlined text-4xl text-primary">image</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Photo</span>
            </button>

            <button
              onClick={() => openFilePicker('video/*')}
              className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <span className="material-symbols-outlined text-4xl text-primary">videocam</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Video</span>
            </button>

            <button
              onClick={() => openFilePicker('audio/*')}
              className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <span className="material-symbols-outlined text-4xl text-primary">audiotrack</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Audio</span>
            </button>

            <button
              onClick={() => openFilePicker('*/*')}
              className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <span className="material-symbols-outlined text-4xl text-primary">description</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Document</span>
            </button>
          </div>

          {dragActive && (
            <div className="border-2 border-dashed border-primary rounded-lg p-8 text-center bg-primary/5">
              <p className="text-primary font-medium">Drop file here</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      </div>
    </div>
  );
};

