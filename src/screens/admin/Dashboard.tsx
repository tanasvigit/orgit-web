import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { dashboardService } from '../../services/dashboardService';
import { taskService } from '../../services/taskService';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery(
    ['admin-dashboard'],
    () => dashboardService.getDashboard(3),
    { refetchInterval: 30000 }
  );

  const { data: statistics } = useQuery('admin-statistics', () =>
    dashboardService.getStatistics()
  );

  const { data: tasksData, isLoading: tasksLoading } = useQuery(
    ['admin-tasks', taskFilter],
    () => taskService.getTasks({ status: taskFilter === 'all' ? undefined : taskFilter })
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const stats = statistics?.data || {};
  const tasks = tasksData?.data?.items || [];

  // Flatten nested task structures from backend
  const flattenTasks = (taskGroups: any) => {
    if (!taskGroups || typeof taskGroups !== 'object') return [];
    const allTasks: any[] = [];
    Object.values(taskGroups).forEach((category: any) => {
      if (category && typeof category === 'object') {
        Object.values(category).forEach((taskArray: any) => {
          if (Array.isArray(taskArray)) {
            allTasks.push(...taskArray);
          }
        });
      }
    });
    return allTasks;
  };

  const selfTasks = flattenTasks(dashboardData?.data?.selfTasks || {});
  const assignedTasks = flattenTasks(dashboardData?.data?.assignedTasks || {});

  // Get recent tasks for display
  const recentSelfTasks = selfTasks.slice(0, 3);
  const recentAssignedTasks = assignedTasks.slice(0, 2);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      overdue: { bg: 'bg-red-50', text: 'text-red-600', label: 'Overdue' },
      duesoon: { bg: 'bg-red-50', text: 'text-red-600', label: 'Due Soon' },
      inprogress: { bg: 'bg-orange-50', text: 'text-orange-600', label: 'In Progress' },
      completed: { bg: 'bg-green-50', text: 'text-green-600', label: 'Completed' },
      pending: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Pending' },
    };
    const statusInfo = statusMap[status.toLowerCase()] || statusMap.pending;
    return (
      <span className={`${statusInfo.bg} ${statusInfo.text} text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide`}>
        {statusInfo.label}
      </span>
    );
  };

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return 'No due date';
    const date = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(date);
    due.setHours(0, 0, 0, 0);

    if (due < today) {
      return `Due: ${format(date, 'MMM d, yyyy')}`;
    }
    if (due.getTime() === today.getTime()) {
      return 'Due: Today';
    }
    return `Due: ${format(date, 'MMM d, yyyy')}`;
  };

  if (dashboardLoading || tasksLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-text-muted">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-text-main tracking-tight mb-1">
                {getGreeting()}, {user?.name?.split(' ')[0] || 'Admin'}
              </h1>
              <p className="text-text-muted text-sm">Here's what's happening with your organization today.</p>
            </div>
            <button
              onClick={() => navigate('/admin/tasks/create')}
              className="bg-primary hover:bg-primary-700 text-white font-semibold py-2.5 px-6 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-primary/20 active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>New Task</span>
            </button>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="border-l-4 border-l-blue-600 bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 relative overflow-hidden group">
              <div className="flex justify-between items-start z-10">
                <h3 className="text-slate-500 font-semibold text-sm">Self Tasks</h3>
                <span className="material-symbols-outlined text-primary-600">person</span>
              </div>
              <p className="text-4xl font-bold text-slate-800 z-10">{stats.selfTasksTotal || 0}</p>
              <div className="absolute -right-4 -bottom-4 bg-blue-50 w-24 h-24 rounded-full group-hover:scale-110 transition-transform"></div>
            </div>

            <div className="border-l-4 border-l-sky-500 bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 relative overflow-hidden group">
              <div className="flex justify-between items-start z-10">
                <h3 className="text-slate-500 font-semibold text-sm">Assigned Tasks</h3>
                <span className="material-symbols-outlined text-sky-500">assignment_ind</span>
              </div>
              <p className="text-4xl font-bold text-slate-800 z-10">{stats.assignedTasksTotal || 0}</p>
              <div className="absolute -right-4 -bottom-4 bg-sky-50 w-24 h-24 rounded-full group-hover:scale-110 transition-transform"></div>
            </div>

            <div className="border-l-4 border-l-orange-500 bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 relative overflow-hidden group">
              <div className="flex justify-between items-start z-10">
                <h3 className="text-slate-500 font-semibold text-sm">In Progress</h3>
                <span className="material-symbols-outlined text-orange-500">pending_actions</span>
              </div>
              <p className="text-4xl font-bold text-slate-800 z-10">
                {(stats.selfTasksInProgress || 0) + (stats.assignedTasksInProgress || 0)}
              </p>
              <div className="absolute -right-4 -bottom-4 bg-orange-50 w-24 h-24 rounded-full group-hover:scale-110 transition-transform"></div>
            </div>

            <div className="border-l-4 border-l-red-500 bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 relative overflow-hidden group">
              <div className="flex justify-between items-start z-10">
                <h3 className="text-slate-500 font-semibold text-sm">Escalated</h3>
                <span className="material-symbols-outlined text-red-500">warning</span>
              </div>
              <p className="text-4xl font-bold text-slate-800 z-10">
                {(stats.selfTasksOverdue || 0) + (stats.assignedTasksOverdue || 0)}
              </p>
              <div className="absolute -right-4 -bottom-4 bg-red-50 w-24 h-24 rounded-full group-hover:scale-110 transition-transform"></div>
            </div>
          </div>

          {/* Self Tasks Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-600"></div>
                <h3 className="text-lg font-bold text-text-main">Self Tasks</h3>
              </div>
              <button
                onClick={() => navigate('/admin/tasks?view=self')}
                className="text-sm font-semibold text-primary-700 hover:text-primary-800"
              >
                View All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentSelfTasks.length > 0 ? (
                recentSelfTasks.map((task: any) => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/admin/tasks/${task.id}`)}
                    className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-4">
                      {getStatusBadge(task.status)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle menu
                        }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                      </button>
                    </div>
                    <h4 className="font-bold text-slate-900 mb-2 group-hover:text-primary-700 transition-colors">
                      {task.title}
                    </h4>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed line-clamp-2">
                      {task.description || 'No description'}
                    </p>
                    <div
                      className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg w-max ${task.status === 'overdue' || task.status === 'duesoon'
                          ? 'text-red-500 bg-red-50'
                          : 'text-slate-500 bg-slate-50'
                        }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {task.status === 'overdue' ? 'calendar_today' : 'schedule'}
                      </span>
                      <span>{formatDueDate(task.dueDate)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center py-8 text-text-muted">
                  No self tasks found
                </div>
              )}
            </div>
          </div>

          {/* Assigned Tasks Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-sky-400"></div>
                <h3 className="text-lg font-bold text-text-main">Assigned Tasks</h3>
              </div>
              <button
                onClick={() => navigate('/admin/tasks?view=assigned')}
                className="text-sm font-semibold text-primary-700 hover:text-primary-800"
              >
                View All
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {recentAssignedTasks.length > 0 ? (
                recentAssignedTasks.map((task: any) => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/admin/tasks/${task.id}`)}
                    className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-4 hover:shadow-md transition-all cursor-pointer"
                  >
                    {task.assignee?.profilePhotoUrl ? (
                      <div
                        className="size-12 shrink-0 rounded-full bg-cover bg-center border border-slate-200"
                        style={{ backgroundImage: `url(${task.assignee.profilePhotoUrl})` }}
                      />
                    ) : (
                      <div className="size-12 shrink-0 rounded-full bg-primary flex items-center justify-center text-white font-bold border border-slate-200">
                        {task.assignee?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="flex-1 w-full">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-bold text-slate-900 text-sm md:text-base">{task.title}</h4>
                        {getStatusBadge(task.status)}
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        {task.assignee?.name || 'Unassigned'}
                      </p>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${task.status === 'completed'
                              ? 'bg-green-500 w-full'
                              : task.status === 'inprogress'
                                ? 'bg-orange-500 w-2/3'
                                : 'bg-blue-500 w-1/3'
                            }`}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-8 text-text-muted">
                  No assigned tasks found
                </div>
              )}
            </div>
          </div>

          {/* All Tasks Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${taskFilter === 'all'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  All Tasks
                </button>
                <button
                  onClick={() => setTaskFilter('pending')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${taskFilter === 'pending'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setTaskFilter('completed')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${taskFilter === 'completed'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  Completed
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-xs uppercase font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Task Name</th>
                    <th className="px-6 py-4">Assignees</th>
                    <th className="px-6 py-4">Due Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.slice(0, 5).map((task: any) => (
                    <tr
                      key={task.id}
                      onClick={() => navigate(`/admin/tasks/${task.id}`)}
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm mb-1">{task.title}</span>
                          <span className="text-xs text-slate-500">
                            {task.category || 'General'} • {task.taskType === 'RECURRING' ? 'Recurring' : 'One-Time'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-2">
                          {task.assignments?.slice(0, 2).map((assignment: any, idx: number) => (
                            <div
                              key={idx}
                              className="size-8 rounded-full ring-2 ring-white bg-primary flex items-center justify-center text-white text-xs font-bold"
                            >
                              {assignment.assignee?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                          ))}
                          {task.assignments?.length > 2 && (
                            <div className="size-8 rounded-full ring-2 ring-white bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                              +{task.assignments.length - 2}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-900">
                          {task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : 'No due date'}
                        </span>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(task.status)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle menu
                          }}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <span className="material-symbols-outlined">more_horiz</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-text-muted">
                        No tasks found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </AdminLayout>
  );
};

