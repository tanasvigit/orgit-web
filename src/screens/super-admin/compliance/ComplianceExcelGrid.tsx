import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { complianceService } from '../../../services/complianceService';
import { ComplianceMaster } from '../../../../shared/src/types';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Toast } from '../../../components/common/Toast';

interface GridCell {
  rowIndex: number;
  colIndex: number;
}

interface EditableCell extends GridCell {
  value: any;
  field: string;
}

const COLUMN_DEFINITIONS = [
  { key: 'sno', label: 'S No', width: 60, editable: false },
  { key: 'id', label: 'Compliance_ID', width: 200, editable: false },
  { key: 'complianceCode', label: 'Compliance_Code', width: 150, editable: true },
  { key: 'title', label: 'Compliance_Title', width: 200, editable: true },
  { key: 'description', label: 'Compliance_Description', width: 250, editable: true },
  { key: 'category', label: 'Compliance_Category', width: 150, editable: true },
  { key: 'applicableLaw', label: 'Applicable_Law', width: 200, editable: true },
  { key: 'sectionRuleReference', label: 'Section_Rule_Reference', width: 200, editable: true },
  { key: 'governingAuthority', label: 'Governing_Authority', width: 200, editable: true },
  { key: 'jurisdictionType', label: 'Jurisdiction_Type', width: 150, editable: true },
  { key: 'stateApplicability', label: 'State_Applicability', width: 200, editable: true },
  { key: 'industryApplicability', label: 'Industry_Applicability', width: 200, editable: true },
  { key: 'entityTypeApplicability', label: 'Entity_Type_Applicability', width: 200, editable: true },
  { key: 'applicabilityThreshold', label: 'Applicability_Threshold', width: 200, editable: true },
  { key: 'mandatoryFlag', label: 'Mandatory_Flag', width: 120, editable: true },
  { key: 'riskLevel', label: 'Risk_Level', width: 120, editable: true },
  { key: 'penaltySummary', label: 'Penalty_Summary', width: 250, editable: true },
  { key: 'maxPenaltyAmount', label: 'Max_Penalty_Amount', width: 150, editable: true },
  { key: 'imprisonmentFlag', label: 'Imprisonment_Flag', width: 150, editable: true },
  { key: 'complianceFrequency', label: 'Compliance_Frequency', width: 180, editable: true },
  { key: 'dueDateType', label: 'Due_Date_Type', width: 150, editable: true },
  { key: 'dueDate', label: 'Due_Date', width: 120, editable: true },
  { key: 'dueDateRule', label: 'Due_Date_Rule', width: 200, editable: true },
  { key: 'gracePeriodDays', label: 'Grace_Period_Days', width: 150, editable: true },
  { key: 'financialYearApplicable', label: 'Financial_Year_Applicable', width: 200, editable: true },
  { key: 'firstTimeCompliance', label: 'First_Time_Compliance', width: 180, editable: true },
  { key: 'triggerEvent', label: 'Trigger_Event', width: 200, editable: true },
  { key: 'approvalStatus', label: 'Approval_Status', width: 150, editable: true },
  { key: 'status', label: 'Status', width: 100, editable: true },
  { key: 'approvedBy', label: 'Approved_By', width: 150, editable: false },
  { key: 'createdBy', label: 'Created_By', width: 150, editable: false },
  { key: 'createdAt', label: 'Created_Date', width: 150, editable: false },
  { key: 'updatedAt', label: 'Last_Updated_Date', width: 150, editable: false },
];

