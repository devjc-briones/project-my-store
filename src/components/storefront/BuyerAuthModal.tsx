import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { BuyerAccount, Roles } from '../../types/schema';

interface BuyerAuthModalProps {
  isOpen: boolean;
  initialMode?: 'signin' | 'signup';
  onClose: () => void;
  onSuccess: (buyer?: BuyerAccount) => void;
  storeId?: string;
  storeName?: string;
}

interface BuyerSignInErrors {
  email?: string;
  password?: string;
  form?: string;
}

interface BuyerSignUpErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPasswordStrength(val: string) {
  let score = 0;
  if (val.length >= 6) score += 1;
  if (val.length >= 8) score += 1;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score += 1;
  if (/[^A-Za-z0-9]/.test(val)) score += 1;

  const colors = ['bg-rose-500', 'bg-amber-500', 'bg-sky-500', 'bg-emerald-500'];
  const textColors = ['text-rose-600', 'text-amber-600', 'text-sky-600', 'text-emerald-600'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const level = Math.max(0, score - 1);

  return {
    score,
    barColor: val.length > 0 ? colors[level] : 'bg-slate-200',
    label: val.length > 0 ? labels[level] : '',
    textColor: val.length > 0 ? textColors[level] : 'text-slate-400',
  };
}

export function BuyerAuthModal({
  isOpen,
  initialMode = 'signin',
  onClose,
  onSuccess,
  storeId,
  storeName,
}: BuyerAuthModalProps) {
  useBodyScrollLock(isOpen);
  const { state, buyerSignIn, buyerSignUp, buyerResetPassword, pushToast } = useStore();

  const [tab, setTab] = useState<'signin' | 'signup'>(initialMode);
  const [forgotPasswordView, setForgotPasswordView] = useState(false);

  // Sign In state (exact match to AuthPage.tsx)
  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [signinShowPass, setSigninShowPass] = useState(false);
  const [signinErrors, setSigninErrors] = useState<BuyerSignInErrors>({});

  // Sign Up state (exact match to AuthPage.tsx)
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupShowPass, setSignupShowPass] = useState(false);
  const [signupShowConfirm, setSignupShowConfirm] = useState(false);
  const [signupErrors, setSignupErrors] = useState<BuyerSignUpErrors>({});

  // Forgot Password OTP state (matches AuthPage.tsx)
  const [resetEmail, setResetEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [resetEmailError, setResetEmailError] = useState<string | undefined>();
  const [otpError, setOtpError] = useState<string | undefined>();
  const [newPassError, setNewPassError] = useState<string | undefined>();
  const [resetSent, setResetSent] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Animation & submit state (mirrors AuthPage.tsx)
  const [loading, setLoading] = useState(false);
  const [shakeTarget, setShakeTarget] = useState<'signin' | 'signup' | 'reset' | null>(null);
  const [formsHeight, setFormsHeight] = useState<number | undefined>(undefined);
  const [cardViewHeight, setCardViewHeight] = useState<number | undefined>(undefined);

  const signinFormRef = useRef<HTMLFormElement | null>(null);
  const signupFormRef = useRef<HTMLFormElement | null>(null);
  const mainViewRef = useRef<HTMLDivElement | null>(null);
  const forgotViewRef = useRef<HTMLDivElement | null>(null);

  const syncHeights = useCallback(() => {
    const activeEl = tab === 'signin' ? signinFormRef.current : signupFormRef.current;
    if (activeEl) {
      setFormsHeight(activeEl.offsetHeight);
    }

    const activeCardEl = forgotPasswordView ? forgotViewRef.current : mainViewRef.current;
    if (activeCardEl) {
      setCardViewHeight(activeCardEl.offsetHeight);
    }
  }, [tab, forgotPasswordView]);

  const resetForgotState = useCallback(() => {
    setOtpInput('');
    setGeneratedOtp(null);
    setOtpSent(false);
    setOtpVerified(false);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPass(false);
    setResetEmailError(undefined);
    setOtpError(undefined);
    setNewPassError(undefined);
    setResetSent(false);
    setIsResetting(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialMode);
    setForgotPasswordView(false);
    setSigninErrors({});
    setSignupErrors({});
    resetForgotState();
    setShakeTarget(null);
  }, [isOpen, initialMode, resetForgotState]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    syncHeights();
  }, [
    isOpen,
    syncHeights,
    signinErrors,
    signupErrors,
    resetEmailError,
    otpError,
    newPassError,
    otpSent,
    otpVerified,
    resetSent,
    forgotPasswordView,
  ]);

