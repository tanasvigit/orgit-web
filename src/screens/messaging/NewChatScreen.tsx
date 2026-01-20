import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { TopAppBar, Avatar } from '../../components/shared';
import { chatUserService } from '../../services/chatUserService';
import { conversationService } from '../../services/conversationService';
import { User } from '../../../shared/src/types';
import { useAuth } from '../../context/AuthContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';

export const NewChatScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [query, setQuery] = useState('');

  const { data, isFetching } = useQuery(
    ['chat-users', query],
    () => chatUserService.searchUsers(query),
    {
      enabled: query.trim().length > 0,
    }
  );

  const users: User[] = data?.data || [];

  // Create conversation mutation
  const createConversationMutation = useMutation(
    (otherUserId: string) => conversationService.createConversation(otherUserId),
    {
      onSuccess: (conversationId) => {
        navigate(isAdmin ? `/admin/messages/${conversationId}` : `/messages/${conversationId}`);
      },
      onError: (error: any) => {
        // If conversation already exists, use direct format
        const conversationId = `direct_${users.find(u => u.id === users[0]?.id)?.id}`;
        navigate(isAdmin ? `/admin/messages/${conversationId}` : `/messages/${conversationId}`);
      }
    }
  );

  const handleSelectUser = async (userId: string) => {
    try {
      // Try to create conversation first
      await createConversationMutation.mutateAsync(userId);
    } catch (error) {
      // If creation fails, use direct format (conversation might already exist)
      const conversationId = `direct_${userId}`;
      navigate(isAdmin ? `/admin/messages/${conversationId}` : `/messages/${conversationId}`);
    }
  };

  const content = (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display">
      <TopAppBar title="New Chat" onBack={() => navigate(-1)} />

      <div className="p-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-main-light dark:text-text-main-dark mb-2">
            Search by name or mobile number
          </label>
          <div className="flex w-full items-stretch rounded-xl h-12 shadow-sm bg-surface-light dark:bg-surface-dark">
            <div className="flex items-center justify-center px-3 text-text-sub-light dark:text-text-sub-dark">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                search
              </span>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter name or mobile number (e.g. 9876543210)"
              className="flex-1 bg-transparent border-0 focus:outline-none text-text-main-light dark:text-text-main-dark placeholder:text-text-sub-light/70 px-2"
            />
          </div>
          {isFetching && (
            <p className="text-xs text-text-sub-light mt={2}">Searching...</p>
          )}
        </div>

        <div className="mt-2 space-y-2">
          {users.length === 0 && query && !isFetching && (
            <p className="text-sm text-text-sub-light">
              No users found for &quot;{query}&quot;. Make sure the number is registered in ORGIT.
            </p>
          )}

          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelectUser(user.id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-light dark:hover:bg-surface-dark text-left transition-colors border border-transparent hover:border-border-light"
            >
              <Avatar size="md" src={user.profilePhotoUrl} />
              <div className="flex flex-col">
                <span className="font-medium text-text-main-light dark:text-text-main-dark">
                  {user.name || user.mobile}
                </span>
                <span className="text-xs text-text-sub-light dark:text-text-sub-dark">
                  {user.mobile} {user.role ? `• ${user.role}` : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Wrap in appropriate layout
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

