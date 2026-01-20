import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TopAppBar, Button } from '../../components/shared';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

const passwordLoginSchema = z.object({
  mobile: z.string().min(10, 'Mobile number must be at least 10 digits'),
  password: z.string().min(1, 'Password is required'),
});

const otpLoginSchema = z.object({
  mobile: z.string().min(10, 'Mobile number must be at least 10 digits'),
});

type PasswordLoginFormData = z.infer<typeof passwordLoginSchema>;
type OTPLoginFormData = z.infer<typeof otpLoginSchema>;

type LoginTab = 'password' | 'otp';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<LoginTab>('password');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Helper function to match Mobile logic
  const formatPhoneNumber = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) return `+${cleaned}`;
    if (cleaned.length === 10) return `+91${cleaned}`;
    if (phone.startsWith('+')) return phone;
    return cleaned.length === 10 ? `+91${cleaned}` : phone;
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
      const fullMobile = formatPhoneNumber(data.mobile);
      const response = await authService.loginWithPassword({
        mobile: fullMobile,
        password: data.password,
      });

      if (response.success && response.data) {
        login(
          response.data.token,
          response.data.refreshToken,
          response.data.user
        );
        // Check if profile is complete, otherwise redirect to profile setup
        if (!response.data.user.name || response.data.user.name.startsWith('User ')) {
          navigate('/profile-setup');
        } else {
          // Redirect based on user role
          if (response.data.user.role === 'admin') {
            navigate('/admin');
          } else if (response.data.user.role === 'super_admin') {
            navigate('/super-admin');
          } else {
            navigate('/dashboard');
          }
        }
      } else {
        setError(response.error || 'Invalid mobile number or password');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
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
        {/* Header Image */}
        <div className="px-4 py-3">
          <div
            className="w-full bg-center bg-no-repeat bg-cover flex flex-col justify-end overflow-hidden bg-white dark:bg-white/5 rounded-xl min-h-[220px] shadow-sm relative"
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAPQVP8vXSeuHY6n8innftEZL3YSizIfMwAOz5zy_sYIDKvHPBxRfTOuY-swonDt62qT-fJ3PVZIpvfXHH-HtoQEAHUer0stwpi8X-Pa9rn32IM4kHkyHRK5cIhvx8xwHqnSlMKHqsrQT1ONFgNLH9k-gzh0Lg9iX4T4P7QfNB0BhwPUEdIJO_NL9afI373oBOAjPS430nSZ-LW0X8TuETXRoE9YjVuU7OlVfB26Hevu0arKSeWaw2CxssA0xdXcUw-PPI0n37alFqV")',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-background-light dark:from-background-dark to-transparent opacity-60" />
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-slate-900 dark:text-white tracking-tight text-[32px] font-bold leading-tight px-6 text-center pt-4">
          Welcome back
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

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  // TODO: Implement forgot password flow
                  alert('Forgot password feature coming soon');
                }}
                className="text-sm text-primary hover:text-primary/80 underline decoration-primary/30 underline-offset-2 transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}

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
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 focus:border-primary h-14 placeholder:text-slate-400 p-[15px] text-lg font-normal leading-normal tracking-wide"
                  placeholder="Enter mobile number"
                  type="tel"
                />
              </div>
              {otpForm.formState.errors.mobile && (
                <p className="text-red-500 text-sm mt-1">{otpForm.formState.errors.mobile.message}</p>
              )}
            </label>

            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}

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

