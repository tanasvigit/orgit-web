import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopAppBar, Button } from '../../components/shared';

export const AddDocumentScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <TopAppBar title="Add Document" onBack={() => navigate(-1)} />
      <div className="p-4">
        <p>Add document form coming soon</p>
      </div>
    </div>
  );
};

