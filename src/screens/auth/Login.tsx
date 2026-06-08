import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TopAppBar, Button } from '../../components/shared';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

// Mobile: only digits and optional leading +. No letters or other characters.
const mobileSchema = z
  .string()
  .min(1, 'Mobile number is required')
  .regex(/^\+?[0-9]+$/, 'Characters are not allowed. Enter numbers only.')
  .refine((val) => (val.replace(/\D/g, '').length >= 10), 'Mobile number must be at least 10 digits');

const passwordLoginSchema = z.object({
  mobile: mobileSchema,
  password: z.string().min(1, 'Password is required'),
});

const otpLoginSchema = z.object({
  mobile: mobileSchema,
});

type PasswordLoginFormData = z.infer<typeof passwordLoginSchema>;
type OTPLoginFormData = z.infer<typeof otpLoginSchema>;

type LoginTab = 'password' | 'otp';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<LoginTab>('password');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Restrict mobile input to numbers only (and optional leading +)
  const handleMobileInput = (field: 'mobile', form: 'password' | 'otp') => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const hasPlus = raw.trimStart().startsWith('+');
      const digits = raw.replace(/\D/g, '');
      const value = hasPlus ? `+${digits}` : digits;

      if (form === 'password') {
        passwordForm.setValue(field, value, { shouldValidate: true });
      } else {
        otpForm.setValue(field, value, { shouldValidate: true });
      }
    };
  };

  // Helper function to normalize mobile number - accepts 10 digits, 12 digits starting with 91, or +91XXXXXXXXXX
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    // If already has +, normalize digits after +
    if (phone.startsWith('+')) {
      const digits = phone.replace(/\D/g, '');
      return '+' + digits;
    }
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    // 10 digits: add +91 prefix
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    // 12 digits starting with 91: add + prefix
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return `+${cleaned}`;
    }
    // Other lengths: try to normalize (take last 10 digits if longer, or use as-is if 6-20 digits)
    if (cleaned.length >= 6 && cleaned.length <= 20) {
      if (cleaned.length > 10) {
        // If longer than 10, take last 10 digits (assume country code prefix)
        return `+91${cleaned.slice(-10)}`;
      }
      return `+91${cleaned}`;
    }
    // Return as-is if can't normalize (will fail backend validation)
    return phone;
  };

  const passwordForm = useForm<PasswordLoginFormData>({
    resolver: zodResolver(passwordLoginSchema),
  });

  const otpForm = useForm<OTPLoginFormData>({
    resolver: zodResolver(otpLoginSchema),
  });

  const onPasswordLogin = async (data: PasswordLoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Login UI] Starting password login');
      console.log('[Login UI] Raw input - mobile:', data.mobile, 'password length:', data.password?.length);
      
      const fullMobile = formatPhoneNumber(data.mobile);
      console.log('[Login UI] Formatted mobile:', fullMobile);
      console.log('[Login UI] Sending login request to backend...');
      
      const requestPayload = {
        mobile: fullMobile,
        password: data.password,
      };
      console.log('[Login UI] Request payload:', { ...requestPayload, password: '***' });
      
      const response = await authService.loginWithPassword(requestPayload);
      
      console.log('[Login UI] Response received:', {
        success: response.success,
        hasData: !!response.data,
        error: response.error,
        userRole: response.data?.user?.role,
      });

      if (response.success && response.data) {
        console.log('[Login UI] Login successful, storing tokens and user data');
        login(
          response.data.token,
          response.data.refreshToken,
          response.data.user
        );
        // Check if profile is complete, otherwise redirect to profile setup
        if (!response.data.user.name || response.data.user.name.startsWith('User ')) {
          console.log('[Login UI] Redirecting to profile setup');
          navigate('/profile-setup');
        } else {
          // Redirect based on user role
          const redirectPath = response.data.user.role === 'admin' 
            ? '/admin' 
            : response.data.user.role === 'super_admin' 
            ? '/super-admin' 
            : '/dashboard';
          console.log('[Login UI] Redirecting to:', redirectPath);
          navigate(redirectPath);
        }
      } else {
        // Backend should not reach here with success=false on 2xx, but handle defensively
        const errorMsg = response.message || response.error || 'Invalid mobile number or password.';
        console.error('[Login UI] Login failed (2xx with success=false):', errorMsg);
        console.error('[Login UI] Full response:', response);
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error('[Login UI] Login exception:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText,
        stack: err.stack,
      });
      
      // Map server responses to safe, user-friendly messages without revealing which field is wrong.
      let errorMsg = 'Login failed. Please try again.';
      const status = err.response?.status;
      const data = err.response?.data || {};

      if (status === 401) {
        // Invalid credentials – do not reveal whether mobile/email or password is incorrect
        errorMsg = data.message || 'Invalid mobile number or password.';
      } else if (status === 400) {
        // Validation / bad request from backend
        errorMsg = data.message || 'Invalid request. Please check your input.';
      } else if (status === 403) {
        errorMsg = 'Your account is not active. Please contact administrator.';
      } else if (!err.response) {
        errorMsg = 'Network error. Please check your internet connection.';
      } else if (data.message) {
        errorMsg = data.message;
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      console.error('[Login UI] Setting error:', errorMsg);
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
      console.log('[Login UI] Login attempt completed');
    }
  };

  const onOTPLogin = async (data: OTPLoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const fullMobile = formatPhoneNumber(data.mobile);
      const response = await authService.requestOTP({ mobile: fullMobile });
      if (response.success) {
        navigate('/otp-verification', {
          state: {
            mobile: fullMobile,
            rawMobile: data.mobile,
            isLogin: true, // Flag to indicate this is login, not registration
          },
        });
      } else {
        setError(response.error || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden font-display">
      <TopAppBar title="Login" onBack={() => navigate(-1)} />

      <div className="flex flex-col flex-1 w-full max-w-md mx-auto">
        <img
          src="/orgit-logo.png?v=3"
          alt="ORGIT"
          className="mx-auto mt-6 h-20 w-20 object-contain"
        />
        {/* Headline */}
        <h1 className="text-slate-900 dark:text-white tracking-tight text-[32px] font-bold leading-tight px-6 text-center pt-4">
          Welcome
        </h1>

        {/* Body Text */}
        <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal py-3 px-6 text-center">
          Choose your preferred login method
        </p>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setActiveTab('password');
                setError(null);
              }}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-all ${activeTab === 'password'
                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('otp');
                setError(null);
              }}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-all ${activeTab === 'otp'
                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
            >
              OTP
            </button>
          </div>
        </div>

        {/* Password Login Form */}
        {activeTab === 'password' && (
          <form onSubmit={passwordForm.handleSubmit(onPasswordLogin)} className="flex flex-col gap-4 px-6 py-4 w-full">
            <label className="flex flex-col min-w-40 flex-1">
              <p className="text-slate-900 dark:text-white text-base font-medium leading-normal pb-2">
                Mobile Number
              </p>
              <div className="flex w-full flex-1 items-stretch rounded-lg shadow-sm">
                <input
                  {...passwordForm.register('mobile')}
                  onInput={handleMobileInput('mobile', 'password')}
                  inputMode="numeric"
                  autoComplete="tel"
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 focus:border-primary h-14 placeholder:text-slate-400 p-[15px] text-lg font-normal leading-normal tracking-wide"
                  placeholder="Enter mobile number"
                  type="tel"
                />
              </div>
              {passwordForm.formState.errors.mobile && (
                <p className="text-red-500 text-sm mt-1">{passwordForm.formState.errors.mobile.message}</p>
              )}
            </label>

            <label className="flex flex-col min-w-40 flex-1">
              <p className="text-slate-900 dark:text-white text-base font-medium leading-normal pb-2">
                Password
              </p>
              <div className="relative">
                <input
                  {...passwordForm.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 focus:border-primary h-14 placeholder:text-slate-400 p-[15px] pr-12 text-lg font-normal leading-normal tracking-wide"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {passwordForm.formState.errors.password && (
                <p className="text-red-500 text-sm mt-1">{passwordForm.formState.errors.password.message}</p>
              )}
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm text-primary hover:text-primary/80 font-medium"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="mt-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">error</span>
                  {error}
                </p>
              </div>
            )}

            <div className="px-0 pb-4 w-full mt-2">
              <Button type="submit" fullWidth disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </div>
          </form>
        )}

        {/* OTP Login Form */}
        {activeTab === 'otp' && (
          <form onSubmit={otpForm.handleSubmit(onOTPLogin)} className="flex flex-col gap-4 px-6 py-4 w-full">
            <label className="flex flex-col min-w-40 flex-1">
              <p className="text-slate-900 dark:text-white text-base font-medium leading-normal pb-2">
                Mobile Number
              </p>
              <div className="flex w-full flex-1 items-stretch rounded-lg shadow-sm">
                <input
                  {...otpForm.register('mobile')}
                  onInput={handleMobileInput('mobile', 'otp')}
                  inputMode="numeric"
                  autoComplete="tel"
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 focus:border-primary h-14 placeholder:text-slate-400 p-[15px] text-lg font-normal leading-normal tracking-wide"
                  placeholder="Enter mobile number (numbers only)"
                  type="tel"
                />
              </div>
              {otpForm.formState.errors.mobile && (
                <p className="text-red-500 text-sm mt-1">{otpForm.formState.errors.mobile.message}</p>
              )}
            </label>

            {error && (
              <div className="mt-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">error</span>
                  {error}
                </p>
              </div>
            )}

            <div className="px-0 pb-4 w-full mt-2">
              <Button type="submit" fullWidth disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Get OTP'}
              </Button>
            </div>
          </form>
        )}

        {/* Register Link */}
        <div className="px-6 py-2">
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/register')}
              className="text-primary font-semibold hover:text-primary/80 underline decoration-primary/30 underline-offset-2 transition-colors"
            >
              Register
            </button>
          </p>
        </div>

        {/* Spacer */}
        <div className="h-4 w-full" />
      </div>
    </div>
  );
};

