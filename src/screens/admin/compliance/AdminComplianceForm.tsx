import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { complianceService } from '../../../services/complianceService';
import { useAuth } from '../../../context/AuthContext';
import { ComplianceMaster } from '../../../../shared/src/types';
import { Toast } from '../../../components/common/Toast';

export const AdminComplianceForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isEdit = !!id;

  const { data: item, isLoading } = useQuery(
    ['compliance', id],
    () => complianceService.getById(id!).then((res) => res.data.data),
    { enabled: isEdit }
  );

  const [formData, setFormData] = useState<Partial<ComplianceMaster>>({
    title: '',
    category: '',
    complianceCode: '',
    description: '',
    applicableLaw: '',
    sectionRuleReference: '',
    governingAuthority: '',
    jurisdictionType: '',
    stateApplicability: '',
    industryApplicability: '',
    entityTypeApplicability: '',
    applicabilityThreshold: '',
    mandatoryFlag: false,
    riskLevel: '',
    penaltySummary: '',
    maxPenaltyAmount: null,
    imprisonmentFlag: false,
    complianceFrequency: '',
    dueDateType: '',
    dueDate: null,
    dueDateRule: '',
    gracePeriodDays: null,
    financialYearApplicable: false,
    firstTimeCompliance: false,
    triggerEvent: '',
    complianceType: 'ONE_TIME',
    frequency: undefined,
    effectiveDate: '',
    status: 'ACTIVE',
    approvalStatus: 'Draft',
    scope: 'ORG',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false,
  });

  useEffect(() => {
    if (isEdit && item) {
      setFormData({
        title: item.title || '',
        category: item.category || '',
        complianceCode: item.complianceCode || '',
        description: item.description || '',
        applicableLaw: item.applicableLaw || '',
        sectionRuleReference: item.sectionRuleReference || '',
        governingAuthority: item.governingAuthority || '',
        jurisdictionType: item.jurisdictionType || '',
        stateApplicability: item.stateApplicability || '',
        industryApplicability: item.industryApplicability || '',
        entityTypeApplicability: item.entityTypeApplicability || '',
        applicabilityThreshold: item.applicabilityThreshold || '',
        mandatoryFlag: item.mandatoryFlag || false,
        riskLevel: item.riskLevel || '',
        penaltySummary: item.penaltySummary || '',
        maxPenaltyAmount: item.maxPenaltyAmount || null,
        imprisonmentFlag: item.imprisonmentFlag || false,
        complianceFrequency: item.complianceFrequency || '',
        dueDateType: item.dueDateType || '',
        dueDate: item.dueDate || null,
        dueDateRule: item.dueDateRule || '',
        gracePeriodDays: item.gracePeriodDays || null,
        financialYearApplicable: item.financialYearApplicable || false,
        firstTimeCompliance: item.firstTimeCompliance || false,
        triggerEvent: item.triggerEvent || '',
        complianceType: item.complianceType || 'ONE_TIME',
        frequency: item.frequency,
        effectiveDate: item.effectiveDate || '',
        status: item.status || 'ACTIVE',
        approvalStatus: item.approvalStatus || 'Draft',
        scope: item.scope || 'ORG',
      });
    }
  }, [isEdit, item]);

  const isApproved = formData.approvalStatus === 'Approved';
  const isDraft = formData.approvalStatus === 'Draft' || !formData.approvalStatus;

  const createMutation = useMutation(
    (data: Partial<ComplianceMaster>) => complianceService.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('compliance');
        setToast({
          message: 'Compliance created successfully! It will be visible after Super Admin approval.',
          type: 'success',
          visible: true,
        });
        setTimeout(() => {
          navigate('/admin/compliance');
        }, 2000);
      },
      onError: (error: any) => {
        setToast({
          message: `Error: ${error.response?.data?.error || error.message}`,
          type: 'error',
          visible: true,
        });
      },
    }
  );

  const updateMutation = useMutation(
    (data: Partial<ComplianceMaster>) => complianceService.update(id!, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('compliance');
        setToast({
          message: isApproved 
            ? 'Compliance updated successfully!' 
            : 'Compliance updated! Changes will be visible after Super Admin approval.',
          type: 'success',
          visible: true,
        });
        setTimeout(() => {
          navigate('/admin/compliance');
        }, 2000);
      },
      onError: (error: any) => {
        setToast({
          message: `Error: ${error.response?.data?.error || error.message}`,
          type: 'error',
          visible: true,
        });
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // For new items, always set as Draft and ORG scope
    const submitData = {
      ...formData,
      scope: 'ORG',
      approvalStatus: isEdit && isApproved ? 'Approved' : 'Draft',
    };

    if (isEdit) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  if (isEdit && isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">Loading...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {isEdit ? 'Edit Compliance Item' : 'Add Compliance Item'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {isEdit 
              ? 'Update compliance details. Changes require Super Admin approval.'
              : 'Create a new compliance requirement for your organisation. It will be visible after Super Admin approval.'}
          </p>
        </div>

        {/* Approval Status Banner */}
        {isEdit && (
          <div className={`mb-6 p-4 rounded-lg border ${
            isApproved
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          }`}>
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined">
                {isApproved ? 'check_circle' : 'pending'}
              </span>
              <p className="text-sm font-medium">
                {isApproved 
                  ? '✓ Approved by Super Admin - All fields are editable'
                  : '⏳ Pending Super Admin Approval - Fields are visible but changes require re-approval'}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Compliance Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Compliance Code
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.complianceCode}
                    onChange={(e) => setFormData({ ...formData, complianceCode: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">Select Category</option>
                    <option value="Tax">Tax</option>
                    <option value="Labour">Labour</option>
                    <option value="Corporate">Corporate</option>
                    <option value="Environmental">Environmental</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Compliance Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.complianceType}
                    onChange={(e) => setFormData({ ...formData, complianceType: e.target.value as 'ONE_TIME' | 'RECURRING' })}
                  >
                    <option value="ONE_TIME">One Time</option>
                    <option value="RECURRING">Recurring</option>
                  </select>
                </div>
              </div>

              {formData.complianceType === 'RECURRING' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Frequency
                  </label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.frequency || ''}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any || undefined })}
                  >
                    <option value="">Select Frequency</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="HALF_YEARLY">Half Yearly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Legal Information Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Legal Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Applicable Law
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.applicableLaw}
                    onChange={(e) => setFormData({ ...formData, applicableLaw: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Section/Rule Reference
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.sectionRuleReference}
                    onChange={(e) => setFormData({ ...formData, sectionRuleReference: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Governing Authority
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.governingAuthority}
                    onChange={(e) => setFormData({ ...formData, governingAuthority: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Jurisdiction Type
                  </label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.jurisdictionType}
                    onChange={(e) => setFormData({ ...formData, jurisdictionType: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="Central">Central</option>
                    <option value="State">State</option>
                    <option value="Local">Local</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Applicability Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Applicability</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    State Applicability
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., All India, Maharashtra, Karnataka"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.stateApplicability}
                    onChange={(e) => setFormData({ ...formData, stateApplicability: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Industry Applicability
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Manufacturing, Services, IT"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.industryApplicability}
                    onChange={(e) => setFormData({ ...formData, industryApplicability: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Entity Type Applicability
                  </label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.entityTypeApplicability}
                    onChange={(e) => setFormData({ ...formData, entityTypeApplicability: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="Company">Company</option>
                    <option value="LLP">LLP</option>
                    <option value="Firm">Firm</option>
                    <option value="Proprietor">Proprietor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Applicability Threshold
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Turnover > 1 Cr, Employees > 50"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.applicabilityThreshold}
                    onChange={(e) => setFormData({ ...formData, applicabilityThreshold: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary rounded border-gray-300"
                    checked={formData.mandatoryFlag || false}
                    onChange={(e) => setFormData({ ...formData, mandatoryFlag: e.target.checked })}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Mandatory Compliance</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary rounded border-gray-300"
                    checked={formData.financialYearApplicable || false}
                    onChange={(e) => setFormData({ ...formData, financialYearApplicable: e.target.checked })}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Financial Year Applicable</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary rounded border-gray-300"
                    checked={formData.firstTimeCompliance || false}
                    onChange={(e) => setFormData({ ...formData, firstTimeCompliance: e.target.checked })}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">First Time Compliance</span>
                </label>
              </div>
            </div>
          </div>

          {/* Risk & Penalty Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Risk & Penalty</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Risk Level
                  </label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.riskLevel}
                    onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Penalty Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.maxPenaltyAmount || ''}
                    onChange={(e) => setFormData({ ...formData, maxPenaltyAmount: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Penalty Summary
                </label>
                <textarea
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  value={formData.penaltySummary}
                  onChange={(e) => setFormData({ ...formData, penaltySummary: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary rounded border-gray-300"
                  checked={formData.imprisonmentFlag || false}
                  onChange={(e) => setFormData({ ...formData, imprisonmentFlag: e.target.checked })}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Imprisonment Applicable</span>
              </label>
            </div>
          </div>

          {/* Due Date & Frequency Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Due Date & Frequency</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Compliance Frequency
                  </label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.complianceFrequency}
                    onChange={(e) => setFormData({ ...formData, complianceFrequency: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Annual">Annual</option>
                    <option value="Event-based">Event-based</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Date Type
                  </label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.dueDateType}
                    onChange={(e) => setFormData({ ...formData, dueDateType: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="Fixed">Fixed</option>
                    <option value="Relative">Relative</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.dueDate ? (typeof formData.dueDate === 'string' ? formData.dueDate.split('T')[0] : '') : ''}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value || null })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Grace Period (Days)
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.gracePeriodDays || ''}
                    onChange={(e) => setFormData({ ...formData, gracePeriodDays: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Due Date Rule
                </label>
                <input
                  type="text"
                  placeholder="e.g., Last day of month, 15th of every month"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.dueDateRule}
                  onChange={(e) => setFormData({ ...formData, dueDateRule: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Trigger Event
                </label>
                <input
                  type="text"
                  placeholder="e.g., Incorporation, Change in capital, Annual turnover"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.triggerEvent}
                  onChange={(e) => setFormData({ ...formData, triggerEvent: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate('/admin/compliance')}
              className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isLoading || updateMutation.isLoading}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg shadow-sm transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-icons-outlined text-xl">save</span>
              {createMutation.isLoading || updateMutation.isLoading ? 'Saving...' : (isEdit ? 'Update' : 'Create')} Compliance
            </button>
          </div>
        </form>

        {/* Toast Notification */}
        <Toast
          message={toast.message}
          type={toast.type}
          visible={toast.visible}
          onClose={() => setToast({ ...toast, visible: false })}
        />
      </div>
    </AdminLayout>
  );
};

