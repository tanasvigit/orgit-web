import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { useAuth } from '../../../context/AuthContext';

export const OrganisationStructureScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const organisationStructureItems = [
    { 
      icon: 'business', 
      title: 'Entity Master Data', 
      subtitle: 'Name, logo, address, contact', 
      screen: '/admin/entity-master',
      color: 'text-blue-500'
    },
    { 
      icon: 'domain', 
      title: 'Departments', 
      subtitle: 'Manage business units and departments', 
      screen: '/admin/settings/departments',
      color: 'text-green-500'
    },
    { 
      icon: 'badge', 
      title: 'Designations', 
      subtitle: 'Job titles and position levels', 
      screen: '/admin/settings/designations',
      color: 'text-purple-500'
    },
    { 
      icon: 'account_tree', 
      title: 'Reporting Hierarchy', 
      subtitle: 'Visual reporting structure and relationships', 
      screen: '/admin/settings/reporting-hierarchy',
      color: 'text-orange-500'
    },
  ];

  const StructureCard = ({ icon, title, subtitle, screen, color }: { 
    icon: string; 
    title: string; 
    subtitle: string; 
    screen: string;
    color: string;
  }) => (
    <button
      onClick={() => navigate(screen)}
      className="w-full flex items-center justify-between p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-lg transition-all text-left group"
    >
      <div className="flex items-center gap-4 flex-1">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
          color === 'text-blue-500' ? 'bg-blue-100 dark:bg-blue-900/30' :
          color === 'text-green-500' ? 'bg-green-100 dark:bg-green-900/30' :
          color === 'text-purple-500' ? 'bg-purple-100 dark:bg-purple-900/30' :
          'bg-orange-100 dark:bg-orange-900/30'
        }`}>
          <span className={`material-symbols-outlined text-3xl ${color}`}>
            {icon}
          </span>
        </div>
        <div className="flex-1">
          <p className="font-bold text-gray-900 dark:text-white text-lg mb-1">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
      <span className="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors ml-4">
        chevron_right
      </span>
    </button>
  );

  const content = (
    <div className="p-6 md:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="mb-2">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1.5">
            Organisation Structure
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Manage your organization's structure, departments, designations, and hierarchy
          </p>
        </div>
      </div>

      {/* Organisation Structure Cards */}
      <div className="max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {organisationStructureItems.map((item, index) => (
            <StructureCard key={index} {...item} />
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary text-2xl mt-0.5">info</span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                About Organisation Structure
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Configure your organization's fundamental structure including entity details, 
                departmental organization, job designations, and reporting relationships. 
                These settings form the foundation for task assignment, compliance tracking, 
                and organizational management.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      {content}
    </AdminLayout>
  );
};

