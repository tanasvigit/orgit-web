import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TopAppBar, Button } from '../../components/shared';
import { authService } from '../../services/authService';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { mobile?: string; otpCode?: string };
  const mobile = state?.mobile || '';
  const devOtp = state?.otpCode; // Dev only: pre-fill OTP when returned by API

  const [otp, setOtp] = useState(() => {
    if (state?.otpCode && /^\d{6}$/.test(state.otpCode)) {
      return state.otpCode.split('');
    }
    return ['', '', '', '', '', ''];
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!mobile) {
      navigate('/forgot-password', { replace: true });
    }
  }, [mobile, navigate]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError(null);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d+$/.test(pasted)) {
      const newOtp = pasted.split('').concat(Array(6 - pasted.length).fill(''));
      setOtp(newOtp.slice(0, 6));
      inputRefs.current[Math.min(pasted.length - 1, 5)]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the full 6-digit OTP');
      return;
    }
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!mobile) {
      setError('Session expired. Please start again from Forgot password.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await authService.resetPasswordWithOTP({
        mobile,
        otpCode,
        newPassword,
      });
      if (response?.success) {
        setSuccess(true);
        return;
      }
      setError(response?.error || 'Failed to reset password.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid or expired OTP, or failed to reset. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!mobile) {
    return (
      <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark">
        <TopAppBar title="Reset password" onBack={() => navigate('/forgot-password')} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">Session expired. Please request a new OTP.</p>
            <Button onClick={() => navigate('/forgot-password')}>Go to Forgot password</Button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark">
        <TopAppBar title="Password reset" onBack={() => navigate('/login')} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <p className="text-green-600 dark:text-green-400 font-medium mb-2">Password has been reset successfully.</p>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">You can now log in with your new password.</p>
            <Button onClick={() => navigate('/login')} fullWidth>Go to Login</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden font-display">
      <TopAppBar title="Set new password" onBack={() => navigate('/forgot-password')} />

      <div className="flex flex-col flex-1 w-full max-w-md mx-auto px-6 pt-6">
        <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-2">
          OTP sent to {mobile.replace(/(\+\d{2})(\d{4})(\d+)/, '$1 **** $3')}
          {devOtp && (
            <span className="block mt-2 text-green-600 dark:text-green-400 font-mono font-semibold">
              Dev: OTP is {devOtp}
            </span>
          )}
        </p>
        <h1 className="text-slate-900 dark:text-white tracking-tight text-xl font-bold leading-tight text-center mb-6">
          Enter OTP and new password
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
          <div>
            <p className="text-slate-900 dark:text-white text-base font-medium pb-2">OTP *</p>
            <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-11 h-14 text-center text-lg rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              ))}
            </div>
          </div>

          <label className="flex flex-col flex-1">
            <p className="text-slate-900 dark:text-white text-base font-medium pb-2">New password *</p>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                placeholder="At least 4 characters"
                minLength={4}
                className="form-input w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 h-14 placeholder:text-slate-400 p-[15px] pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </label>

          <label className="flex flex-col flex-1">
            <p className="text-slate-900 dark:text-white text-base font-medium pb-2">Confirm password *</p>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
              placeholder="Re-enter new password"
              minLength={4}
              className="form-input w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 h-14 placeholder:text-slate-400 p-[15px]"
            />
          </label>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
            </div>
          )}

          <Button type="submit" fullWidth disabled={isLoading}>
            {isLoading ? 'Resetting...' : 'Reset password'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            className="text-primary font-semibold hover:text-primary/80"
          >
            Request new OTP
          </button>
        </p>
      </div>
    </div>
  );
};
