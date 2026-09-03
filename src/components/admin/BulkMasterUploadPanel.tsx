import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import {
  ACTIVE_UPLOAD_STORAGE_KEY,
  EntityMasterBulkStatusResponse,
  EntityMasterBulkUploadListItem,
  entityMasterBulkService,
} from '../../services/entityMasterBulkService';

type BulkMasterUploadPanelProps = {
  /** compact: link-only banner for module screens; full: download + upload controls */
  variant?: 'full' | 'compact';
  className?: string;
};

const FILE_PHASES = ['queued', 'processing', 'parsing', 'applying', 'completed'] as const;

function statusLabel(status: string): string {
  const s = (status || '').toLowerCase();
  if (s.includes('queued')) return 'Queued';
  if (s.includes('processing') || s === 'parsing' || s === 'applying') return 'Processing';
  if (s === 'completed') return 'Completed';
  if (s === 'failed' || s === 'cancelled') return 'Failed';
  return status || 'Unknown';
}

function statusChipClass(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (s === 'failed' || s === 'cancelled') return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
  if (s.includes('queued')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200';
}

function formatWhen(value?: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDuration(start?: string | null, end?: string | null): string {
  if (!start) return '—';
  const a = new Date(start).getTime();
  const b = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return '—';
  const sec = Math.round((b - a) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

function progressPercent(data: EntityMasterBulkStatusResponse | null): number {
  if (!data) return 0;
  const status = (data.status || '').toLowerCase();
  if (status === 'completed') return 100;
  if (status === 'failed') return 100;

  const tp = data.tasksProgress;
  if (tp && tp.maxRow > 0) {
    // Master sheets ~40%, tasks sheet ~60% of the bar for file-level uploads
    const taskPct = Math.min(100, Math.round((tp.scanned / tp.maxRow) * 100));
    return Math.min(99, 40 + Math.round(taskPct * 0.6));
  }

  const total = data.totalRows ?? 0;
  if (total > 0) {
    const done = (data.processedCount || 0) + (data.failedCount || 0);
    return Math.min(100, Math.round((done / total) * 100));
  }

  // File-level stepped phases
  const phase = (data.phase || status || 'queued').toLowerCase();
  const idx = FILE_PHASES.indexOf(phase as (typeof FILE_PHASES)[number]);
  if (idx < 0) return status.includes('processing') ? 35 : 8;
  if (phase === 'completed') return 100;
  return Math.round((idx / (FILE_PHASES.length - 1)) * 100);
}

function phaseCaption(data: EntityMasterBulkStatusResponse | null): string {
  if (!data) return 'Waiting…';
  const phase = (data.phase || data.status || '').toLowerCase();
  const tp = data.tasksProgress;
  if (phase === 'applying' && tp) {
    return `Creating tasks… ${tp.created} created, ${tp.scanned} rows scanned` +
      (tp.maxRow ? ` of ~${tp.maxRow}` : '') +
      (tp.errors ? `, ${tp.errors} issues` : '') +
      '. Large Task sheets can take several minutes.';
  }
  if (phase.includes('queued')) {
    return 'Queued — processing usually starts within about 1 minute.';
  }
  if (phase === 'parsing') return 'Parsing organisation, services, clients, and employees…';
  if (phase === 'applying') return 'Applying Tasks sheet… large files can take several minutes.';
  if (phase.includes('processing')) return 'Processing upload…';
  if (phase === 'completed') return 'Upload finished.';
  if (phase === 'failed') return 'Upload failed.';
  return statusLabel(data.status);
}

export const BulkMasterUploadPanel: React.FC<BulkMasterUploadPanelProps> = ({
  variant = 'full',
  className = '',
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<EntityMasterBulkStatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const pollStartedRef = useRef<string | null>(null);

  const historyQuery = useQuery(
    ['entity-master-bulk-uploads'],
    async () => {
      const res = await entityMasterBulkService.listUploads(20);
      return res.data?.data?.uploads ?? [];
    },
    {
      enabled: variant === 'full',
      refetchInterval: isPolling ? 5000 : false,
    }
  );

  const invalidateMasters = useCallback(() => {
    queryClient.invalidateQueries('admin-organization');
    queryClient.invalidateQueries(['client-entities']);
    queryClient.invalidateQueries('employees');
    queryClient.invalidateQueries(['task-services']);
    queryClient.invalidateQueries('organization-structure');
    queryClient.invalidateQueries(['entity-master-bulk-uploads']);
  }, [queryClient]);

  const finishPolling = useCallback(
    (status: EntityMasterBulkStatusResponse) => {
      setLiveStatus(status);
      setIsPolling(false);
      pollStartedRef.current = null;
      try {
        sessionStorage.removeItem(ACTIVE_UPLOAD_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setActiveUploadId(null);

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
      invalidateMasters();
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    },
    [invalidateMasters, toast]
  );

  const startPolling = useCallback(
    async (uploadId: string) => {
      if (pollStartedRef.current === uploadId) return;
      pollStartedRef.current = uploadId;
      setActiveUploadId(uploadId);
      setIsPolling(true);
      try {
        sessionStorage.setItem(ACTIVE_UPLOAD_STORAGE_KEY, uploadId);
      } catch {
        /* ignore */
      }
      try {
        const status = await entityMasterBulkService.pollUntilDone(uploadId, (data) => {
          setLiveStatus(data);
        });
        finishPolling(status);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to get upload status';
        toast.error(message);
        setIsPolling(false);
        pollStartedRef.current = null;
      }
    },
    [finishPolling, toast]
  );

  // Resume polling after refresh (once)
  useEffect(() => {
    if (variant !== 'full') return;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(ACTIVE_UPLOAD_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored) {
      void startPolling(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once on mount
  }, [variant]);

  const bulkUploadMutation = useMutation(
    (file: File) => entityMasterBulkService.uploadFile(file),
    {
      onSuccess: async (res) => {
        const data = res.data?.data;
        if (!data?.uploadId) {
          if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
          return;
        }
        setLiveStatus({
          status: data.status || 'queued_v2',
          processedCount: 0,
          failedCount: 0,
          phase: 'queued',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
        });
        await startPolling(data.uploadId);
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

  const uploads = historyQuery.data ?? [];
  const analytics = useMemo(() => {
    const total = uploads.length;
    const completed = uploads.filter((u) => u.status === 'completed').length;
    const failed = uploads.filter((u) => u.status === 'failed').length;
    const rowsProcessed = uploads.reduce((sum, u) => sum + (u.processedCount || 0), 0);
    const rowsFailed = uploads.reduce(
      (sum, u) => sum + Math.max(u.failedCount || 0, u.errorCount || 0),
      0
    );
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, failed, rowsProcessed, rowsFailed, successRate };
  }, [uploads]);

  const pct = progressPercent(liveStatus);
  const busy = bulkUploadMutation.isLoading || isPolling;

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
    <div className={`space-y-4 ${className}`}>
      <input
        ref={bulkFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleBulkFileChange}
        className="hidden"
      />
      <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleDownloadTemplate}
          disabled={isDownloadingTemplate}
          className="px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary/50 text-gray-700 dark:text-gray-200 rounded-xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap disabled:opacity-50 transition-all"
        >
          <span className="material-icons-outlined text-[18px]">download</span>
          {isDownloadingTemplate ? 'Downloading…' : 'Download Master Bulk'}
        </button>
        <button
          type="button"
          onClick={() => bulkFileInputRef.current?.click()}
          disabled={busy}
          className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap disabled:opacity-50 transition-all shadow-lg shadow-primary/30"
        >
          <span className="material-icons-outlined text-[18px]">upload</span>
          {busy ? 'Uploading…' : 'Upload Master Bulk'}
        </button>
      </div>

      {(liveStatus || isPolling || activeUploadId) && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-icons-outlined text-primary text-[20px]">cloud_upload</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {liveStatus?.filename || 'Master bulk upload'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{phaseCaption(liveStatus)}</p>
              </div>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusChipClass(
                liveStatus?.status || 'queued'
              )}`}
            >
              {statusLabel(liveStatus?.status || 'queued')}
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Progress</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (liveStatus?.status || '').toLowerCase() === 'failed'
                    ? 'bg-rose-500'
                    : 'bg-primary'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Processed</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {liveStatus?.processedCount ?? 0}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Failed</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {liveStatus?.failedCount ?? 0}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total rows</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {liveStatus?.totalRows && liveStatus.totalRows > 0 ? liveStatus.totalRows : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Phase</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize">
                {liveStatus?.phase || statusLabel(liveStatus?.status || 'queued')}
              </p>
            </div>
          </div>

          {liveStatus?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(
                [
                  ['Structure', liveStatus.summary.organization_structure_nodes],
                  ['Services', liveStatus.summary.task_services],
                  ['Clients', liveStatus.summary.client_entities],
                  ['Employees', liveStatus.summary.employees],
                  ['Tasks', liveStatus.summary.tasks],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-2 text-center"
                >
                  <p className="text-[11px] text-slate-500">{label}</p>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-100">{value ?? 0}</p>
                </div>
              ))}
            </div>
          )}

          {!!liveStatus?.errors?.length && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 p-2 space-y-1">
              {liveStatus.errors.slice(0, 50).map((e, idx) => (
                <p key={`${e.sheet}-${e.row}-${idx}`} className="text-xs text-rose-800 dark:text-rose-200">
                  {e.sheet ? `[${e.sheet}] ` : ''}
                  {typeof e.row === 'number' ? `Row ${e.row}: ` : ''}
                  {e.message || 'Unknown error'}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Upload history</h3>
          <button
            type="button"
            onClick={() => historyQuery.refetch()}
            className="text-xs font-medium text-primary hover:underline"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-500">Uploads (20)</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{analytics.total}</p>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-500">Success rate</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{analytics.successRate}%</p>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-500">Rows processed</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{analytics.rowsProcessed}</p>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-500">Failures</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {analytics.failed} / {analytics.rowsFailed}
            </p>
          </div>
        </div>

        {historyQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading history…</p>
        ) : uploads.length === 0 ? (
          <p className="text-sm text-slate-500">No uploads yet. Download the master workbook and upload it here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-semibold">File</th>
                  <th className="py-2 pr-3 font-semibold">When</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Rows</th>
                  <th className="py-2 pr-3 font-semibold">Duration</th>
                  <th className="py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {uploads.map((u: EntityMasterBulkUploadListItem) => {
                  const expanded = expandedHistoryId === u.id;
                  return (
                    <React.Fragment key={u.id}>
                      <tr className="border-b border-slate-100 dark:border-slate-800 align-top">
                        <td className="py-2.5 pr-3 font-medium text-slate-800 dark:text-slate-100 max-w-[180px] truncate">
                          {u.filename}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatWhen(u.createdAt)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusChipClass(
                              u.status
                            )}`}
                          >
                            {statusLabel(u.status)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {u.processedCount} ok / {u.failedCount} fail
                          {u.totalRows > 0 ? ` of ${u.totalRows}` : ''}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatDuration(u.createdAt, u.completedAt)}
                        </td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            onClick={() => setExpandedHistoryId(expanded ? null : u.id)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {expanded ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/30">
                          <td colSpan={6} className="py-3 px-2">
                            {u.summary ? (
                              <div className="flex flex-wrap gap-3 mb-2 text-xs text-slate-600 dark:text-slate-300">
                                <span>Structure: {u.summary.organization_structure_nodes ?? 0}</span>
                                <span>Services: {u.summary.task_services ?? 0}</span>
                                <span>Clients: {u.summary.client_entities ?? 0}</span>
                                <span>Employees: {u.summary.employees ?? 0}</span>
                                <span>Tasks: {u.summary.tasks ?? 0}</span>
                                <span>Errors: {u.summary.totalErrors ?? u.errorCount ?? 0}</span>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 mb-2">
                                Type: {u.uploadType} · Errors: {u.errorCount}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-400">
                              Updated {formatWhen(u.updatedAt)}
                              {u.completedAt ? ` · Completed ${formatWhen(u.completedAt)}` : ''}
                            </p>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
