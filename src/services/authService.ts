import api from './api';

export interface RequestOTPRequest {
  mobile: string;
}

export interface VerifyOTPRequest {
  mobile: string;
  otpCode: string;
  deviceId?: string;
  deviceType?: 'mobile' | 'web';
  password?: string; // Optional password for new user registration
  name?: string; // Optional name for new user registration
}

export interface LoginWithPasswordRequest {
  mobile: string;
  password: string;
  deviceId?: string;
  deviceType?: 'mobile' | 'web';
}

export interface ProfileSetupRequest {
  name: string;
  profilePhotoUrl?: string;
  bio?: string;
}

export interface RegisterRequest {
  name: string;
  phone: string;
  password: string;
}

export interface ContactSyncRequest {
  contacts: Array<{
    name: string;
    mobile: string;
  }>;
}

export const authService = {
  requestOTP: async (data: RequestOTPRequest) => {
    const response = await api.post('/auth/request-otp', data);
    return response.data;
  },

  register: async (data: RegisterRequest) => {
    const response = await api.post('/auth/register', data);
    if (response.data.success && response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  verifyOTP: async (data: VerifyOTPRequest) => {
    const response = await api.post('/auth/verify-otp', data);
    if (response.data.success && response.data.data.token) {
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('refreshToken', response.data.data.refreshToken);
    }
    return response.data;
  },

  loginWithPassword: async (data: LoginWithPasswordRequest) => {
    const deviceId = localStorage.getItem('deviceId') || `web-${Date.now()}`;
    localStorage.setItem('deviceId', deviceId);

    const response = await api.post('/auth/login', {
      ...data,
      deviceId,
      deviceType: 'web',
    });
    if (response.data.success && response.data.data.token) {
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('refreshToken', response.data.data.refreshToken);
    }
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  setupProfile: async (data: ProfileSetupRequest) => {
    const response = await api.put('/auth/profile', data);
    return response.data;
  },

  syncContacts: async (data: ContactSyncRequest) => {
    const response = await api.post('/auth/contacts/sync', data);
    return response.data;
  },

  getUserById: async (userId: string) => {
    const response = await api.get(`/auth/user/${userId}`);
    return response.data;
  },

  updateProfile: async (data: { name?: string; bio?: string; about?: string; contact_number?: string; profile_photo?: string }) => {
    const response = await api.put('/auth/profile', data);
    return response.data;
  },

  uploadProfilePhoto: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload/profile-photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await api.put('/auth/change-password', data);
    return response.data;
  },
};

