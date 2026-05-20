import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Avatar } from '../shared';
import { chatUserService } from '../../services/chatUserService';
import { conversationService } from '../../services/conversationService';
import { User } from '../../../shared/src/types';
import { useAuth } from '../../context/AuthContext';
import { filterContactsByQuery } from '../../utils/contactPicker';

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
  const [query, setQuery] = useState('');

  const { data: orgContacts = [], isLoading: isLoadingOrg } = useQuery(
    ['org-contacts', 'new-chat'],
    () => conversationService.getOrgContacts(),
    { enabled: visible, staleTime: 60_000 }
  );

  const trimmedQuery = query.trim();
  const digitsOnly = trimmedQuery.replace(/\D/g, '');
  const isFullPhoneSearch = digitsOnly.length === 10;

  const { data: searchData, isFetching: isSearchingRemote } = useQuery(
    ['chat-users-search', trimmedQuery],
    () => chatUserService.searchUsers(trimmedQuery),
    {
      enabled: visible && trimmedQuery.length > 0 && isFullPhoneSearch,
    }
  );

  const remoteSearchUsers: User[] = searchData?.data || [];

  const displayUsers = useMemo(() => {
    const localFiltered = filterContactsByQuery(orgContacts, query);
    if (!isFullPhoneSearch || remoteSearchUsers.length === 0) {
      return localFiltered;
    }
    const seen = new Set(localFiltered.map((u) => u.id));
    const merged = [...localFiltered];
    for (const u of remoteSearchUsers) {
      if (u.id && !seen.has(u.id)) {
        seen.add(u.id);
        merged.push(u);
      }
    }
    return merged;
  }, [orgContacts, query, isFullPhoneSearch, remoteSearchUsers]);

  const queryClient = useQueryClient();

  const createConversationMutation = useMutation(
    (otherUserId: string) => conversationService.createConversation(otherUserId),
    {
      onSuccess: (conversationId) => {
        queryClient.invalidateQueries('conversations');
        onClose();
        setQuery('');
        setTimeout(() => {
          navigate(isAdmin ? `/admin/messages/${conversationId}` : `/messages/${conversationId}`);
        }, 100);
      },
      onError: (error: any) => {
        console.error('Error creating conversation:', error);
      },
    }
  );

  const handleSelectUser = async (userId: string) => {
    try {
      await createConversationMutation.mutateAsync(userId);
    } catch {
      queryClient.invalidateQueries('conversations');

      setTimeout(async () => {
        try {
          const directConversationId = `direct_${userId}`;
          const conversationDetails = await conversationService.getConversationDetails(directConversationId);

          if (conversationDetails) {
            const actualConversationId =
              conversationDetails.conversationId || conversationDetails.id || directConversationId;
            onClose();
            setQuery('');
            navigate(isAdmin ? `/admin/messages/${actualConversationId}` : `/messages/${actualConversationId}`);
          } else {
            onClose();
            setQuery('');
            navigate(isAdmin ? `/admin/messages/${directConversationId}` : `/messages/${directConversationId}`);
          }
        } catch (detailError) {
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

  const isLoading = isLoadingOrg || isSearchingRemote;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-primary dark:bg-primary/90 rounded-t-2xl">
          <h2 className="text-white text-lg font-bold">New Chat</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
            Organization contacts
          </p>
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
                placeholder="Filter org contacts or enter 10-digit mobile"
                className="flex-1 bg-transparent border-0 focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400 px-2"
                autoFocus
              />
            </div>
            {isLoading && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Loading...</p>
            )}
          </div>

          <div className="mt-2 space-y-2">
            {!isLoadingOrg && displayUsers.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                {query.trim()
                  ? 'No matching contacts. Enter a full 10-digit mobile to search all ORGIT users.'
                  : 'No organization contacts found.'}
              </p>
            )}

            {displayUsers.map((contactUser) => (
              <button
                key={contactUser.id}
                onClick={() => handleSelectUser(contactUser.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                <Avatar size="md" src={contactUser.profilePhotoUrl} />
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {contactUser.name || contactUser.mobile}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {contactUser.mobile} {contactUser.role ? `• ${contactUser.role}` : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

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
