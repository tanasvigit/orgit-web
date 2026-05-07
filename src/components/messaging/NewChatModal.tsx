import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Avatar } from '../shared';
import { chatUserService } from '../../services/chatUserService';
import { conversationService } from '../../services/conversationService';
import { User } from '../../../shared/src/types';
import { useAuth } from '../../context/AuthContext';

interface NewChatModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  visible,
  onClose,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const currentOrgId = (user as any)?.organizationId || (user as any)?.organization_id;
  const [query, setQuery] = useState('');

  const { data, isFetching } = useQuery(
    ['chat-users', query, currentOrgId],
    () => chatUserService.searchUsers(query, currentOrgId),
    {
      enabled: visible && query.trim().length > 0,
    }
  );

  const users: User[] = data?.data || [];

  const queryClient = useQueryClient();

  // Create conversation mutation
  const createConversationMutation = useMutation(
    (otherUserId: string) => conversationService.createConversation(otherUserId),
    {
      onSuccess: (conversationId) => {
        // Invalidate conversations query to refresh the list
        queryClient.invalidateQueries('conversations');
        onClose();
        setQuery('');
        // Small delay to ensure conversation is created before navigation
        setTimeout(() => {
          navigate(isAdmin ? `/admin/messages/${conversationId}` : `/messages/${conversationId}`);
        }, 100);
      },
      onError: (error: any) => {
        // Error handling is done in handleSelectUser catch block
        console.error('Error creating conversation:', error);
      }
    }
  );

  const handleSelectUser = async (userId: string) => {
    try {
      // Try to create conversation first
      await createConversationMutation.mutateAsync(userId);
    } catch (error: any) {
      // If creation fails, the conversation might already exist
      // Try to find the existing conversation from the conversations list
      queryClient.invalidateQueries('conversations');
      
      // Wait a bit for conversations to refresh, then try to find the conversation
      setTimeout(async () => {
        try {
          // Try to get conversation details using direct format
          const directConversationId = `direct_${userId}`;
          const conversationDetails = await conversationService.getConversationDetails(directConversationId);
          
          if (conversationDetails) {
            const actualConversationId = conversationDetails.conversationId || conversationDetails.id || directConversationId;
            onClose();
            setQuery('');
            navigate(isAdmin ? `/admin/messages/${actualConversationId}` : `/messages/${actualConversationId}`);
          } else {
            // Fallback: use direct format
            onClose();
            setQuery('');
            navigate(isAdmin ? `/admin/messages/${directConversationId}` : `/messages/${directConversationId}`);
          }
        } catch (detailError) {
          // Final fallback: use direct format
          console.error('Error getting conversation details:', detailError);
          const conversationId = `direct_${userId}`;
          onClose();
          setQuery('');
          navigate(isAdmin ? `/admin/messages/${conversationId}` : `/messages/${conversationId}`);
        }
      }, 300);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-primary dark:bg-primary/90 rounded-t-2xl">
          <h2 className="text-white text-lg font-bold">New Chat</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search by name or mobile number
            </label>
            <div className="flex w-full items-stretch rounded-xl h-12 shadow-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-center px-3 text-gray-400">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  search
                </span>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter name or mobile number (e.g. 9876543210)"
                className="flex-1 bg-transparent border-0 focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400 px-2"
                autoFocus
              />
            </div>
            {isFetching && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Searching...</p>
            )}
          </div>

          <div className="mt-2 space-y-2">
            {users.length === 0 && query && !isFetching && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No users found for &quot;{query}&quot;. Make sure the number is registered in ORGIT.
              </p>
            )}

            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                <Avatar size="md" src={user.profilePhotoUrl} />
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {user.name || user.mobile}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {user.mobile} {user.role ? `• ${user.role}` : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

