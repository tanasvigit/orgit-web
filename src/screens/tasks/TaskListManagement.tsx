import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { taskService } from '../../services/taskService';
import { useAuth } from '../../context/AuthContext';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';

export const TaskListManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [taskType, setTaskType] = useState<'One-Time' | 'Recurring'>('One-Time');

  const { data: tasksData } = useQuery('tasks', () => taskService.getTasks());
  // Mock pending tasks for UI matching
  const pendingTasks = [
    {
      id: 'p1',
      title: 'Update Compliance Docs',
      status: 'Pending',
      priority: 'High Priority',
      due: 'Oct 24, 5:00 PM',
      priorityColor: 'text-red-600 dark:text-red-400',
      icon: 'priority_high'
    },
    {
      id: 'p2',
      title: 'Safety Training Module 1',
      status: 'Pending',
      priority: 'Medium Priority',
      due: 'Oct 25, 9:00 AM',
      priorityColor: 'text-amber-600 dark:text-amber-400',
      icon: 'equalizer',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC9uIhu6_0xzsUNeZGqJVO3QbT62TnR6C8axKwtWu4AffCEZ7InWE9GHl9keOsMvp8wcSKkgrfyRD9OPGIAPPP028SnfAMjkP7QY7HCw_Ai6VML_Ei5JFbn4dWMASYT8Bn_MLwqU1dcbXXx79GZDaKAH5Le0QpatC8UWtbL92IrxxOl4nN0fg10GhkEYVZAP1kIIMtWKZb7HO6BwWTwmnqfFY77e-iZEKjDIoZz0wBghMKHfFuukML2tot4YMj-MOK3VdQBMCcy2yEv'
    }
  ];

  const allTasks = [
    {
      id: 't1',
      title: 'Quarterly Review Prep',
      date: 'Oct 30 • 2:00 PM',
      status: 'In Progress',
      statusColor: 'bg-purple-100 dark:bg-purple-900/40 text-primary dark:text-purple-300',
      icon: 'event_upcoming',
      iconBg: 'bg-purple-50 dark:bg-purple-900/20 text-primary'
    },
    {
      id: 't2',
      title: 'Submit Expense Report',
      date: 'Nov 01 • EOD',
      status: 'Completed',
      statusColor: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
      icon: 'task_alt',
      iconBg: 'bg-green-50 dark:bg-green-900/20 text-green-600'
    },
    {
      id: 't3',
      title: 'Risk Assessment',
      date: 'Nov 05 • 5:00 PM',
      status: 'Pending',
      statusColor: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
      icon: 'schedule',
      iconBg: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'
    }
  ];

  const content = (
    <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-24 font-display">
      <header className="flex items-center px-4 py-3 justify-between bg-surface-light dark:bg-surface-dark sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800 text-gray-900 dark:text-white cursor-pointer">
          <span className="material-symbols-outlined">menu</span>
        </div>
        <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-tight">My Tasks</h2>
        <div className="flex size-10 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800 cursor-pointer">
          <span className="material-symbols-outlined text-gray-900 dark:text-white">filter_list</span>
        </div>
      </header>

      <div className="px-4 py-4 bg-background-light dark:bg-background-dark z-10">
        <div className="flex h-12 w-full items-center justify-center rounded-xl bg-gray-200 dark:bg-[#362b3e] p-1">
          <label className={`flex cursor-pointer h-full flex-1 items-center justify-center overflow-hidden rounded-lg ${taskType === 'One-Time' ? 'bg-primary text-white shadow-md' : 'text-gray-600 dark:text-gray-400'} text-sm font-bold transition-all duration-200`}>
            <span className="truncate">One-Time</span>
            <input checked={taskType === 'One-Time'} onChange={() => setTaskType('One-Time')} className="hidden" name="task-type" type="radio" value="One-Time" />
          </label>
          <label className={`flex cursor-pointer h-full flex-1 items-center justify-center overflow-hidden rounded-lg ${taskType === 'Recurring' ? 'bg-primary text-white shadow-md' : 'text-gray-600 dark:text-gray-400'} text-sm font-bold transition-all duration-200`}>
            <span className="truncate">Recurring</span>
            <input checked={taskType === 'Recurring'} onChange={() => setTaskType('Recurring')} className="hidden" name="task-type" type="radio" value="Recurring" />
          </label>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 space-y-4 no-scrollbar">
        {/* Pending Review Section */}
        <div className="space-y-2">
          <div className="pt-2 pb-1">
            <h4 className="text-primary dark:text-purple-400 text-sm font-bold uppercase tracking-wider px-1">Pending Review</h4>
          </div>
          {pendingTasks.map(task => (
            <div key={task.id} className="flex flex-col gap-4 rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm border border-gray-100 dark:border-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-bold px-2 py-0.5 rounded-full">Pending</span>
                    <span className={`flex items-center text-xs ${task.priorityColor} font-medium`}>
                      <span className="material-symbols-outlined text-[16px] mr-1">{task.icon}</span>
                      {task.priority}
                    </span>
                  </div>
                  <p className="text-gray-900 dark:text-white text-base font-bold leading-tight">{task.title}</p>
                  <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mt-1">
                    <span className="material-symbols-outlined text-[16px] mr-1.5">event</span>
                    Due {task.due}
                  </div>
                </div>
                {task.image && (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 bg-center bg-cover shrink-0 border border-gray-200 dark:border-gray-700" style={{ backgroundImage: `url('${task.image}')` }}></div>
                )}
              </div>
              <div className="flex gap-3 mt-1">
                <button className="flex-1 flex items-center justify-center h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <span className="material-symbols-outlined text-[18px] mr-2">close</span>
                  Reject
                </button>
                <button className="flex-1 flex items-center justify-center h-10 rounded-lg bg-primary text-white font-bold text-sm shadow-md hover:bg-primary/90 transition-colors">
                  <span className="material-symbols-outlined text-[18px] mr-2">check</span>
                  Accept
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* All Tasks Section */}
        <div className="space-y-4">
          <div className="pt-4 pb-1">
            <h4 className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wider px-1">All Tasks</h4>
          </div>
          {allTasks.map(task => (
            <div key={task.id} className="flex items-center gap-4 rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm border border-gray-100 dark:border-gray-800">
              <div className={`flex items-center justify-center size-10 rounded-full ${task.iconBg} shrink-0`}>
                <span className="material-symbols-outlined">{task.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 dark:text-white text-base font-bold leading-tight truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">{task.date}</span>
                </div>
              </div>
              <span className={`${task.statusColor} text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide`}>
                {task.status}
              </span>
            </div>
          ))}
          {/* Render backend data if available */}
          {tasksData?.data?.map((task: any) => (
            <div key={task.id} className="flex items-center gap-4 rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm border border-gray-100 dark:border-gray-800" onClick={() => navigate(`/tasks/${task.id}`)}>
              <div className="flex items-center justify-center size-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 shrink-0">
                <span className="material-symbols-outlined">assignment</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 dark:text-white text-base font-bold leading-tight truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">{new Date(task.dueDate).toLocaleDateString()}</span>
                </div>
              </div>
              <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                {task.status}
              </span>
            </div>
          ))}
        </div>
        <div className="h-20"></div>
      </main>

      <button
        onClick={() => navigate('/tasks/create')}
        className="absolute bottom-24 right-4 size-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 flex items-center justify-center z-20 transition-transform active:scale-95"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>
    </div>
  );

  if (isAdmin) {
    return (
      <AdminLayout>
        {content}
      </AdminLayout>
    );
  }

  // Employee route - use EmployeeLayout (no BottomNav)
  return (
    <EmployeeLayout>
      {content}
    </EmployeeLayout>
  );
};
