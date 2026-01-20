import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopAppBar } from '../../components/shared';

export const ComplianceCreateScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <TopAppBar title="Create Compliance" onBack={() => navigate(-1)} />
      <div className="p-4">
        <p>Compliance creation form coming soon</p>
      </div>
    </div>
  );
};

