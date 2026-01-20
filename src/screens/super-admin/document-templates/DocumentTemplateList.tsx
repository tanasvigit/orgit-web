import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import { documentTemplateService } from '../../../services/documentTemplateService';

export const DocumentTemplateList: React.FC = () => {
  const [filters, setFilters] = useState({ type: '', status: '', search: '', page: 1, limit: 20 });

  const { data, isLoading } = useQuery(
    ['documentTemplates', filters],
    () => documentTemplateService.getAll(filters).then((res) => res.data.data)
  );

  const templates = data?.templates || [];

  return (
    <SuperAdminLayout
      breadcrumbs={[{ label: 'Document Management' }, { label: 'Templates' }]}
      showSearch
      searchPlaceholder="Search template name..."
    >
      <div className="max-w-[1600px] mx-auto p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Document Templates</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">Browse and manage global PDF document templates</p>
          </div>
          <Link
            to="/super-admin/document-templates/create"
            className="flex items-center gap-2 bg-super-admin-primary hover:bg-super-admin-primary-hover text-white px-5 py-2.5 rounded-lg shadow-sm transition-all font-medium"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Create Template
          </Link>
        </div>

        <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12">Loading...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Template Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Last Updated</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-super-admin-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
                {templates.map((template: any) => (
                  <tr key={template.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/super-admin/document-templates/${template.id}`} className="text-sm font-bold text-gray-900 dark:text-white hover:text-super-admin-primary">
                        {template.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{template.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {template.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(template.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link to={`/super-admin/document-templates/${template.id}`} className="text-super-admin-primary hover:text-super-admin-primary-hover mr-4">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
};

