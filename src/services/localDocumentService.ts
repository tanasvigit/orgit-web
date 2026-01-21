interface LocalDocument {
  id: string;
  title: string;
  category?: string;
  description?: string;
  fileName: string;
  originalName: string;
  fileData: Blob;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  updatedAt: string;
  status: 'draft' | 'final' | 'archived';
}

const DB_NAME = 'orgit_documents_db';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

// Initialize IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('title', 'title', { unique: false });
        objectStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        objectStore.createIndex('status', 'status', { unique: false });
      }
    };
  });
};

// Upload document
export const uploadDocument = async (
  title: string,
  file: File,
  category?: string,
  description?: string
): Promise<LocalDocument> => {
  try {
    const db = await initDB();
    const fileData = await file.arrayBuffer();
    const blob = new Blob([fileData], { type: file.type });

    const document: LocalDocument = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      category: category || undefined,
      description: description || undefined,
      fileName: `${Date.now()}_${file.name}`,
      originalName: file.name,
      fileData: blob,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(document);

      request.onsuccess = () => resolve(document);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

// Get all documents
export const getDocuments = async (filters?: {
  status?: string;
  search?: string;
}): Promise<LocalDocument[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let documents = request.result as LocalDocument[];

        // Apply filters
        if (filters) {
          if (filters.status) {
            documents = documents.filter(doc => doc.status === filters.status);
          }
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            documents = documents.filter(doc =>
              doc.title.toLowerCase().includes(searchLower) ||
              doc.originalName.toLowerCase().includes(searchLower)
            );
          }
        }

        // Sort by uploadedAt descending
        documents.sort((a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );

        resolve(documents);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting documents:', error);
    return [];
  }
};

// Get document by ID
export const getDocumentById = async (id: string): Promise<LocalDocument | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting document:', error);
    return null;
  }
};

// View document (open in new tab)
export const viewDocument = async (id: string): Promise<void> => {
  try {
    const document = await getDocumentById(id);
    if (!document) {
      throw new Error('Document not found');
    }

    const url = URL.createObjectURL(document.fileData);
    window.open(url, '_blank');
    
    // Clean up URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('Error viewing document:', error);
    throw error;
  }
};

// Download document
export const downloadDocument = async (id: string): Promise<void> => {
  try {
    const document = await getDocumentById(id);
    if (!document) {
      throw new Error('Document not found');
    }

    // Use File System Access API if available (Chrome/Edge)
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: document.originalName,
          types: [{
            description: 'Document',
            accept: { [document.fileType]: [`.${document.fileType.split('/')[1]}`] },
          }],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(document.fileData);
        await writable.close();
        return;
      } catch (error: any) {
        // User canceled or error, fall back to blob download
        if (error.name !== 'AbortError') {
          console.log('File System Access API failed, using blob download');
        } else {
          return; // User canceled
        }
      }
    }

    // Fallback: Create blob URL and download
    const url = URL.createObjectURL(document.fileData);
    const link = document.createElement('a');
    link.href = url;
    link.download = document.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading document:', error);
    throw error;
  }
};

// Delete document
export const deleteDocument = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

// Update document metadata
export const updateDocument = async (
  id: string,
  updates: Partial<Pick<LocalDocument, 'title' | 'category' | 'description' | 'status'>>
): Promise<LocalDocument> => {
  try {
    const document = await getDocumentById(id);
    if (!document) {
      throw new Error('Document not found');
    }

    const updated: LocalDocument = {
      ...document,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(updated);

      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

// Get document blob URL for viewing
export const getDocumentBlobUrl = async (id: string): Promise<string | null> => {
  try {
    const document = await getDocumentById(id);
    if (!document) {
      return null;
    }

    return URL.createObjectURL(document.fileData);
  } catch (error) {
    console.error('Error getting blob URL:', error);
    return null;
  }
};

