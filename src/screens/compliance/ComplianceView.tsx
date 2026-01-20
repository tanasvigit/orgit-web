import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { complianceService } from '../../services/complianceService';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { ComplianceMaster } from '../../../shared/src/types';
import { getScopeBadge } from '../../services/complianceService';
import { useAuth } from '../../context/AuthContext';
import { TaskCreateModal } from '../../components/tasks/TaskCreateModal';

export const ComplianceView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: item, isLoading } = useQuery(
    ['compliance', id],
    () => complianceService.getById(id!).then((res) => res.data.data),
    { enabled: !!id }
  );

  const handleTaskCreated = () => {
    setShowAssignTaskModal(false);
    queryClient.invalidateQueries('tasks');
  };

  const toggleAssignee = (user: any) => {
    setSelectedAssignees((prev) => {
      const exists = prev.find(u => u.id === user.id);
      if (exists) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  // Handle scroll to show/hide scroll button
  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = document.querySelector('.scrollable-content');
      if (scrollContainer) {
        if (scrollContainer.scrollTop > 300) {
          setShowScrollButton(true);
        } else {
          setShowScrollButton(false);
        }
      }
    };

    const scrollContainer = document.querySelector('.scrollable-content');
    scrollContainer?.addEventListener('scroll', handleScroll);
    return () => scrollContainer?.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    const scrollContainer = document.querySelector('.scrollable-content');
    scrollContainer?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (isLoading) {
    return (
      <EmployeeLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      </EmployeeLayout>
    );
  }

  if (!item) {
    return (
      <EmployeeLayout>
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Compliance not found</p>
          <button
            onClick={() => navigate('/compliance')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
          >
            Back to Compliance List
          </button>
        </div>
      </EmployeeLayout>
    );
  }

  const scopeBadge = getScopeBadge(item.scope);

  const FormField = ({ label, value, fullWidth = false }: { label: string; value: string | number | null | undefined; fullWidth?: boolean }) => {
    if (value === null || value === undefined || value === '') return null;
    return (
      <div className={fullWidth ? 'col-span-1 md:col-span-2' : ''}>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
          {label}
        </label>
        <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded px-3 py-2.5 min-h-[38px] flex items-center">
          {value}
        </div>
      </div>
    );
  };

  return (
    <EmployeeLayout>
      <div className="bg-gray-50 dark:bg-gray-900 h-full flex flex-col overflow-hidden">
        {/* Header - Fixed */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <button
              onClick={() => navigate('/compliance')}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary mb-4 transition-colors text-sm font-medium"
            >
              <span className="material-icons-outlined text-lg">arrow_back</span>
              Back to Compliance List
            </button>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{item.title}</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    item.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {item.status}
                  </span>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    item.scope === 'GLOBAL'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  }`}>
                    {scopeBadge.label}
                  </span>
                  {item.category && (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {item.category}
                    </span>
                  )}
                </div>
              </div>
              {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'employee') && (
                <button
                  onClick={() => setShowAssignTaskModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg shadow-sm transition-colors font-medium text-sm"
                >
                  <span className="material-icons-outlined text-lg">assignment</span>
                  Assign as Task
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content - Scrollable Form */}
        <div className="flex-1 overflow-y-auto scrollable-content">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <form className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="p-8 space-y-8">
                {/* Basic Information Section */}
                <section>
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                      Basic Information
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField label="Compliance Code" value={item.complianceCode} />
                    <FormField 
                      label="Compliance Type" 
                      value={item.complianceType ? `${item.complianceType}${item.frequency ? ` (${item.frequency})` : ''}` : null} 
                    />
                    <FormField label="Act Name" value={item.actName} />
                    <FormField 
                      label="Effective Date" 
                      value={item.effectiveDate ? new Date(item.effectiveDate).toLocaleDateString('en-IN', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      }) : null} 
                    />
                    {item.description && (
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                          Description
                        </label>
                        <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded px-3 py-2.5 min-h-[80px]">
                          {item.description}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* Legal Information Section */}
                {(item.applicableLaw || item.sectionRuleReference || item.governingAuthority || item.jurisdictionType) && (
                  <section>
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                      <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                        Legal Information
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField label="Applicable Law" value={item.applicableLaw} />
                      <FormField label="Section/Rule Reference" value={item.sectionRuleReference} />
                      <FormField label="Governing Authority" value={item.governingAuthority} />
                      <FormField label="Jurisdiction Type" value={item.jurisdictionType} />
                    </div>
                  </section>
                )}

                {/* Applicability Section */}
                {(item.stateApplicability || item.industryApplicability || item.entityTypeApplicability || item.applicabilityThreshold) && (
                  <section>
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                      <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                        Applicability
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField label="State Applicability" value={item.stateApplicability} />
                      <FormField label="Industry Applicability" value={item.industryApplicability} />
                      <FormField label="Entity Type Applicability" value={item.entityTypeApplicability} />
                      <FormField label="Applicability Threshold" value={item.applicabilityThreshold} />
                    </div>
                  </section>
                )}

                {/* Risk & Penalty Section */}
                {(item.riskLevel || item.penaltySummary || item.maxPenaltyAmount !== null || item.imprisonmentFlag !== null) && (
                  <section>
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                      <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                        Risk & Penalty
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField label="Risk Level" value={item.riskLevel} />
                      {item.penaltySummary && (
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                            Penalty Summary
                          </label>
                          <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded px-3 py-2.5 min-h-[60px]">
                            {item.penaltySummary}
                          </div>
                        </div>
                      )}
                      {item.maxPenaltyAmount !== null && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                            Max Penalty Amount
                          </label>
                          <div className="text-sm text-gray-900 dark:text-gray-100 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2.5 min-h-[38px] flex items-center font-semibold text-red-700 dark:text-red-400">
                            ₹{item.maxPenaltyAmount.toLocaleString('en-IN')}
                          </div>
                        </div>
                      )}
                      {item.imprisonmentFlag !== null && (
                        <FormField label="Imprisonment Applicable" value={item.imprisonmentFlag ? 'Yes' : 'No'} />
                      )}
                    </div>
                  </section>
                )}

                {/* Due Date Information Section */}
                {(item.dueDateType || item.dueDate || item.dueDateRule || item.gracePeriodDays !== null) && (
                  <section>
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                      <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                        Due Date Information
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField label="Due Date Type" value={item.dueDateType} />
                      {item.dueDate && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                            Due Date
                          </label>
                          <div className="text-sm text-gray-900 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-3 py-2.5 min-h-[38px] flex items-center font-semibold text-blue-700 dark:text-blue-400">
                            {new Date(item.dueDate).toLocaleDateString('en-IN', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </div>
                        </div>
                      )}
                      <FormField label="Due Date Rule" value={item.dueDateRule} />
                      {item.gracePeriodDays !== null && (
                        <FormField label="Grace Period (Days)" value={item.gracePeriodDays} />
                      )}
                    </div>
                  </section>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Scroll to Top Button */}
        {showScrollButton && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-50 p-3 bg-primary hover:bg-primary-dark text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 flex items-center justify-center"
            aria-label="Scroll to top"
          >
            <span className="material-icons-outlined">keyboard_arrow_up</span>
          </button>
        )}

        {/* Assign as Task Modal */}
        {showAssignTaskModal && item && (
          <TaskCreateModal
            visible={showAssignTaskModal}
            onClose={() => setShowAssignTaskModal(false)}
            onSuccess={handleTaskCreated}
            initialTitle={item.title}
            initialDescription={item.description || `Compliance: ${item.title}\n\nCategory: ${item.category || 'N/A'}\nType: ${item.complianceType || 'N/A'}`}
            initialDueDate={item.dueDate ? new Date(item.dueDate) : undefined}
            complianceId={item.id}
          />
        )}
      </div>
    </EmployeeLayout>
  );
};
