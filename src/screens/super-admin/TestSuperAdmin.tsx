import React from 'react';
import { useAuth } from '../../context/AuthContext';

// Simple test component to verify routing works
export const TestSuperAdmin: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Super Admin Route Test</h1>
        
        <div className="space-y-4">
          <div>
            <strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}
          </div>
          
          <div>
            <strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}
          </div>
          
          <div>
            <strong>User:</strong> {user ? JSON.stringify(user, null, 2) : 'null'}
          </div>
          
          <div>
            <strong>User Role:</strong> {user?.role || 'N/A'}
          </div>
          
          <div>
            <strong>Is Super Admin:</strong> {user?.role === 'super_admin' ? 'YES ✓' : 'NO ✗'}
          </div>
          
          {user?.role !== 'super_admin' && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
              <strong>Warning:</strong> Your role is "{user?.role || 'unknown'}", not "super_admin".
              <br />
              Update your user role in the database to "super_admin".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

