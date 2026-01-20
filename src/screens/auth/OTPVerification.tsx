import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TopAppBar, Button } from '../../components/shared';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

export const OTPVerification: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const state = location.state as {
    mobile?: string;
    dialCode?: string;
    countryName?: string;
    rawMobile?: string;
    name?: string; // Name from registration
    password?: string; // Password from registration
    isLogin?: boolean; // Flag to indicate if this is login (not registration)
  };
  const mobile = state?.mobile || '';
  const isLogin = state?.isLogin || false;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!mobile) {
      navigate('/register');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mobile, navigate]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newOtp = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
      setOtp(newOtp.slice(0, 6));
      inputRefs.current[Math.min(pastedData.length - 1, 5)]?.focus();
    }
  };

  const handleSubmit = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const deviceId = localStorage.getItem('deviceId') || `web-${Date.now()}`;
      localStorage.setItem('deviceId', deviceId);

      const response = await authService.verifyOTP({
        mobile,
        otpCode,
        deviceId,
        deviceType: 'web',
        password: state?.password, // Include password if provided during registration
        name: state?.name, // Include name if provided during registration
      });

      if (response.success && response.data) {
        login(
          response.data.token,
          response.data.refreshToken,
          response.data.user
        );
        // If login, redirect based on role; if registration, go to profile setup
        if (isLogin || (response.data.user.name && !response.data.user.name.startsWith('User '))) {
          // Redirect based on user role
          if (response.data.user.role === 'admin') {
            navigate('/admin');
          } else if (response.data.user.role === 'super_admin') {
            navigate('/super-admin');
          } else {
            navigate('/dashboard');
          }
        } else {
          navigate('/profile-setup');
        }
      } else {
        setError(response.error || 'Invalid OTP. Please try again.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.requestOTP({ mobile });
      setTimeLeft(180);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden font-display">
      <TopAppBar title="Verify OTP" onBack={() => navigate(-1)} />

      <div className="flex flex-col flex-1 w-full max-w-md mx-auto px-6 py-8">
        <h1 className="text-slate-900 dark:text-white tracking-tight text-[32px] font-bold leading-tight text-center pt-4">
          Enter Verification Code
        </h1>

        <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal py-3 text-center">
          We've sent a 6-digit code to <br />
          <span className="font-semibold text-slate-900 dark:text-white">
            {state?.dialCode || ''} {state?.rawMobile || mobile}
          </span>
        </p>

        {/* OTP Input */}
        <div className="flex gap-3 justify-center my-8">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className="w-14 h-16 text-center text-2xl font-bold rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          ))}
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        {/* Timer */}
        <div className="text-center mb-6">
          {timeLeft > 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Resend code in <span className="font-semibold">{formatTime(timeLeft)}</span>
            </p>
          ) : (
            <button
              onClick={handleResend}
              disabled={isLoading}
              className="text-primary font-semibold text-sm hover:underline"
            >
              Resend OTP
            </button>
          )}
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          fullWidth
          disabled={isLoading || otp.join('').length !== 6}
        >
          {isLoading ? 'Verifying...' : 'Verify'}
        </Button>

        {/* Change Number */}
        <button
          onClick={() => navigate(isLogin ? '/login' : '/register')}
          className="text-primary text-sm font-medium mt-4 text-center hover:underline"
        >
          Change mobile number
        </button>
      </div>
    </div>
  );
};

