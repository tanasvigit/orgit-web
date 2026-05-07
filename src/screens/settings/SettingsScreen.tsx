import React, { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { entityMasterBulkService } from '../../services/entityMasterBulkService';
import AnimatedList from '../../components/shared/AnimatedList';

export const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Show All Settings when user is admin OR when on admin settings route (/admin/settings)
  const isAdmin = user?.role === 'admin' || location.pathname === '/admin/settings';
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const commonSettings = [
    { 
      icon: 'person', 
      title: 'Profile', 
      subtitle: 'Update your profile details', 
      screen: '/settings/profile',
      color: 'blue'
    },
    { 
      icon: 'lock', 
      title: 'Change Password', 
      subtitle: 'Update your password', 
      screen: '/settings/change-password',
      color: 'red'
    },
    {
      icon: 'tune',
      title: 'User configuration',
      subtitle: 'Default task timelines (start, target, due) and auto-escalation trigger for new tasks',
      screen: isAdmin ? '/admin/settings/user-config' : '/settings/user-config',
      color: 'indigo'
    },
  ];

  // Eight sections: Entity Master Data, Employees, Departments, Designations, Organisation Structure, Service List, Entity List, Automation & Configurations
  const adminSettingsCards = [
    { 
      icon: 'business', 
      title: 'Entity Master Data', 
      subtitle: 'Name of the Organisation, Short Name, Address, E Mail ID, Web Site, Phone Number, Org Constitution, PAN, GST Number, Depot, Warehouse', 
      screen: '/admin/entity-master',
      color: 'purple'
    },
    { 
      icon: 'group', 
      title: 'Employees', 
      subtitle: 'NAME OF THE EMPLOYEE, MOBILE NUMBER, DESIGNATON, REPORTING TO, LEVEL', 
      screen: '/admin/users',
      color: 'blue'
    },
    { 
      icon: 'domain', 
      title: 'Departments', 
      subtitle: 'Manage business units', 
      screen: '/admin/settings/departments',
      color: 'green'
    },
    { 
      icon: 'badge', 
      title: 'Designations', 
      subtitle: 'Job titles & levels', 
      screen: '/admin/settings/designations',
      color: 'orange'
    },
    { 
      icon: 'account_tree', 
      title: 'Organisation Structure', 
      subtitle: 'Overall org structure view', 
      screen: '/admin/settings/organisation-structure',
      color: 'indigo'
    },
    { 
      icon: 'list_alt', 
      title: 'Service List', 
      subtitle: 'RECURRING TASK TITLE/SERVICE LIST, FREQUENCY, TASK ROLL OUT, ONE TIME TASK LIST', 
      screen: '/admin/services',
      color: 'teal'
    },
    { 
      icon: 'groups', 
      title: 'Entity List', 
      subtitle: 'NAME OF THE CLIENT, ENTITY TYPE, COST CENTRE, GSTR & compliance fields', 
      screen: '/admin/entities',
      color: 'pink'
    },
    { 
      icon: 'settings', 
      title: 'Automation & Configurations', 
      subtitle: 'Reminder configuration & auto escalation rules', 
      screen: '/admin/settings/reminder-config',
      color: 'cyan'
    },
  ];

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await entityMasterBulkService.getTemplate();
      toast.success('OrgIt Settings template downloaded. Contains: Entity Master, Entity List, Service List, Employees, Cost Centres, Branches. Fill and upload to bulk update.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

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
          toast.success('Settings bulk upload completed.');
        } else {
          toast.info('Bulk upload finished with errors.');
        }
          if (status.errors?.length) {
            status.errors.slice(0, 5).forEach((e: any) => toast.error(e.message || `Row ${e.row}: ${e.sheet || ''}`));
            if (status.errors.length > 5) toast.error(`… and ${status.errors.length - 5} more errors`);
          }
        } catch (err: any) {
          toast.error(err?.message || 'Failed to get upload status');
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

  const getColorClasses = (color: string) => {
    // Used to theme just the icon/accent; list rows themselves stay minimal (no cards)
    const colors: Record<string, { iconBg: string; iconRing: string }> = {
      blue: {
        iconBg: 'bg-blue-500',
        iconRing: 'ring-blue-100 dark:ring-blue-900/40',
      },
      red: {
        iconBg: 'bg-red-500',
        iconRing: 'ring-red-100 dark:ring-red-900/40',
      },
      purple: {
        iconBg: 'bg-purple-500',
        iconRing: 'ring-purple-100 dark:ring-purple-900/40',
      },
      green: {
        iconBg: 'bg-green-500',
        iconRing: 'ring-green-100 dark:ring-green-900/40',
      },
      orange: {
        iconBg: 'bg-orange-500',
        iconRing: 'ring-orange-100 dark:ring-orange-900/40',
      },
      indigo: {
        iconBg: 'bg-indigo-500',
        iconRing: 'ring-indigo-100 dark:ring-indigo-900/40',
      },
      teal: {
        iconBg: 'bg-teal-500',
        iconRing: 'ring-teal-100 dark:ring-teal-900/40',
      },
      pink: {
        iconBg: 'bg-pink-500',
        iconRing: 'ring-pink-100 dark:ring-pink-900/40',
      },
      cyan: {
        iconBg: 'bg-cyan-500',
        iconRing: 'ring-cyan-100 dark:ring-cyan-900/40',
      },
    };
    return colors[color] || colors.blue;
  };

  const SettingCard = ({ icon, title, subtitle, screen, color = 'blue' }: { 
    icon: string; 
    title: string; 
    subtitle: string; 
    screen: string;
    color?: string;
  }) => {
    const colorClasses = getColorClasses(color);
    return (
      <button
        onClick={() => {
          console.log('Navigating to:', screen);
          navigate(screen);
        }}
        className="w-full flex items-center gap-4 px-2 py-3 md:px-3 rounded-lg text-left group transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <div className={`w-10 h-10 ${colorClasses.iconBg} rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ${colorClasses.iconRing} group-hover:scale-105 transition-transform`}>
          <span className="material-icons-outlined text-white text-xl">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base mb-0.5 group-hover:text-primary dark:group-hover:text-primary/80 transition-colors">
            {title}
          </h3>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
            {subtitle}
          </p>
        </div>
        <span className="material-icons-outlined text-gray-400 group-hover:text-primary dark:group-hover:text-primary/80 transition-colors flex-shrink-0 text-base md:text-lg">
          chevron_right
        </span>
      </button>
    );
  };

  // Prepare items for AnimatedList
  const allSettingsItems = isAdmin 
    ? [...commonSettings, ...adminSettingsCards]
    : commonSettings;

  const handleSettingSelect = (_item: any, index: number) => {
    const selectedItem = allSettingsItems[index];
    if (selectedItem) {
      navigate(selectedItem.screen);
    }
  };

  const content = (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full p-6 md:p-8">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                  <span className="material-icons-outlined text-white text-2xl">settings</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Settings
                </h1>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
                Manage your account settings and preferences. Download <strong className="text-primary">OrgIt Settings</strong> for one workbook with all sheets; individual templates are also available in each module.
              </p>
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
                  className="px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary/50 text-gray-700 dark:text-gray-200 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                >
                  <span className="material-icons-outlined text-[18px]">download</span>
                  {isDownloadingTemplate ? 'Downloading...' : 'Download Template'}
                </button>
                <button
                  type="button"
                  onClick={() => bulkFileInputRef.current?.click()}
                  disabled={bulkUploadMutation.isLoading}
                  className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-95"
                >
                  <span className="material-icons-outlined text-[18px]">upload</span>
                  {bulkUploadMutation.isLoading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Settings List with AnimatedList */}
        <div className="space-y-6">
          {/* General Settings Section */}
          {!isAdmin && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">General Settings</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-gray-200 dark:border-gray-800">
                {commonSettings.map((item, index) => (
                  <div key={index} className="first:border-t-0">
                    <SettingCard {...item} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Settings with AnimatedList */}
          {isAdmin && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  All Settings
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({allSettingsItems.length} items)
                </span>
              </div>
              
              <AnimatedList
                items={allSettingsItems.map((item, index) => (
                  <SettingCard key={index} {...item} />
                ))}
                onItemSelect={handleSettingSelect}
                showGradients={false}
                enableArrowNavigation={true}
                displayScrollbar={true}
                className="w-full rounded-xl bg-white/60 dark:bg-slate-900/40 border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800"
                itemClassName="transition-transform"
              />
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
