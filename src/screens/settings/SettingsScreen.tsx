import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { entityMasterBulkService } from '../../services/entityMasterBulkService';

export const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const commonSettings = [
    { icon: 'person', title: 'Profile', subtitle: 'Update your profile details', screen: '/settings/profile' },
  ];

  // Eight sections: Entity Master Data, Employees, Departments, Designations, Organisation Structure, Service List, Entity List, Automation & Configurations
  const adminSettingsCards = [
    { icon: 'business', title: 'Entity Master Data', subtitle: 'Name of the Organisation, Short Name, Address, E Mail ID, Web Site, Phone Number, Org Constitution, PAN, GST Number, Depot, Warehouse', screen: '/admin/entity-master' },
    { icon: 'group', title: 'Employees', subtitle: 'NAME OF THE EMPLOYEE, MOBILE NUMBER, DESIGNATON, REPORTING TO, LEVEL', screen: '/admin/users' },
    { icon: 'domain', title: 'Departments', subtitle: 'Manage business units', screen: '/admin/settings/departments' },
    { icon: 'badge', title: 'Designations', subtitle: 'Job titles & levels', screen: '/admin/settings/designations' },
    { icon: 'account_tree', title: 'Organisation Structure', subtitle: 'Overall org structure view', screen: '/admin/settings/organisation-structure' },
    { icon: 'list_alt', title: 'Service List', subtitle: 'RECURRING TASK TITLE/SERVICE LIST, FREQUENCY, TASK ROLL OUT, ONE TIME TASK LIST', screen: '/admin/services' },
    { icon: 'groups', title: 'Entity List', subtitle: 'NAME OF THE CLIENT, ENTITY TYPE, COST CENTRE, GSTR & compliance fields', screen: '/admin/entities' },
    { icon: 'settings', title: 'Automation & Configurations', subtitle: 'Reminder configuration & auto escalation rules', screen: '/admin/settings/reminder-config' },
  ];

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await entityMasterBulkService.getTemplate();
      toast.success('Template downloaded. Fill it and upload to bulk update all settings.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const bulkUploadMutation = useMutation(
    (file: File) => entityMasterBulkService.uploadFile(file),
    {
      onSuccess: (res) => {
        const data = res.data?.data;
        if (data) {
          const { updated, errors } = data;
          const parts = [];
          if (updated.organizations) parts.push(`${updated.organizations} organizations`);
          if (updated.cost_centres) parts.push(`${updated.cost_centres} cost centres`);
          if (updated.branches) parts.push(`${updated.branches} branches`);
          if (updated.task_services) parts.push(`${updated.task_services} task services`);
          if (updated.client_entities) parts.push(`${updated.client_entities} client entities`);
          if (updated.client_entity_services) parts.push(`${updated.client_entity_services} client services`);
          if (updated.employees) parts.push(`${updated.employees} employees`);
          if (parts.length) toast.success(`Updated: ${parts.join(', ')}`);
          if (errors.length) {
            errors.slice(0, 5).forEach((e) => toast.error(e.message || `Row ${e.row}: ${e.sheet || ''}`));
            if (errors.length > 5) toast.error(`… and ${errors.length - 5} more errors`);
          }
        }
        queryClient.invalidateQueries('admin-organization');
        queryClient.invalidateQueries(['client-entities']);
        queryClient.invalidateQueries('employees');
        queryClient.invalidateQueries(['task-services']);
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || error.message || 'Upload failed');
      },
    }
  );

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

  const SettingCard = ({ icon, title, subtitle, screen }: { icon: string; title: string; subtitle: string; screen: string }) => (
    <button
      onClick={() => {
        console.log('Navigating to:', screen);
        navigate(screen);
      }}
      className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800/90 rounded-2xl text-left group transition-all duration-300 ease-out
        border-2 border-slate-200/90 dark:border-slate-600/80 border-l-[6px] border-l-primary
        shadow-lg shadow-slate-200/25 dark:shadow-slate-900/40
        hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <span className="material-icons-outlined text-primary text-2xl">{icon}</span>
        </div>
        <div>
          <p className="font-semibold text-text-main-light dark:text-text-main-dark text-base mb-1">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
      <span className="material-icons-outlined text-gray-400 group-hover:text-primary transition-colors">chevron_right</span>
    </button>
  );

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full p-6 md:p-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-main-light dark:text-text-main-dark mb-2">Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your account settings and preferences</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                ref={bulkFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleBulkFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={isDownloadingTemplate}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                <span className="material-icons-outlined text-[18px]">download</span>
                {isDownloadingTemplate ? 'Downloading...' : 'Download template'}
              </button>
              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                disabled={bulkUploadMutation.isLoading}
                className="px-4 py-2.5 bg-primary hover:bg-primary-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                <span className="material-icons-outlined text-[18px]">upload</span>
                {bulkUploadMutation.isLoading ? 'Uploading...' : 'Upload file'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-8">
          {/* General Settings */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-primary rounded"></div>
              <h2 className="text-xl font-bold text-text-main-light dark:text-text-main-dark">General Settings</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {commonSettings.map((item, index) => (
                <SettingCard key={index} {...item} />
              ))}
            </div>
          </div>

          {/* Admin Only Settings – 8 sections: Entity Master Data, Employees, Departments, Designations, Organisation Structure, Service List, Entity List, Automation & Configurations */}
          {isAdmin && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 bg-primary rounded"></div>
                <h2 className="text-xl font-bold text-text-main-light dark:text-text-main-dark">Settings</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adminSettingsCards.map((item, index) => (
                  <SettingCard key={index} {...item} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isAdmin) {
    return <AdminLayout>{content}</AdminLayout>;
  }

  return <EmployeeLayout>{content}</EmployeeLayout>;
};

