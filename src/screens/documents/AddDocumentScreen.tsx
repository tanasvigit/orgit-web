import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopAppBar, Button } from '../../components/shared';
import { uploadDocument } from '../../services/localDocumentService';

export const AddDocumentScreen: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a PDF, DOC, or DOCX file');
        return;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }

      setSelectedFile(file);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    if (!title.trim()) {
      alert('Please enter a document title');
      return;
    }

    try {
      setUploading(true);
      await uploadDocument(title.trim(), selectedFile, category || undefined, description || undefined);
      alert('Document uploaded successfully!');
      navigate('/documents');
    } catch (error: any) {
      alert(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <TopAppBar title="Upload Document" onBack={() => navigate(-1)} />
      <div className="p-4 max-w-2xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Upload Local Document</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Document Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title"
                className="w-full rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2 px-3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Enter category (optional)"
                className="w-full rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2 px-3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description (optional)"
                rows={3}
                className="w-full rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2 px-3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select File * (PDF, DOC, DOCX - Max 10MB)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              >
                {selectedFile ? (
                  <div>
                    <span className="material-symbols-outlined text-4xl text-primary mb-2">description</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <span className="material-symbols-outlined text-4xl text-gray-400 dark:text-gray-500 mb-2">cloud_upload</span>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Click to select file or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      PDF, DOC, DOCX (Max 10MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !title.trim()}
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

