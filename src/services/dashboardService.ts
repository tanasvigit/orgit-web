import api from './api';

export const dashboardService = {
  getDashboard: async (dueSoonDays = 3) => {
    const response = await api.get(`/dashboard?dueSoonDays=${dueSoonDays}`);
    return response.data;
  },

  getStatistics: async () => {
    const response = await api.get('/dashboard/statistics');
    return response.data;
  },
};