export const ComplianceExcelGrid: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ComplianceMaster[]>([]);
  const [editingCell, setEditingCell] = useState<GridCell | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  // Fetch all compliance items (no pagination for Excel view)
  // Super Admin should see ALL items including Draft ones
  const { data, isLoading, refetch } = useQuery(
    ['compliance', 'all'],
    () => complianceService.getAll({ limit: 1000 }).then((res) => res.data.data),
    {
      onSuccess: (data) => {
        console.log('Super Admin Compliance Data Loaded:', {
          total: data.items?.length || 0,
          drafts: data.items?.filter((item: ComplianceMaster) => item.approvalStatus === 'Draft' && item.scope === 'ORG').length || 0,
          items: data.items?.map((item: ComplianceMaster) => ({
            id: item.id,
            title: item.title,
            approvalStatus: item.approvalStatus,
            scope: item.scope,
          })) || []
        });
        setRows(data.items || []);
      },
      refetchOnWindowFocus: true,
      staleTime: 0, // Always consider data stale to allow refetching
      cacheTime: 0, // Don't cache, always fetch fresh data
    }
  );

  // Listen for storage events to trigger refetch when Admin saves
  useEffect(() => {
    const handleStorageChange = () => {
      console.log('Storage event detected, refetching compliance data...');
      refetch();
    };

    // Listen for custom event from Admin panel
    window.addEventListener('compliance-updated', handleStorageChange);
    
    // Also listen for storage events (cross-tab communication)
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('compliance-updated', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refetch]);

  const createMutation = useMutation(
    (data: Partial<ComplianceMaster>) => complianceService.create(data),
    {
      onSuccess: (newItem) => {
        queryClient.invalidateQueries(['compliance']);
        setRows((prev) => {
          const updated = prev.map((r) => (r.id === 'new' ? newItem : r));
          setDirtyRows((dirty) => {
            const newDirty = new Set(dirty);
            newDirty.delete('new');
            return newDirty;
          });
          return updated;
        });
      },
      onError: (error: any) => {
        setToast({
          message: `Error creating compliance: ${error.response?.data?.error || error.message}`,
          type: 'error',
          visible: true,
        });
      },
    }
  );

  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: Partial<ComplianceMaster> }) =>
      complianceService.update(id, data),
    {
      onSuccess: (updatedItem) => {
        queryClient.invalidateQueries(['compliance']);
        setRows((prev) =>
          prev.map((r) => (r.id === updatedItem.id ? updatedItem : r))
        );
        setDirtyRows((dirty) => {
          const newDirty = new Set(dirty);
          newDirty.delete(updatedItem.id);
          return newDirty;
        });
      },
      onError: (error: any) => {
        setToast({
          message: `Error updating compliance: ${error.response?.data?.error || error.message}`,
          type: 'error',
          visible: true,
        });
      },
    }
  );

  const deleteMutation = useMutation(
    (id: string) => complianceService.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['compliance']);
        setRows((prev) => prev.filter((r) => r.id !== id));
      },
      onError: (error: any) => {
        toast.error(`Error deleting compliance: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const approveMutation = useMutation(
    ({ id, data }: { id: string; data: Partial<ComplianceMaster> }) =>
      complianceService.update(id, data),
    {
      onSuccess: (approvedItem) => {
        queryClient.invalidateQueries(['compliance']);
        setRows((prev) =>
          prev.map((r) => (r.id === approvedItem.id ? approvedItem : r))
        );
        setDirtyRows((dirty) => {
          const newDirty = new Set(dirty);
          newDirty.delete(approvedItem.id);
          return newDirty;
        });
        setToast({
          message: 'Compliance approved successfully! It is now GLOBAL.',
          type: 'success',
          visible: true,
        });
      },
      onError: (error: any) => {
        setToast({
          message: `Error approving compliance: ${error.response?.data?.error || error.message}`,
          type: 'error',
          visible: true,
        });
      },
    }
  );

  const rejectMutation = useMutation(
    ({ id, data }: { id: string; data: Partial<ComplianceMaster> }) =>
      complianceService.update(id, data),
    {
      onSuccess: (rejectedItem) => {
        queryClient.invalidateQueries(['compliance']);
        setRows((prev) =>
          prev.map((r) => (r.id === rejectedItem.id ? rejectedItem : r))
        );
        setToast({
          message: 'Compliance rejected.',
          type: 'success',
          visible: true,
        });
      },
      onError: (error: any) => {
        setToast({
          message: `Error rejecting compliance: ${error.response?.data?.error || error.message}`,
          type: 'error',
          visible: true,
        });
      },
    }
  );

  const handleApprove = async (row: ComplianceMaster) => {
    if (!row.id || row.id === 'new') {
      setToast({
        message: 'Cannot approve unsaved compliance',
        type: 'error',
        visible: true,
      });
      return;
    }

    if (confirm(`Approve "${row.title}"? This will make it GLOBAL and visible to all organizations.`)) {
      try {
        // First save any pending changes
        if (dirtyRows.has(row.id)) {
          await handleSaveRow(row);
        }
        
        // Then approve - change scope to GLOBAL and approvalStatus to Approved
        await approveMutation.mutateAsync({
          id: row.id,
          data: {
            approvalStatus: 'Approved',
            approvedBy: user?.id,
            scope: 'GLOBAL',
            organizationId: null, // Remove organization association when making GLOBAL
          },
        });
      } catch (error: any) {
        console.error('Error approving compliance:', error);
      }
    }
  };

  const handleReject = async (row: ComplianceMaster) => {
    if (!row.id || row.id === 'new') {
      setToast({
        message: 'Cannot reject unsaved compliance',
        type: 'error',
        visible: true,
      });
      return;
    }

    if (confirm(`Reject "${row.title}"? This will mark it as rejected.`)) {
      try {
        await rejectMutation.mutateAsync({
          id: row.id,
          data: {
            approvalStatus: 'Rejected',
          },
        });
      } catch (error: any) {
        console.error('Error rejecting compliance:', error);
      }
    }
  };

  const handleAddRow = () => {
    const newRow: Partial<ComplianceMaster> = {
      id: 'new',
      title: '',
      category: '',
      complianceType: 'ONE_TIME',
      status: 'ACTIVE',
    };
    setRows((prev) => [...prev, newRow as ComplianceMaster]);
    setDirtyRows((dirty) => new Set(dirty).add('new'));
  };

  const handleCellClick = (rowIndex: number, colIndex: number) => {
    const col = COLUMN_DEFINITIONS[colIndex];
    if (!col.editable) return;

    const row = rows[rowIndex];
    if (!row) return;

    const value = (row as any)[col.key];
    let displayValue = '';
    
    if (value == null || value === '') {
      displayValue = '';
    } else if (col.key === 'mandatoryFlag' || col.key === 'imprisonmentFlag' || 
               col.key === 'financialYearApplicable' || col.key === 'firstTimeCompliance') {
      displayValue = value ? 'true' : 'false';
    } else {
      displayValue = String(value);
    }
    
    setEditingCell({ rowIndex, colIndex });
    setEditingValue(displayValue);
  };

  const handleCellChange = (value: string) => {
    setEditingValue(value);
  };

  const handleCellBlur = () => {
    if (!editingCell) return;

    const col = COLUMN_DEFINITIONS[editingCell.colIndex];
    const row = rows[editingCell.rowIndex];
    if (!row || !col.editable) {
      setEditingCell(null);
      setEditingValue('');
      return;
    }

    const oldValue = (row as any)[col.key];
    let newValue: any = editingValue;

    // Type conversion based on field
    if (col.key === 'mandatoryFlag' || col.key === 'imprisonmentFlag' || 
        col.key === 'financialYearApplicable' || col.key === 'firstTimeCompliance') {
      newValue = editingValue === 'true' || editingValue === '1' || editingValue.toLowerCase() === 'yes';
    } else if (col.key === 'maxPenaltyAmount' || col.key === 'gracePeriodDays') {
      newValue = editingValue ? parseFloat(editingValue) : null;
      if (isNaN(newValue)) newValue = null;
    } else if (col.key === 'approvalStatus') {
      // When Super Admin approves, also set approvedBy
      newValue = editingValue || 'Draft';
      if (newValue === 'Approved' && user?.id) {
        (updatedRows[editingCell.rowIndex] as any).approvedBy = user.id;
      }
    } else {
      newValue = editingValue || null;
    }

    // Only update if value actually changed
    const oldValueStr = oldValue != null ? String(oldValue) : '';
    const newValueStr = newValue != null ? String(newValue) : '';
    
    if (oldValueStr !== newValueStr) {
      const updatedRows = [...rows];
      (updatedRows[editingCell.rowIndex] as any)[col.key] = newValue;
      setRows(updatedRows);
      setDirtyRows((dirty) => new Set(dirty).add(row.id || 'new'));
    }

    setEditingCell(null);
    setEditingValue('');
  };

  const handleSaveRow = async (row: ComplianceMaster) => {
    try {
      if (!row.id || row.id === 'new') {
        // Create new
        if (!row.title || !row.category) {
          setToast({
            message: 'Title and Category are required',
            type: 'error',
            visible: true,
          });
          return;
        }
        await createMutation.mutateAsync(row);
        setToast({
          message: 'Compliance item created successfully!',
          type: 'success',
          visible: true,
        });
      } else {
        // Update existing
        await updateMutation.mutateAsync({ id: row.id, data: row });
        setToast({
          message: 'Compliance item updated successfully!',
          type: 'success',
          visible: true,
        });
      }
    } catch (error: any) {
      setToast({
        message: `Error saving: ${error.response?.data?.error || error.message || 'Unknown error'}`,
        type: 'error',
        visible: true,
      });
    }
  };

  const handleDeleteRow = async (row: ComplianceMaster) => {
    if (!row.id || row.id === 'new') {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setDirtyRows((dirty) => {
        const newDirty = new Set(dirty);
        newDirty.delete(row.id);
        return newDirty;
      });
      return;
    }

    if (confirm(`Are you sure you want to delete "${row.title}"?`)) {
      deleteMutation.mutate(row.id);
    }
  };

  const findNextEditableColumn = (startCol: number, direction: number): number | null => {
    let nextCol = startCol + direction;
    while (nextCol >= 0 && nextCol < COLUMN_DEFINITIONS.length) {
      if (COLUMN_DEFINITIONS[nextCol].editable) {
        return nextCol;
      }
      nextCol += direction;
    }
    return null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingCell) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCellBlur();
      // Move to next row, same column (if editable)
      const col = COLUMN_DEFINITIONS[editingCell.colIndex];
      if (col.editable && editingCell.rowIndex < rows.length - 1) {
        setTimeout(() => {
          handleCellClick(editingCell!.rowIndex + 1, editingCell!.colIndex);
        }, 10);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCellBlur();
      // Move to next/previous editable column
      const direction = e.shiftKey ? -1 : 1;
      const nextCol = findNextEditableColumn(editingCell.colIndex, direction);
      if (nextCol !== null) {
        setTimeout(() => {
          handleCellClick(editingCell!.rowIndex, nextCol);
        }, 10);
      } else if (direction === 1 && editingCell.rowIndex < rows.length - 1) {
        // Wrap to first editable column in next row
        const firstEditable = COLUMN_DEFINITIONS.findIndex(col => col.editable);
        if (firstEditable !== -1) {
          setTimeout(() => {
            handleCellClick(editingCell!.rowIndex + 1, firstEditable);
          }, 10);
        }
      } else if (direction === -1 && editingCell.rowIndex > 0) {
        // Wrap to last editable column in previous row
        let lastEditable = -1;
        for (let i = COLUMN_DEFINITIONS.length - 1; i >= 0; i--) {
          if (COLUMN_DEFINITIONS[i].editable) {
            lastEditable = i;
            break;
          }
        }
        if (lastEditable !== -1) {
          setTimeout(() => {
            handleCellClick(editingCell!.rowIndex - 1, lastEditable);
          }, 10);
        }
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleCellBlur();
      const nextCol = findNextEditableColumn(editingCell.colIndex, 1);
      if (nextCol !== null) {
        setTimeout(() => {
          handleCellClick(editingCell!.rowIndex, nextCol);
        }, 10);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleCellBlur();
      const nextCol = findNextEditableColumn(editingCell.colIndex, -1);
      if (nextCol !== null) {
        setTimeout(() => {
          handleCellClick(editingCell!.rowIndex, nextCol);
        }, 10);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleCellBlur();
      const col = COLUMN_DEFINITIONS[editingCell.colIndex];
      if (col.editable && editingCell.rowIndex < rows.length - 1) {
        setTimeout(() => {
          handleCellClick(editingCell!.rowIndex + 1, editingCell!.colIndex);
        }, 10);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleCellBlur();
      const col = COLUMN_DEFINITIONS[editingCell.colIndex];
      if (col.editable && editingCell.rowIndex > 0) {
        setTimeout(() => {
          handleCellClick(editingCell!.rowIndex - 1, editingCell!.colIndex);
        }, 10);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
      setEditingValue('');
    }
  };

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [editingCell]);

  const renderCell = (row: ComplianceMaster, rowIndex: number, colIndex: number) => {
    const col = COLUMN_DEFINITIONS[colIndex];
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
    const value = (row as any)[col.key];

    if (col.key === 'sno') {
      return <td className="px-2 py-1 text-center text-sm bg-gray-50 dark:bg-gray-800">{rowIndex + 1}</td>;
    }

    if (!col.editable || isEditing) {
      let displayValue: string = '';
      if (col.key === 'id') {
        displayValue = row.id === 'new' ? 'New' : row.id.substring(0, 8) + '...';
      } else if (col.key === 'approvalStatus') {
        displayValue = value || 'Draft';
      } else if (col.key === 'mandatoryFlag' || col.key === 'imprisonmentFlag' || 
                 col.key === 'financialYearApplicable' || col.key === 'firstTimeCompliance') {
        displayValue = value ? 'Yes' : 'No';
      } else if (col.key === 'dueDate') {
        displayValue = value ? (typeof value === 'string' ? value.split('T')[0] : new Date(value).toISOString().split('T')[0]) : '';
      } else if (col.key === 'createdAt' || col.key === 'updatedAt') {
        displayValue = value ? new Date(value).toLocaleDateString() : '';
      } else {
        displayValue = value != null ? String(value) : '';
      }

      if (isEditing) {
        if (col.key === 'mandatoryFlag' || col.key === 'imprisonmentFlag' || 
            col.key === 'financialYearApplicable' || col.key === 'firstTimeCompliance') {
          return (
            <td className="px-2 py-1 border border-gray-300 dark:border-gray-600">
              <select
                ref={inputRef as any}
                value={editingValue}
                onChange={(e) => handleCellChange(e.target.value)}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                className="w-full px-1 py-0.5 text-sm border-none outline-none bg-white dark:bg-gray-800"
                autoFocus
              >
                <option value="">--</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </td>
          );
        } else if (col.key === 'description' || col.key === 'penaltySummary') {
          return (
            <td className="px-2 py-1 border border-gray-300 dark:border-gray-600">
              <textarea
                ref={inputRef as any}
                value={editingValue}
                onChange={(e) => handleCellChange(e.target.value)}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                className="w-full px-1 py-0.5 text-sm border-none outline-none bg-white dark:bg-gray-800 resize-none"
                rows={2}
                autoFocus
              />
            </td>
          );
        } else if (col.key === 'approvalStatus') {
          return (
            <td className="px-2 py-1 border border-gray-300 dark:border-gray-600">
              <select
                ref={inputRef as any}
                value={editingValue}
                onChange={(e) => handleCellChange(e.target.value)}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                className="w-full px-1 py-0.5 text-sm border-none outline-none bg-white dark:bg-gray-800"
                autoFocus
              >
                <option value="">--</option>
                <option value="Draft">Draft</option>
                <option value="Approved">Approved</option>
              </select>
            </td>
          );
        } else if (col.key === 'status') {
          return (
            <td className="px-2 py-1 border border-gray-300 dark:border-gray-600">
              <select
                ref={inputRef as any}
                value={editingValue}
                onChange={(e) => handleCellChange(e.target.value)}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                className="w-full px-1 py-0.5 text-sm border-none outline-none bg-white dark:bg-gray-800"
                autoFocus
              >
                <option value="">--</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </td>
          );
        } else {
          return (
            <td className="px-2 py-1 border border-gray-300 dark:border-gray-600">
              <input
                ref={inputRef as any}
                type={col.key === 'dueDate' ? 'date' : col.key === 'maxPenaltyAmount' || col.key === 'gracePeriodDays' ? 'number' : 'text'}
                value={editingValue}
                onChange={(e) => handleCellChange(e.target.value)}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                className="w-full px-1 py-0.5 text-sm border-none outline-none bg-white dark:bg-gray-800"
                autoFocus
              />
            </td>
          );
        }
      }

      return (
        <td
          className={`px-2 py-1 border border-gray-300 dark:border-gray-600 text-sm ${
            col.editable
              ? 'cursor-cell hover:bg-blue-50 dark:hover:bg-blue-900/20'
              : 'bg-gray-50 dark:bg-gray-800'
          } ${col.key === 'approvalStatus' && displayValue === 'Draft' && row.scope === 'ORG' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
          onClick={() => handleCellClick(rowIndex, colIndex)}
        >
          {col.key === 'approvalStatus' ? (
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              displayValue === 'Approved' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
            }`}>
              {displayValue}
            </span>
          ) : (
            displayValue
          )}
        </td>
      );
    }

    return (
      <td
        className="px-2 py-1 border border-gray-300 dark:border-gray-600 text-sm cursor-cell hover:bg-blue-50 dark:hover:bg-blue-900/20"
        onClick={() => handleCellClick(rowIndex, colIndex)}
      >
        {value != null ? String(value) : ''}
      </td>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading compliance data...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRow}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <span className="material-icons-outlined text-lg">add</span>
            Add Row
          </button>
          <button
            onClick={async () => {
              if (dirtyRows.size === 0) return;
              
              setIsSaving(true);
              const dirtyRowIds = Array.from(dirtyRows);
              let successCount = 0;
              let errorCount = 0;
              
              try {
                // Save all dirty rows sequentially
                for (const id of dirtyRowIds) {
                  const row = rows.find((r) => r.id === id);
                  if (!row) continue;
                  
                  try {
                    if (!row.id || row.id === 'new') {
                      // Create new
                      if (!row.title || !row.category) {
                        errorCount++;
                        continue;
                      }
                      await createMutation.mutateAsync(row);
                      successCount++;
                    } else {
                      // Update existing
                      await updateMutation.mutateAsync({ id: row.id, data: row });
                      successCount++;
                    }
                  } catch (error: any) {
                    console.error(`Error saving row ${id}:`, error);
                    errorCount++;
                  }
                }
                
                // Show success/error notification
                if (errorCount === 0) {
                  setToast({
                    message: `Successfully saved ${successCount} compliance item${successCount !== 1 ? 's' : ''}!`,
                    type: 'success',
                    visible: true,
                  });
                } else if (successCount > 0) {
                  setToast({
                    message: `Saved ${successCount} item${successCount !== 1 ? 's' : ''}, but ${errorCount} failed.`,
                    type: 'error',
                    visible: true,
                  });
                } else {
                  setToast({
                    message: `Failed to save ${errorCount} item${errorCount !== 1 ? 's' : ''}.`,
                    type: 'error',
                    visible: true,
                  });
                }
              } catch (error: any) {
                setToast({
                  message: `Error saving changes: ${error.message || 'Unknown error'}`,
                  type: 'error',
                  visible: true,
                });
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={dirtyRows.size === 0 || isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <span className="material-icons-outlined text-lg">
              {isSaving ? 'hourglass_empty' : 'save'}
            </span>
            {isSaving ? 'Saving...' : `Save All Changes (${dirtyRows.size})`}
          </button>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {rows.length} row{rows.length !== 1 ? 's' : ''}
          {rows.filter(r => r.approvalStatus === 'Draft' && r.scope === 'ORG').length > 0 && (
            <span className="ml-2 text-yellow-600 dark:text-yellow-400 font-semibold">
              • {rows.filter(r => r.approvalStatus === 'Draft' && r.scope === 'ORG').length} Pending Approval
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        className="flex-1 overflow-auto border border-gray-300 dark:border-gray-600"
      >
        <table className="min-w-full border-collapse bg-white dark:bg-gray-900">
          <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
            <tr>
              {COLUMN_DEFINITIONS.map((col, idx) => (
                <th
                  key={col.key}
                  className="px-2 py-2 border border-gray-300 dark:border-gray-600 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap"
                  style={{ minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-2 py-2 border border-gray-300 dark:border-gray-600 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap" style={{ minWidth: '140px' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={row.id || `new-${rowIndex}`}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  dirtyRows.has(row.id) ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                } ${row.approvalStatus === 'Draft' && row.scope === 'ORG' ? 'bg-yellow-50/50 dark:bg-yellow-900/10 border-l-4 border-yellow-500' : ''}`}
              >
                {COLUMN_DEFINITIONS.map((_, colIndex) => renderCell(row, rowIndex, colIndex))}
                <td className="px-2 py-1 border border-gray-300 dark:border-gray-600">
                  <div className="flex items-center gap-1 flex-wrap">
                    {/* Approve/Reject buttons for Draft ORG compliances */}
                    {row.approvalStatus === 'Draft' && row.scope === 'ORG' && (
                      <>
                        <button
                          onClick={() => handleApprove(row)}
                          className="p-1 text-green-600 hover:text-green-700"
                          title="Approve (Make GLOBAL)"
                        >
                          <span className="material-icons-outlined text-sm">check_circle</span>
                        </button>
                        <button
                          onClick={() => handleReject(row)}
                          className="p-1 text-red-600 hover:text-red-700"
                          title="Reject"
                        >
                          <span className="material-icons-outlined text-sm">cancel</span>
                        </button>
                      </>
                    )}
                    {/* Save button for edited rows */}
                    <button
                      onClick={() => handleSaveRow(row)}
                      disabled={!dirtyRows.has(row.id)}
                      className="p-1 text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                      title="Save Changes"
                    >
                      <span className="material-icons-outlined text-sm">save</span>
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteRow(row)}
                      className="p-1 text-red-600 hover:text-red-700"
                      title="Delete"
                    >
                      <span className="material-icons-outlined text-sm">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={() => setToast({ ...toast, visible: false })}
      />
    </div>
  );
};

