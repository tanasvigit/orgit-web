import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { complianceService } from '../../../services/complianceService';
import { ComplianceMaster } from '../../../../shared/src/types';
import { useAuth } from '../../../context/AuthContext';
import { Toast } from '../../../components/common/Toast';

// Helper function to notify Super Admin panels
const notifySuperAdmin = () => {
  // Dispatch custom event
  window.dispatchEvent(new CustomEvent('compliance-updated'));
  // Also use localStorage for cross-tab communication
  localStorage.setItem('compliance-updated', Date.now().toString());
};

interface GridCell {
  rowIndex: number;
  colIndex: number;
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
  { key: 'complianceType', label: 'Compliance_Type', width: 150, editable: true },
  { key: 'frequency', label: 'Frequency', width: 120, editable: true },
  { key: 'approvalStatus', label: 'Approval_Status', width: 150, editable: false },
  { key: 'status', label: 'Status', width: 100, editable: true },
];

interface AdminComplianceExcelGridProps {
  onSave?: () => void;
}

export const AdminComplianceExcelGrid: React.FC<AdminComplianceExcelGridProps> = ({ onSave }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ComplianceMaster[]>([]);
  const [editingCell, setEditingCell] = useState<GridCell | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const dirtyRowsRef = useRef<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  // Keep dirtyRowsRef in sync with dirtyRows state
  useEffect(() => {
    dirtyRowsRef.current = dirtyRows;
  }, [dirtyRows]);

  // Fetch all compliance items for this organization
  const { data, isLoading } = useQuery(
    ['compliance', 'admin', 'all'],
    () => complianceService.getAll({ limit: 1000, scope: 'ORG' }).then((res) => res.data.data),
    {
      onSuccess: (data) => {
        // Only update rows if we don't have unsaved changes
        // This prevents overwriting user's edits with stale data
        setRows((prevRows) => {
          // Use ref to get current dirtyRows value (avoid closure issue)
          const currentDirtyRows = dirtyRowsRef.current;
          // If we have dirty rows, merge the new data with existing dirty rows
          if (currentDirtyRows.size > 0) {
            const mergedRows = [...(data.items || [])];
            // Keep dirty rows that haven't been saved yet
            prevRows.forEach((prevRow) => {
              if (currentDirtyRows.has(prevRow.id || '')) {
                const existingIndex = mergedRows.findIndex((r) => r.id === prevRow.id);
                if (existingIndex >= 0) {
                  // Merge: keep local changes for dirty rows
                  mergedRows[existingIndex] = { ...mergedRows[existingIndex], ...prevRow };
                } else if (prevRow.id === 'new') {
                  // Keep new unsaved rows
                  mergedRows.push(prevRow);
                }
              }
            });
            return mergedRows;
          }
          return data.items || [];
        });
      },
      // Don't refetch automatically - only when explicitly invalidated
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      enabled: true, // Keep query enabled but prevent auto-refetch
    }
  );

  const createMutation = useMutation(
    (data: Partial<ComplianceMaster>) => complianceService.create(data),
    {
      onSuccess: (newItem) => {
        // Update local state immediately with the saved item
        setRows((prev) => {
          const updated = prev.map((r) => (r.id === 'new' ? newItem : r));
          setDirtyRows((dirty) => {
            const newDirty = new Set(dirty);
            newDirty.delete('new');
            return newDirty;
          });
          return updated;
        });
        // Invalidate queries but don't refetch immediately to avoid overwriting
        queryClient.invalidateQueries(['compliance'], { refetchActive: false });
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
        // Update local state immediately with the saved item
        setRows((prev) =>
          prev.map((r) => (r.id === updatedItem.id ? updatedItem : r))
        );
        setDirtyRows((dirty) => {
          const newDirty = new Set(dirty);
          newDirty.delete(updatedItem.id);
          return newDirty;
        });
        // Invalidate queries but don't refetch immediately to avoid overwriting
        queryClient.invalidateQueries(['compliance'], { refetchActive: false });
        queryClient.invalidateQueries(['compliance', 'all'], { refetchActive: false });
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
        setToast({
          message: `Error deleting compliance: ${error.response?.data?.error || error.message}`,
          type: 'error',
          visible: true,
        });
      },
    }
  );

  const handleAddRow = () => {
    const newRow: Partial<ComplianceMaster> = {
      id: 'new',
      title: '',
      category: '',
      complianceType: 'ONE_TIME',
      status: 'ACTIVE',
      scope: 'ORG',
      approvalStatus: 'Draft',
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
    } else {
      newValue = editingValue || null;
    }

    // Only update if value actually changed
    const oldValueStr = oldValue != null ? String(oldValue) : '';
    const newValueStr = newValue != null ? String(newValue) : '';
    
      if (oldValueStr !== newValueStr) {
        const updatedRows = [...rows];
        (updatedRows[editingCell.rowIndex] as any)[col.key] = newValue;
        
        // If editing complianceType, clear frequency if changed to ONE_TIME
        if (col.key === 'complianceType' && newValue === 'ONE_TIME') {
          (updatedRows[editingCell.rowIndex] as any).frequency = null;
        }
        
        // If editing approval status field, reset to Draft if changed
        if (col.key !== 'approvalStatus' && row.approvalStatus === 'Approved') {
          (updatedRows[editingCell.rowIndex] as any).approvalStatus = 'Draft';
        }
        
        setRows(updatedRows);
        setDirtyRows((dirty) => new Set(dirty).add(row.id || 'new'));
      }

    setEditingCell(null);
    setEditingValue('');
  };

  const handleSaveRow = async (row: ComplianceMaster) => {
    try {
      if (!row.id || row.id === 'new') {
        // Create new - always set as Draft and ORG scope
        if (!row.title || !row.category) {
          setToast({
            message: 'Title and Category are required',
            type: 'error',
            visible: true,
          });
          return;
        }
        
        // Validate and sanitize frequency field
        // For ONE_TIME compliance, frequency must be null
        // For RECURRING compliance, frequency must be a valid enum value
        let frequency: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | null = null;
        if (row.complianceType === 'RECURRING') {
          if (row.frequency) {
            const validFrequencies = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];
            if (validFrequencies.includes(row.frequency)) {
              frequency = row.frequency as 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
            } else {
              setToast({
                message: 'Invalid frequency. For RECURRING compliance, frequency must be: MONTHLY, QUARTERLY, HALF_YEARLY, or YEARLY',
                type: 'error',
                visible: true,
              });
              return;
            }
          } else {
            setToast({
              message: 'Frequency is required for RECURRING compliance',
              type: 'error',
              visible: true,
            });
            return;
          }
        } else {
          // ONE_TIME compliance - frequency must be null
          frequency = null;
        }
        
        const createData = {
          ...row,
          scope: 'ORG',
          approvalStatus: 'Draft',
          frequency: frequency, // Use sanitized frequency
        };
        const newItem = await createMutation.mutateAsync(createData);
        console.log('Admin created compliance:', {
          id: newItem.id,
          title: newItem.title,
          approvalStatus: newItem.approvalStatus,
          scope: newItem.scope,
        });
        setToast({
          message: 'Compliance created successfully! It will be visible after Super Admin approval.',
          type: 'success',
          visible: true,
        });
        // Invalidate Super Admin queries to show pending approval (but don't refetch our own query)
        queryClient.invalidateQueries(['compliance', 'all'], { refetchActive: false });
        queryClient.invalidateQueries(['compliance'], { refetchActive: false });
        // Notify Super Admin panels to refetch
        notifySuperAdmin();
        // Don't automatically close - let user continue editing or manually go back
        // if (onSave) {
        //   setTimeout(() => onSave(), 2000);
        // }
      } else {
        // Update existing - if approved, set back to Draft
        // Validate and sanitize frequency field
        let frequency: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | null = null;
        if (row.complianceType === 'RECURRING') {
          if (row.frequency) {
            const validFrequencies = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];
            if (validFrequencies.includes(row.frequency)) {
              frequency = row.frequency as 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
            } else {
              setToast({
                message: 'Invalid frequency. For RECURRING compliance, frequency must be: MONTHLY, QUARTERLY, HALF_YEARLY, or YEARLY',
                type: 'error',
                visible: true,
              });
              return;
            }
          } else {
            setToast({
              message: 'Frequency is required for RECURRING compliance',
              type: 'error',
              visible: true,
            });
            return;
          }
        } else {
          // ONE_TIME compliance - frequency must be null
          frequency = null;
        }
        
        const updateData = {
          ...row,
          approvalStatus: row.approvalStatus === 'Approved' ? 'Draft' : row.approvalStatus,
          frequency: frequency, // Use sanitized frequency
        };
        const updatedItem = await updateMutation.mutateAsync({ id: row.id, data: updateData });
        console.log('Admin updated compliance:', {
          id: updatedItem.id,
          title: updatedItem.title,
          approvalStatus: updatedItem.approvalStatus,
          scope: updatedItem.scope,
        });
        setToast({
          message: row.approvalStatus === 'Approved' 
            ? 'Compliance updated! Changes require Super Admin re-approval.'
            : 'Compliance updated successfully!',
          type: 'success',
          visible: true,
        });
        // Invalidate Super Admin queries to show pending approval (but don't refetch our own query)
        queryClient.invalidateQueries(['compliance', 'all'], { refetchActive: false });
        queryClient.invalidateQueries(['compliance'], { refetchActive: false });
        // Notify Super Admin panels to refetch
        notifySuperAdmin();
        // Don't automatically close - let user continue editing
        // if (onSave && row.approvalStatus === 'Approved') {
        //   setTimeout(() => onSave(), 2000);
        // }
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
      const col = COLUMN_DEFINITIONS[editingCell.colIndex];
      if (col.editable && editingCell.rowIndex < rows.length - 1) {
        setTimeout(() => {
          handleCellClick(editingCell!.rowIndex + 1, editingCell!.colIndex);
        }, 10);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCellBlur();
      const direction = e.shiftKey ? -1 : 1;
      const nextCol = findNextEditableColumn(editingCell.colIndex, direction);
      if (nextCol !== null) {
        setTimeout(() => {
          handleCellClick(editingCell!.rowIndex, nextCol);
        }, 10);
      } else if (direction === 1 && editingCell.rowIndex < rows.length - 1) {
        const firstEditable = COLUMN_DEFINITIONS.findIndex(col => col.editable);
        if (firstEditable !== -1) {
          setTimeout(() => {
            handleCellClick(editingCell!.rowIndex + 1, firstEditable);
          }, 10);
        }
      } else if (direction === -1 && editingCell.rowIndex > 0) {
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
    const isApproved = row.approvalStatus === 'Approved';

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
        } else if (col.key === 'frequency') {
          // Frequency dropdown - only enabled if complianceType is RECURRING
          const validFrequencies = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];
          return (
            <td className="px-2 py-1 border border-gray-300 dark:border-gray-600">
              <select
                ref={inputRef as any}
                value={editingValue}
                onChange={(e) => handleCellChange(e.target.value)}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                className="w-full px-1 py-0.5 text-sm border-none outline-none bg-white dark:bg-gray-800 disabled:bg-gray-100 disabled:cursor-not-allowed"
                autoFocus
                disabled={row.complianceType !== 'RECURRING'}
              >
                <option value="">--</option>
                {validFrequencies.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </td>
          );
        } else if (col.key === 'category' || col.key === 'jurisdictionType' || col.key === 'riskLevel' || 
                   col.key === 'complianceFrequency' || col.key === 'dueDateType' || col.key === 'complianceType' ||
                   col.key === 'entityTypeApplicability' || col.key === 'status') {
          const options: Record<string, string[]> = {
            category: ['Tax', 'Labour', 'Corporate', 'Environmental'],
            jurisdictionType: ['Central', 'State', 'Local'],
            riskLevel: ['Low', 'Medium', 'High'],
            complianceFrequency: ['Monthly', 'Quarterly', 'Annual', 'Event-based'],
            dueDateType: ['Fixed', 'Relative'],
            complianceType: ['ONE_TIME', 'RECURRING'],
            entityTypeApplicability: ['Company', 'LLP', 'Firm', 'Proprietor'],
            status: ['ACTIVE', 'INACTIVE'],
          };
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
                {(options[col.key] || []).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
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
          } ${isApproved && col.editable ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
          onClick={() => handleCellClick(rowIndex, colIndex)}
        >
          {col.key === 'approvalStatus' && (
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              value === 'Approved' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
            }`}>
              {displayValue}
            </span>
          )}
          {col.key !== 'approvalStatus' && displayValue}
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
                for (const id of dirtyRowIds) {
                  const row = rows.find((r) => r.id === id);
                  if (!row) continue;
                  
                  try {
                    await handleSaveRow(row);
                    successCount++;
                  } catch (error: any) {
                    console.error(`Error saving row ${id}:`, error);
                    errorCount++;
                  }
                }
                
                // Invalidate all compliance queries to ensure Super Admin sees pending approvals
                // But don't refetch our own query to avoid overwriting local state
                queryClient.invalidateQueries(['compliance'], { refetchActive: false });
                queryClient.invalidateQueries(['compliance', 'all'], { refetchActive: false });
                // Notify Super Admin panels to refetch
                notifySuperAdmin();
                
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
          {rows.filter(r => r.approvalStatus === 'Approved').length > 0 && (
            <span className="ml-2 text-green-600 dark:text-green-400">
              • {rows.filter(r => r.approvalStatus === 'Approved').length} Approved
            </span>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
        <p className="text-sm text-yellow-800 dark:text-yellow-300">
          <span className="material-icons-outlined text-base align-middle mr-1">info</span>
          All fields are editable. New items and changes require Super Admin approval before being visible to others.
        </p>
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
              <th className="px-2 py-2 border border-gray-300 dark:border-gray-600 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap w-24">
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
                } ${row.approvalStatus === 'Approved' ? 'bg-green-50/30 dark:bg-green-900/10' : ''}`}
              >
                {COLUMN_DEFINITIONS.map((_, colIndex) => renderCell(row, rowIndex, colIndex))}
                <td className="px-2 py-1 border border-gray-300 dark:border-gray-600">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSaveRow(row)}
                      disabled={!dirtyRows.has(row.id)}
                      className="p-1 text-green-600 hover:text-green-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                      title="Save"
                    >
                      <span className="material-icons-outlined text-sm">save</span>
                    </button>
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

