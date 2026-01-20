import React from 'react';
import { BottomNav } from '../../components/shared';
import { useAuth } from '../../context/AuthContext';
import { AdminLayout } from '../../components/admin/AdminLayout';

export const AdminSettings: React.FC = () => {
  const { user } = useAuth();

  const content = (
    <div className="p-4 md:p-8 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Organization Settings</h1>
        <p className="text-slate-600 mt-1">Configure your organization's global settings</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Notification Settings</h2>
        <p className="text-slate-600 mb-4">Manage how your organization receives notifications.</p>
        {/* Settings options would go here */}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Auto-Escalation</h2>
        <p className="text-slate-600 mb-4">Configure rules for automatic task escalation.</p>
        {/* Settings options would go here */}
      </div>
    </div>
  );

  if (user?.role !== 'admin') {
    return (
      <div className="pb-24 min-h-screen bg-background-light dark:bg-background-dark text-text-main dark:text-white antialiased min-h-screen flex flex-col font-display">
        <div className="p-4">
          <p className="text-red-500 font-bold">Access denied. Admin permissions required.</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <AdminLayout>
      {content}
    </AdminLayout>
  );
};