  useEffect(() => {
    if (!isOpen || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      syncHeights();
    });

    if (signinFormRef.current) observer.observe(signinFormRef.current);
    if (signupFormRef.current) observer.observe(signupFormRef.current);
    if (mainViewRef.current) observer.observe(mainViewRef.current);
    if (forgotViewRef.current) observer.observe(forgotViewRef.current);

    return () => observer.disconnect();
  }, [isOpen, syncHeights]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('resize', syncHeights);
    return () => window.removeEventListener('resize', syncHeights);
  }, [isOpen, syncHeights]);

  if (!isOpen) return null;

  const triggerShake = (target: 'signin' | 'signup' | 'reset') => {
    setShakeTarget(null);
    window.requestAnimationFrame(() => {
      setShakeTarget(target);
      window.setTimeout(() => setShakeTarget(null), 400);
    });
  };

  const handleTabSwitch = (nextTab: 'signin' | 'signup') => {
    if (tab === nextTab && !forgotPasswordView) return;
    setTab(nextTab);
    setForgotPasswordView(false);
    setSigninErrors({});
    setSignupErrors({});
    resetForgotState();
    setShakeTarget(null);
  };

  const openForgotPassword = () => {
    setResetEmail(signinEmail);
    resetForgotState();
    setForgotPasswordView(true);
  };

  const closeForgotPassword = () => {
    setForgotPasswordView(false);
    resetForgotState();
  };

  const handleRequestOtp = () => {
    if (isResetting) return;

    const trimmed = resetEmail.trim();
    if (!trimmed) {
      setResetEmailError('Email address is required.');
      triggerShake('reset');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setResetEmailError('Please enter a valid email address.');
      triggerShake('reset');
      return;
    }

    setResetEmailError(undefined);
    setOtpError(undefined);
    setIsResetting(true);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    window.setTimeout(() => {
      setGeneratedOtp(code);
      setOtpSent(true);
      setIsResetting(false);
      pushToast({
        type: 'info',
        title: `OTP sent to ${trimmed}`,
        description: `Your 6-digit verification code is ${code}.`,
      });
    }, 450);
  };

  const handleVerifyOtpSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isResetting) return;

    if (!otpSent) {
      setOtpError('Please tap "Request OTP" first to receive a code.');
      triggerShake('reset');
      return;
    }

    const trimmedEmail = resetEmail.trim();
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setResetEmailError('Please enter a valid email address.');
      triggerShake('reset');
      return;
    }

    const cleanOtp = otpInput.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setOtpError('Please enter the 6-digit OTP sent to your email.');
      triggerShake('reset');
      return;
    }
    if (!generatedOtp || cleanOtp !== generatedOtp) {
      setOtpError('Invalid OTP code. Please check your email or request again.');
      triggerShake('reset');
      return;
    }

    setOtpError(undefined);
    setResetEmailError(undefined);
    setOtpVerified(true);
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isResetting) return;

    if (!newPassword || newPassword.length < 6) {
      setNewPassError('New password must be at least 6 characters.');
      triggerShake('reset');
      return;
    }
    if (confirmNewPassword !== newPassword) {
      setNewPassError('Passwords do not match.');
      triggerShake('reset');
      return;
    }

    setNewPassError(undefined);
    setIsResetting(true);

    const res = await buyerResetPassword(resetEmail.trim(), newPassword);
    setIsResetting(false);
    if (!res.success) {
      const msg = res.error || 'Failed to update password. Please try again.';
      setNewPassError(msg);
      if (res.isSystemError) {
        pushToast({ type: 'error', title: 'Database Error', description: msg });
      }
      triggerShake('reset');
      return;
    }
    setResetSent(true);
    pushToast({
      type: 'success',
      title: 'Password updated',
      description: `You can now sign in to ${resetEmail.trim()} with your new password.`,
    });
  };

  const handleSignInSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    const trimmedEmail = signinEmail.trim();
    const nextErrors: BuyerSignInErrors = {};

    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = 'Please enter a valid email address.';
    }
    if (!signinPassword || signinPassword.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }

    setSigninErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      triggerShake('signin');
      return;
    }

    setLoading(true);
    try {
      const res = await buyerSignIn(trimmedEmail.toLowerCase(), signinPassword);
      setLoading(false);

      if (res.error || !res.success) {
        const msg = res.error || 'Incorrect email or password.';
        setSigninErrors({ form: msg });
        if (res.isSystemError) {
          pushToast({ type: 'error', title: 'Database Error', description: msg });
        }
        triggerShake('signin');
      } else {
        pushToast({
          type: 'success',
          title: 'Signed in successfully',
          description: `Welcome back, ${res.buyer?.name ?? 'shopper'}.`,
        });
        onSuccess(res.buyer);
        onClose();
      }
    } catch (err: any) {
      setLoading(false);
      const msg = err?.message || 'Unable to connect to database.';
      setSigninErrors({ form: msg });
      pushToast({ type: 'error', title: 'Database Error', description: msg });
      triggerShake('signin');
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    const trimmedName = signupName.trim();
    const trimmedEmail = signupEmail.trim();
    const nextErrors: BuyerSignUpErrors = {};

    if (!trimmedName || trimmedName.length < 2) {
      nextErrors.fullName = 'Please enter your full name.';
    }
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = 'Please enter a valid email address.';
    } else if (
      (state.users ?? []).some(
        (u) =>
          (u.role === Roles.Admin || u.role === Roles.Seller) &&
          u.email.toLowerCase() === trimmedEmail.toLowerCase()
      )
    ) {
      nextErrors.email = 'Merchant and admin accounts cannot register here. Please use a customer email.';
    }
    if (!signupPassword || signupPassword.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }
    if (!signupConfirm) {
      nextErrors.confirmPassword = 'Please confirm your password.';
    } else if (signupConfirm !== signupPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setSignupErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      triggerShake('signup');
      return;
    }

    setLoading(true);
    try {
      const res = await buyerSignUp({
        name: trimmedName,
        email: trimmedEmail.toLowerCase(),
        password: signupPassword,
        storeId,
        storeName,
      });
      setLoading(false);

      if (res.error || !res.success) {
        const msg = res.error || 'Unable to create account.';
        setSignupErrors({ form: msg });
        if (res.isSystemError) {
          pushToast({ type: 'error', title: 'Database Error', description: msg });
        }
        triggerShake('signup');
      } else if (res.requiresEmailConfirmation) {
        setSigninEmail(trimmedEmail.toLowerCase());
        handleTabSwitch('signin');
        setSigninErrors({
          form: 'Account created! Please check your email inbox (or spam folder) and click the verification link before signing in.',
        });
        pushToast({
          type: 'info',
          title: 'Verify your email',
          description: 'Account created! Please check your email inbox to confirm before signing in.',
        });
      } else {
        pushToast({
          type: 'success',
          title: 'Account created',
          description: `Welcome to mystore, ${trimmedName}.`,
        });
        onSuccess(res.buyer);
        onClose();
      }
    } catch (err: any) {
      setLoading(false);
      const msg = err?.message || 'Unable to connect to database.';
      setSignupErrors({ form: msg });
      pushToast({ type: 'error', title: 'Database Error', description: msg });
      triggerShake('signup');
    }
  };

  const passwordStrength = getPasswordStrength(signupPassword);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign In or Create Account"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain bg-white/95 backdrop-blur-xl rounded-[28px] shadow-[0_20px_50px_-12px_rgba(15,23,42,0.22)] border border-slate-200/80 p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-5 top-5 z-20 p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div
          className="auth-card-viewport"
          style={{ height: cardViewHeight ? `${cardViewHeight}px` : undefined }}
        >
          {/* ==================== VIEW 1: MAIN SIGN IN / SIGN UP ==================== */}
          <div
            ref={mainViewRef}
            aria-hidden={forgotPasswordView}
            className={`auth-view-panel auth-view-main ${
              !forgotPasswordView ? 'is-active' : 'is-inactive'
            }`}
          >
            {/* Animated Header matching AuthPage */}
            <div className="text-center pt-1 mb-5">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20 mb-3">
                <Lock className="w-5 h-5" />
              </div>
              <div key={tab} className="auth-header-enter">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  {tab === 'signin' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {tab === 'signin'
                    ? 'Enter your credentials to checkout & track orders'
                    : `Create your account${storeName ? ` for ${storeName}` : ''}`}
                </p>
              </div>
            </div>

            {/* Segmented Sliding Pill Toggle (exact match to AuthPage.tsx) */}
            <div
              className="relative grid grid-cols-2 p-1.5 bg-slate-100/90 rounded-2xl mb-5 border border-slate-200/70"
              role="tablist"
              aria-label="Authentication Mode"
            >
              <div
                aria-hidden="true"
                className="auth-tab-pill absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm ring-1 ring-slate-900/5"
                style={{
                  transform: tab === 'signin' ? 'translateX(0%)' : 'translateX(100%)',
                }}
              />
              <button
                type="button"
                role="tab"
                tabIndex={!forgotPasswordView ? 0 : -1}
                aria-selected={tab === 'signin'}
                onClick={() => handleTabSwitch('signin')}
                className={`relative z-10 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-colors duration-300 cursor-pointer focus:outline-none ${
                  tab === 'signin' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                tabIndex={!forgotPasswordView ? 0 : -1}
                aria-selected={tab === 'signup'}
                onClick={() => handleTabSwitch('signup')}
                className={`relative z-10 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-colors duration-300 cursor-pointer focus:outline-none ${
                  tab === 'signup' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Dynamic Height Sliding Forms Viewport (exact match to AuthPage.tsx) */}
            <div
              className="auth-forms-viewport"
              style={{ height: formsHeight ? `${formsHeight}px` : undefined }}
            >
              {/* ==================== BUYER SIGN IN FORM ==================== */}
              <form
                ref={signinFormRef}
                onSubmit={handleSignInSubmit}
                noValidate
                aria-hidden={tab !== 'signin' || forgotPasswordView}
                className={`auth-form-panel auth-form-signin space-y-4 ${
                  tab === 'signin' ? 'is-active' : 'is-inactive'
                } ${shakeTarget === 'signin' ? 'auth-shake' : ''}`}
              >
                {signinErrors.form && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                    {signinErrors.form}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="buyer-signin-email"
                    className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                  >
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="buyer-signin-email"
                      type="email"
                      autoComplete="email"
                      tabIndex={tab === 'signin' && !forgotPasswordView ? 0 : -1}
                      value={signinEmail}
                      onChange={(e) => {
                        setSigninEmail(e.target.value);
                        if (signinErrors.email || signinErrors.form) {
                          setSigninErrors((prev) => ({ ...prev, email: undefined, form: undefined }));
                        }
                      }}
                      placeholder="you@email.com"
                      className={`w-full pl-10 pr-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
                        signinErrors.email
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                  </div>
                  {signinErrors.email && (
                    <p className="text-xs text-rose-600 font-medium mt-1.5 ml-1">
                      {signinErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 ml-0.5">
                    <label
                      htmlFor="buyer-signin-password"
                      className="block text-xs font-semibold tracking-wide text-slate-600"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      tabIndex={tab === 'signin' && !forgotPasswordView ? 0 : -1}
                      onClick={openForgotPassword}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline transition-colors py-0.5 cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="buyer-signin-password"
                      type={signinShowPass ? 'text' : 'password'}
                      autoComplete="current-password"
                      tabIndex={tab === 'signin' && !forgotPasswordView ? 0 : -1}
                      value={signinPassword}
                      onChange={(e) => {
                        setSigninPassword(e.target.value);
                        if (signinErrors.password || signinErrors.form) {
                          setSigninErrors((prev) => ({
                            ...prev,
                            password: undefined,
                            form: undefined,
                          }));
                        }
                      }}
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-12 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
                        signinErrors.password
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                    <button
                      type="button"
                      tabIndex={tab === 'signin' && !forgotPasswordView ? 0 : -1}
                      aria-label={signinShowPass ? 'Hide password' : 'Show password'}
                      onClick={() => setSigninShowPass((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {signinShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {signinErrors.password && (
                    <p className="text-xs text-rose-600 font-medium mt-1.5 ml-1">
                      {signinErrors.password}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  tabIndex={tab === 'signin' && !forgotPasswordView ? 0 : -1}
                  className="w-full min-h-[48px] py-3.5 px-4 mt-1 bg-slate-900 hover:bg-slate-800 active:scale-[0.985] disabled:opacity-75 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-slate-900/15 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-slate-500 pt-0.5">
                  Don&apos;t have an account?
                  <button
                    type="button"
                    tabIndex={tab === 'signin' && !forgotPasswordView ? 0 : -1}
                    onClick={() => handleTabSwitch('signup')}
                    className="font-semibold text-slate-900 hover:underline ml-1 cursor-pointer"
                  >
                    Create one now
                  </button>
                </p>
              </form>

          {/* ==================== BUYER SIGN UP FORM ==================== */}
          <form
            ref={signupFormRef}
            onSubmit={handleSignUpSubmit}
            noValidate
            aria-hidden={tab !== 'signup' || forgotPasswordView}
            className={`auth-form-panel auth-form-signup space-y-3.5 ${
              tab === 'signup' ? 'is-active' : 'is-inactive'
            } ${shakeTarget === 'signup' ? 'auth-shake' : ''}`}
          >
            {signupErrors.form && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {signupErrors.form}
              </div>
            )}

            <div>
              <label
                htmlFor="buyer-signup-name"
                className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
              >
                Full Name
              </label>
              <div className="relative group">
                <UserIcon className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="buyer-signup-name"
                  type="text"
                  autoComplete="name"
                  tabIndex={tab === 'signup' && !forgotPasswordView ? 0 : -1}
                  value={signupName}
                  onChange={(e) => {
                    setSignupName(e.target.value);
                    if (signupErrors.fullName || signupErrors.form) {
                      setSignupErrors((prev) => ({ ...prev, fullName: undefined, form: undefined }));
                    }
                  }}
                  placeholder="Juan Dela Cruz"
                  className={`w-full pl-10 pr-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
                    signupErrors.fullName
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                      : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                  }`}
                />
              </div>
              {signupErrors.fullName && (
                <p className="text-xs text-rose-600 font-medium mt-1 ml-1">
                  {signupErrors.fullName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="buyer-signup-email"
                className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
              >
                Email Address
              </label>
              <div className="relative group">
                <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="buyer-signup-email"
                  type="email"
                  autoComplete="email"
                  tabIndex={tab === 'signup' && !forgotPasswordView ? 0 : -1}
                  value={signupEmail}
                  onChange={(e) => {
                    setSignupEmail(e.target.value);
                    if (signupErrors.email || signupErrors.form) {
                      setSignupErrors((prev) => ({ ...prev, email: undefined, form: undefined }));
                    }
                  }}
                  placeholder="you@email.com"
                  className={`w-full pl-10 pr-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
                    signupErrors.email
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                      : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                  }`}
                />
              </div>
              {signupErrors.email && (
                <p className="text-xs text-rose-600 font-medium mt-1 ml-1">
                  {signupErrors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="buyer-signup-password"
                className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
              >
                Password
              </label>
              <div className="relative group">
                <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="buyer-signup-password"
                  type={signupShowPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  tabIndex={tab === 'signup' && !forgotPasswordView ? 0 : -1}
                  value={signupPassword}
                  onChange={(e) => {
                    setSignupPassword(e.target.value);
                    if (signupErrors.password || signupErrors.form) {
                      setSignupErrors((prev) => ({ ...prev, password: undefined, form: undefined }));
                    }
                  }}
                  placeholder="Min. 6 characters"
                  className={`w-full pl-10 pr-12 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
                    signupErrors.password
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                      : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                  }`}
                />
                <button
                  type="button"
                  tabIndex={tab === 'signup' && !forgotPasswordView ? 0 : -1}
                  aria-label={signupShowPass ? 'Hide password' : 'Show password'}
                  onClick={() => setSignupShowPass((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {signupShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Live 4-bar Password Strength Meter */}
              <div className="mt-2 px-0.5">
                <div className="grid grid-cols-4 gap-1.5 h-1.5">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`rounded-full transition-colors duration-300 ${
                        signupPassword.length > 0 && idx < passwordStrength.score
                          ? passwordStrength.barColor
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[11px] text-slate-400">
                    Use 8+ chars with letters &amp; numbers
                  </span>
                  {passwordStrength.label && (
                    <span className={`text-[11px] font-semibold ${passwordStrength.textColor}`}>
                      {passwordStrength.label}
                    </span>
                  )}
                </div>
              </div>

              {signupErrors.password && (
                <p className="text-xs text-rose-600 font-medium mt-1 ml-1">
                  {signupErrors.password}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="buyer-signup-confirm"
                className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
              >
                Confirm Password
              </label>
              <div className="relative group">
                <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="buyer-signup-confirm"
                  type={signupShowConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  tabIndex={tab === 'signup' && !forgotPasswordView ? 0 : -1}
                  value={signupConfirm}
                  onChange={(e) => {
                    setSignupConfirm(e.target.value);
                    if (signupErrors.confirmPassword || signupErrors.form) {
                      setSignupErrors((prev) => ({
                        ...prev,
                        confirmPassword: undefined,
                        form: undefined,
                      }));
                    }
                  }}
                  placeholder="Re-enter your password"
                  className={`w-full pl-10 pr-12 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
                    signupErrors.confirmPassword
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                      : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                  }`}
                />
                <button
                  type="button"
                  tabIndex={tab === 'signup' && !forgotPasswordView ? 0 : -1}
                  aria-label={signupShowConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  onClick={() => setSignupShowConfirm((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {signupShowConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {signupErrors.confirmPassword && (
                <p className="text-xs text-rose-600 font-medium mt-1 ml-1">
                  {signupErrors.confirmPassword}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              tabIndex={tab === 'signup' && !forgotPasswordView ? 0 : -1}
              className="w-full min-h-[48px] py-3.5 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.985] disabled:opacity-75 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-slate-900/15 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Create Free Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-500 pt-0.5">
              Already have an account?
              <button
                type="button"
                tabIndex={tab === 'signup' && !forgotPasswordView ? 0 : -1}
                onClick={() => handleTabSwitch('signin')}
                className="font-semibold text-slate-900 hover:underline ml-1 cursor-pointer"
              >
                Sign in instead
              </button>
            </p>
          </form>
            </div>
          </div>

          {/* ==================== VIEW 2: FORGOT PASSWORD ==================== */}
          <div
            ref={forgotViewRef}
            aria-hidden={!forgotPasswordView}
            className={`auth-view-panel auth-view-forgot ${
              forgotPasswordView ? 'is-active' : 'is-inactive'
            }`}
          >
            <div className="mb-5 pt-1">
              <button
                type="button"
                tabIndex={forgotPasswordView ? 0 : -1}
                onClick={closeForgotPassword}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </button>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20 mb-3">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div
                  key={resetSent ? 'sent' : otpVerified ? 'newpass' : otpSent ? 'verify' : 'request'}
                  className="auth-header-enter"
                >
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    {resetSent
                      ? 'Password updated'
                      : otpVerified
                        ? 'Set new password'
                        : 'Reset your password'}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                    {resetSent
                      ? 'Your account password has been reset.'
                      : otpVerified
                        ? `Enter a new password for ${resetEmail}.`
                        : otpSent
                          ? 'Enter the 6-digit OTP sent to your email address.'
                          : 'Request a 6-digit OTP sent to your email address.'}
                  </p>
                </div>
              </div>
            </div>

            {resetSent ? (
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4 auth-header-enter">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    Password reset for {resetEmail}
                  </p>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Your 6-digit OTP was verified and your password has been updated.
                  </p>
                </div>
                <button
                  type="button"
                  tabIndex={forgotPasswordView ? 0 : -1}
                  onClick={() => {
                    setSigninEmail(resetEmail);
                    closeForgotPassword();
                  }}
                  className="w-full min-h-[46px] px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 active:scale-[0.985] rounded-2xl transition-all cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            ) : otpVerified ? (
              <form
                onSubmit={handleNewPasswordSubmit}
                noValidate
                className={`space-y-4 ${shakeTarget === 'reset' ? 'auth-shake' : ''}`}
              >
                <div>
                  <label
                    htmlFor="buyer-reset-new-password"
                    className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                  >
                    New Password
                  </label>
                  <div className="relative group">
                    <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="buyer-reset-new-password"
                      type={showNewPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      tabIndex={forgotPasswordView ? 0 : -1}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (newPassError) setNewPassError(undefined);
                      }}
                      placeholder="Min. 6 characters"
                      className={`w-full pl-10 pr-12 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
                        newPassError
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                    <button
                      type="button"
                      tabIndex={forgotPasswordView ? 0 : -1}
                      aria-label={showNewPass ? 'Hide password' : 'Show password'}
                      onClick={() => setShowNewPass((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="buyer-reset-confirm-password"
                    className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative group">
                    <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="buyer-reset-confirm-password"
                      type={showNewPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      tabIndex={forgotPasswordView ? 0 : -1}
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value);
                        if (newPassError) setNewPassError(undefined);
                      }}
                      placeholder="Re-enter your new password"
                      className={`w-full pl-10 pr-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
                        newPassError
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                  </div>
                  {newPassError && (
                    <p className="text-xs text-rose-600 font-medium mt-1.5 ml-1">{newPassError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isResetting}
                  tabIndex={forgotPasswordView ? 0 : -1}
                  className="w-full min-h-[48px] py-3.5 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.985] disabled:opacity-75 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-slate-900/15 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
                >
                  {isResetting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Reset Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form
                onSubmit={handleVerifyOtpSubmit}
                noValidate
                className={`space-y-4 ${shakeTarget === 'reset' ? 'auth-shake' : ''}`}
              >
                {/* OTP Input placed ABOVE Email Input */}
                <div>
                  <label
                    htmlFor="buyer-reset-otp"
                    className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                  >
                    6-Digit OTP
                  </label>
                  <div className="relative group">
                    <KeyRound className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="buyer-reset-otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoComplete="one-time-code"
                      tabIndex={forgotPasswordView ? 0 : -1}
                      value={otpInput}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtpInput(digitsOnly);
                        if (otpError) setOtpError(undefined);
                      }}
                      placeholder="000000"
                      className={`w-full pl-10 pr-14 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm font-mono tracking-[0.25em] text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
                        otpError
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={isResetting}
                      tabIndex={forgotPasswordView ? 0 : -1}
                      aria-label="Send OTP"
                      title="Send OTP"
                      className="w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 active:scale-95 disabled:opacity-60 text-white flex items-center justify-center shadow-sm transition-all cursor-pointer absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {otpError && (
                    <p className="text-xs text-rose-600 font-medium mt-1.5 ml-1">{otpError}</p>
                  )}
                </div>

                {/* Email Address Input placed BELOW OTP Input */}
                <div>
                  <label
                    htmlFor="buyer-reset-email"
                    className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                  >
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="buyer-reset-email"
                      type="email"
                      autoComplete="email"
                      tabIndex={forgotPasswordView ? 0 : -1}
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        if (resetEmailError) setResetEmailError(undefined);
                      }}
                      placeholder="you@email.com"
                      className={`w-full pl-10 pr-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
                        resetEmailError
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                  </div>
                  {resetEmailError && (
                    <p className="text-xs text-rose-600 font-medium mt-1.5 ml-1">
                      {resetEmailError}
                    </p>
                  )}
                </div>

                {otpSent && generatedOtp && (
                  <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-2">
                    <span className="truncate">
                      OTP sent to <span className="font-semibold">{resetEmail}</span>
                    </span>
                    <span className="font-mono font-bold tracking-wider shrink-0">
                      {generatedOtp}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isResetting}
                  tabIndex={forgotPasswordView ? 0 : -1}
                  onClick={handleRequestOtp}
                  className="w-full min-h-[48px] py-3.5 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.985] disabled:opacity-75 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-slate-900/15 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
                >
                  {isResetting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{otpSent ? 'Request Again' : 'Request OTP'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer Brand Badge */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Powered by MyStore</span>
        </div>
      </div>
    </div>
  );
}
