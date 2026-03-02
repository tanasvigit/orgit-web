import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopAppBar, Button } from '../../components/shared';
import { authService } from '../../services/authService';

const formatPhoneNumber = (phone: string) => {
  if (!phone) return phone;
  if (phone.startsWith('+')) {
    const digits = phone.replace(/\D/g, '');
    return '+' + digits;
  }
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
  if (cleaned.length >= 6 && cleaned.length <= 20) return `+91${cleaned.slice(-10)}`;
  return phone;
};

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMobileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const hasPlus = raw.trimStart().startsWith('+');
    const digits = raw.replace(/\D/g, '');
    setMobile(hasPlus ? `+${digits}` : digits);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = formatPhoneNumber(mobile);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Enter at least 10 digits');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.requestPasswordReset({ mobile: formatted });
      if (response?.success) {
        navigate('/reset-password', { state: { mobile: formatted, otpCode: response?.otpCode } });
        return;
      }
      setError(response?.error || 'Something went wrong. Please try again.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden font-display">
      <TopAppBar title="Forgot password" onBack={() => navigate(-1)} />

      <div className="flex flex-col flex-1 w-full max-w-md mx-auto px-6 pt-6">
        <h1 className="text-slate-900 dark:text-white tracking-tight text-2xl font-bold leading-tight text-center">
          Reset your password
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm text-center mt-2">
          Enter your mobile number. We’ll send you an OTP to set a new password (no email required).
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8 w-full">
          <label className="flex flex-col flex-1">
            <p className="text-slate-900 dark:text-white text-base font-medium leading-normal pb-2">
              Mobile Number *
            </p>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={mobile}
              onChange={handleMobileInput}
              placeholder="e.g. 9876543210 or +919876543210"
              className="form-input w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 focus:border-primary h-14 placeholder:text-slate-400 p-[15px] text-lg"
            />
          </label>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
            </div>
          )}

          <Button type="submit" fullWidth disabled={isLoading}>
            {isLoading ? 'Sending OTP...' : 'Send OTP'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-primary font-semibold hover:text-primary/80"
          >
            Back to Login
          </button>
        </p>
      </div>
    </div>
  );
};
