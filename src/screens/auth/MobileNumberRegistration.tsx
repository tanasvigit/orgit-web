import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TopAppBar, Button } from '../../components/shared';
import { SimpleCaptchaField } from '../../components/auth/SimpleCaptchaField';
import { authService } from '../../services/authService';

/** Name: 2-50 chars, letters/spaces/hyphens/apostrophes only, no HTML/script (XSS-safe). */
const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be at most 50 characters')
  .regex(
    /^[\p{L}\p{M}\s\-']+$/u,
    'Name can only contain letters, spaces, hyphens, and apostrophes'
  )
  .refine((val) => !/<[^>]*>|<\/\s*script|on\w+\s*=/i.test(val), {
    message: 'Name contains invalid characters',
  });

const mobileSchema = z.object({
  name: nameSchema,
  mobile: z.string().min(10, 'Mobile number must be at least 10 digits'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

type MobileFormData = z.infer<typeof mobileSchema>;

export const MobileNumberRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MobileFormData>({
    resolver: zodResolver(mobileSchema),
  });

  // Helper function to match Mobile logic
  const formatPhoneNumber = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) return `+${cleaned}`;
    if (cleaned.length === 10) return `+91${cleaned}`;
    if (phone.startsWith('+')) return phone;
    return cleaned.length === 10 ? `+91${cleaned}` : phone;
  };

  const toErrorMessage = (input: unknown, fallback: string): string => {
    if (typeof input === 'string') return input;
    if (Array.isArray(input) && input.length > 0) {
      const first = input[0] as any;
      if (typeof first === 'string') return first;
      if (first?.msg && typeof first.msg === 'string') return first.msg;
      return fallback;
    }
    if (input && typeof input === 'object') {
      const maybe = input as any;
      if (typeof maybe.msg === 'string') return maybe.msg;
      if (typeof maybe.error === 'string') return maybe.error;
    }
    return fallback;
  };

  const isCaptchaError = (message: string): boolean => {
    const lower = String(message).toLowerCase();
    return lower.includes('captcha') || lower.includes('security code');
  };

  const onSubmit = async (data: MobileFormData) => {
    setIsLoading(true);
    setError(null);
    setCaptchaError(null);

    try {
      const fullMobile = formatPhoneNumber(data.mobile);
      if (!data.password) {
        setError('Password is required');
        setIsLoading(false);
        return;
      }

      if (!captchaId || !captchaAnswer.trim()) {
        setCaptchaError('Please type the security code');
        setIsLoading(false);
        return;
      }

      if (captchaAnswer.trim().length < 5) {
        setCaptchaError('Please enter complete security code');
        setIsLoading(false);
        return;
      }

      const response = await authService.register({
        name: data.name,
        phone: fullMobile,
        password: data.password,
        captchaId,
        captchaAnswer,
      });

      if (response.success) {
        navigate('/dashboard');
      } else {
        const message = toErrorMessage(response.error, 'Registration failed');
        if (isCaptchaError(message)) {
          setCaptchaError(message);
          setCaptchaId('');
          setCaptchaCode('');
          setCaptchaAnswer('');
        } else {
          setError(message);
        }
      }
    } catch (err: any) {
      console.error('Register error:', err);
      const message = toErrorMessage(
        err.response?.data?.error ?? err.response?.data?.errors ?? err.message,
        'Failed to create account'
      );
      if (isCaptchaError(message)) {
        setCaptchaError(message);
        setCaptchaId('');
        setCaptchaCode('');
        setCaptchaAnswer('');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden font-display">
      <TopAppBar title="Register" onBack={() => navigate(-1)} />

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
          Create Account
        </h1>

        {/* Body Text */}
        <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal py-3 px-6 text-center">
          Sign up to get started
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-6 py-4 w-full">
          {/* Name Field */}
          <label className="flex flex-col min-w-40 flex-1">
            <p className="text-slate-900 dark:text-white text-base font-medium leading-normal pb-2">
              Full Name
            </p>
            <input
              {...register('name')}
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 focus:border-primary h-14 placeholder:text-slate-400 p-[15px] text-lg font-normal leading-normal tracking-wide"
              placeholder="Enter your full name"
              type="text"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </label>

          <label className="flex flex-col min-w-40 flex-1">
            <p className="text-slate-900 dark:text-white text-base font-medium leading-normal pb-2">
              Mobile Number
            </p>
            <div className="flex w-full flex-1 items-stretch rounded-lg shadow-sm">
              <input
                {...register('mobile')}
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 focus:border-primary h-14 placeholder:text-slate-400 p-[15px] text-lg font-normal leading-normal tracking-wide"
                placeholder="Enter mobile number"
                type="tel"
              />
            </div>
            {errors.mobile && (
              <p className="text-red-500 text-sm mt-1">{errors.mobile.message}</p>
            )}
          </label>

          {/* Password Field */}
          <label className="flex flex-col min-w-40 flex-1">
            <p className="text-slate-900 dark:text-white text-base font-medium leading-normal pb-2">
              Password
            </p>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 focus:border-primary h-14 placeholder:text-slate-400 p-[15px] pr-12 text-lg font-normal leading-normal tracking-wide"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => !isLoading && setShowPassword(!showPassword)}
                disabled={isLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-opacity ${
                  isLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <span className="material-symbols-outlined">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
            )}
          </label>

          <SimpleCaptchaField
            captchaId={captchaId}
            captchaCode={captchaCode}
            value={captchaAnswer}
            onChange={(next) => {
              setCaptchaAnswer(next);
              if (next.length > 0) {
                setCaptchaError(null);
                setError(null);
              }
            }}
            onCaptchaLoaded={({ captchaId: nextId, code }) => {
              setCaptchaId(nextId);
              setCaptchaCode(code);
              setCaptchaAnswer('');
            }}
            onRefresh={() => {
              setCaptchaError(null);
            }}
            disabled={isLoading}
            error={captchaError}
          />

          {/* CTA Button */}
          <div className="px-0 pb-4 w-full mt-2">
            {error ? <p className="text-red-500 text-sm mb-3">{error}</p> : null}
            <Button type="submit" fullWidth disabled={isLoading}>
              {isLoading ? 'Registering...' : 'Register'}
            </Button>
          </div>
        </form>

        {/* Login Link */}
        <div className="px-6 py-2">
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-primary font-semibold hover:text-primary/80 underline decoration-primary/30 underline-offset-2 transition-colors"
            >
              Login
            </button>
          </p>
        </div>

        {/* Terms Footer */}
        <div className="px-6 py-4 mt-auto mb-6">
          <p className="text-center text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            By continuing, you agree to our{' '}
            <a
              className="text-primary hover:text-primary/80 underline decoration-primary/30 underline-offset-2 transition-colors"
              href="#"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              className="text-primary hover:text-primary/80 underline decoration-primary/30 underline-offset-2 transition-colors"
              href="#"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>

        {/* Spacer */}
        <div className="h-4 w-full" />
      </div>
    </div>
  );
};

