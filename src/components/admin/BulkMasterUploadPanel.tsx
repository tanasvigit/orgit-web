import React, { useRef, useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { entityMasterBulkService } from '../../services/entityMasterBulkService';

type BulkMasterUploadPanelProps = {
  /** compact: link-only banner for module screens; full: download + upload controls */
  variant?: 'full' | 'compact';
  className?: string;
};

export const BulkMasterUploadPanel: React.FC<BulkMasterUploadPanelProps> = ({
  variant = 'full',
  className = '',
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const bulkUploadMutation = useMutation(
    (file: File) => entityMasterBulkService.uploadFile(file),
    {
      onSuccess: async (res) => {
        const data = res.data?.data;
        if (!data?.uploadId) {
          if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
          return;
        }
        try {
          const status = await entityMasterBulkService.pollUntilDone(data.uploadId);
          if (status.status === 'completed') {
            const s = status.summary;
            const summaryLine = s
              ? `Structure:${s.organization_structure_nodes ?? 0}, Services:${s.task_services ?? 0}, Clients:${s.client_entities ?? 0}, Employees:${s.employees ?? 0}, Tasks:${s.tasks ?? 0}`
              : null;
            toast.success(
              summaryLine ? `Master bulk upload completed. ${summaryLine}` : 'Master bulk upload completed.'
            );
          } else {
            toast.info('Bulk upload finished with errors.');
          }
          if (status.errors?.length) {
            status.errors.slice(0, 8).forEach((e) => {
              const prefix = `${e.sheet ? `[${e.sheet}]` : '[Sheet?]'}${typeof e.row === 'number' ? ` Row ${e.row}` : ''}`;
              toast.error(`${prefix}: ${e.message || 'Unknown error'}`);
            });
            if (status.errors.length > 8) {
              toast.error(`… and ${status.errors.length - 8} more errors`);
            }
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to get upload status';
          toast.error(message);
        }
        queryClient.invalidateQueries('admin-organization');
        queryClient.invalidateQueries(['client-entities']);
        queryClient.invalidateQueries('employees');
        queryClient.invalidateQueries(['task-services']);
        queryClient.invalidateQueries('organization-structure');
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
      },
      onError: (error: { response?: { data?: { error?: string } }; message?: string }) => {
        toast.error(error.response?.data?.error || error.message || 'Upload failed');
      },
    }
  );

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await entityMasterBulkService.getTemplate();
      toast.success(
        'OrgIt Master Bulk workbook downloaded. Fill Organisation Structure first, then Service List, Client List, Employees, and Tasks.'
      );
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      toast.error(err.response?.data?.error || err.message || 'Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      e.target.value = '';
      return;
    }
    bulkUploadMutation.mutate(file);
  };

  if (variant === 'compact') {
    return (
      <div
        className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 ${className}`}
      >
        Bulk Excel upload is centralized in{' '}
        <Link to="/admin/settings" className="font-semibold text-primary hover:underline">
          Settings → Master bulk upload
        </Link>
        . Download <strong>OrgIt_Master_Bulk.xlsx</strong> once and fill all sheets in order.
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={bulkFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleBulkFileChange}
        className="hidden"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDownloadTemplate}
          disabled={isDownloadingTemplate}
          className="px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary/50 text-gray-700 dark:text-gray-200 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition-all"
        >
          <span className="material-icons-outlined text-[18px]">download</span>
          {isDownloadingTemplate ? 'Downloading…' : 'Download Master Bulk'}
        </button>
        <button
          type="button"
          onClick={() => bulkFileInputRef.current?.click()}
          disabled={bulkUploadMutation.isLoading}
          className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-primary/30"
        >
          <span className="material-icons-outlined text-[18px]">upload</span>
          {bulkUploadMutation.isLoading ? 'Uploading…' : 'Upload Master Bulk'}
        </button>
      </div>
    </div>
  );
};
