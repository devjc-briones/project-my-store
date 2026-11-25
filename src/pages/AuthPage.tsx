import { MystoreAnimatedLogo } from '../components/common/MystoreAnimatedLogo';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { AuthMode } from '../router/routes';
import { Roles } from '../types/schema';

interface SignInErrors {
  email?: string;
  password?: string;
  form?: string;
}

interface SignUpErrors {
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

export function AuthPage() {
  const { state, route, navigate, signInUser, signUpUser, resetUserPassword, pushToast } = useStore();
  const initialMode: AuthMode =
    route.name === 'login' && route.mode === 'signup' ? 'signup' : 'signin';

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [forgotPasswordView, setForgotPasswordView] = useState(false);

  // Sign In state
  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [signinErrors, setSigninErrors] = useState<SignInErrors>({});
  const [signinShowPass, setSigninShowPass] = useState(false);

  // Sign Up state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupErrors, setSignupErrors] = useState<SignUpErrors>({});
  const [signupShowPass, setSignupShowPass] = useState(false);
  const [signupShowConfirm, setSignupShowConfirm] = useState(false);

  // Forgot Password OTP state
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

  // Animation & loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shakeTarget, setShakeTarget] = useState<'signin' | 'signup' | 'reset' | null>(null);
  const [formsHeight, setFormsHeight] = useState<number | undefined>(undefined);
  const [cardViewHeight, setCardViewHeight] = useState<number | undefined>(undefined);

  const signinFormRef = useRef<HTMLFormElement | null>(null);
  const signupFormRef = useRef<HTMLFormElement | null>(null);
  const mainViewRef = useRef<HTMLDivElement | null>(null);
  const forgotViewRef = useRef<HTMLDivElement | null>(null);
  const routeMode = route.name === 'login' ? route.mode : undefined;
  const prevRouteModeRef = useRef<AuthMode | undefined>(routeMode);

  const syncHeights = useCallback(() => {
    const activeFormEl = mode === 'signin' ? signinFormRef.current : signupFormRef.current;
    if (activeFormEl) {
      setFormsHeight(activeFormEl.offsetHeight);
    }

    const activeCardEl = forgotPasswordView ? forgotViewRef.current : mainViewRef.current;
    if (activeCardEl) {
      setCardViewHeight(activeCardEl.offsetHeight);
    }
  }, [mode, forgotPasswordView]);

  useLayoutEffect(() => {
    syncHeights();
  }, [
    syncHeights,
    signinErrors,
    signupErrors,
    resetEmailError,
    otpError,
    newPassError,
    otpSent,
    otpVerified,
    resetSent,
  ]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      syncHeights();
    });

    if (signinFormRef.current) observer.observe(signinFormRef.current);
    if (signupFormRef.current) observer.observe(signupFormRef.current);
    if (mainViewRef.current) observer.observe(mainViewRef.current);
    if (forgotViewRef.current) observer.observe(forgotViewRef.current);

    return () => observer.disconnect();
  }, [syncHeights]);

  useEffect(() => {
    window.addEventListener('resize', syncHeights);
    return () => window.removeEventListener('resize', syncHeights);
  }, [syncHeights]);

  useEffect(() => {
    if (routeMode && routeMode !== prevRouteModeRef.current) {
      prevRouteModeRef.current = routeMode;
      setMode(routeMode);
      setForgotPasswordView(false);
      setSigninErrors({});
      setSignupErrors({});
      setResetEmailError(undefined);
      setOtpError(undefined);
      setNewPassError(undefined);
    }
  }, [routeMode]);

  useEffect(() => {
    if (
      route.name === 'login' &&
      state.currentUser &&
      (state.currentUser.role === Roles.Admin || state.currentUser.role === Roles.Seller)
    ) {
      navigate(
        { name: state.currentUser.role === Roles.Admin ? 'admin' : 'dashboard' },
        { replace: true }
      );
    }
  }, [route.name, state.currentUser, navigate]);

  const resetForgotState = () => {
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
  };

  const handleModeSwitch = (nextMode: AuthMode) => {
    if (mode === nextMode && !forgotPasswordView) return;
    setMode(nextMode);
    prevRouteModeRef.current = nextMode;
    setForgotPasswordView(false);
    setSigninErrors({});
    setSignupErrors({});
    resetForgotState();
    if (typeof window !== 'undefined') {
      const nextUrl = nextMode === 'signup' ? '/login?mode=signup' : '/login';
      if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        window.history.replaceState({}, '', nextUrl);
      }
    }
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

  const triggerShake = (target: 'signin' | 'signup' | 'reset') => {
    setShakeTarget(null);
    window.requestAnimationFrame(() => {
      setShakeTarget(target);
      window.setTimeout(() => setShakeTarget(null), 400);
    });
  };

  const handleSignInSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors: SignInErrors = {};
    const trimmedEmail = signinEmail.trim();

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

    setIsSubmitting(true);
    const cleanEmail = trimmedEmail.toLowerCase();

    try {
      const result = await signInUser(cleanEmail, signinPassword);
      setIsSubmitting(false);
      if (!result.success) {
        const message = result.error || 'Incorrect email or password.';
        if (result.isSystemError) {
          setSigninErrors({ form: message });
          pushToast({
            type: 'error',
            title: 'Database Error',
            description: message,
          });
        } else {
          const lower = message.toLowerCase();
          if (lower.includes('password') && !lower.includes('email')) {
            setSigninErrors({ password: message });
          } else if (lower.includes('email') && !lower.includes('password') && !lower.includes('confirmed')) {
            setSigninErrors({ email: message });
          } else {
            setSigninErrors({ form: message });
          }
        }
        triggerShake('signin');
        return;
      }

      if (result.user?.role === Roles.Admin) {
        pushToast({
          type: 'success',
          title: 'Admin signed in',
          description: 'Welcome to the mystore Admin Console.',
        });
        navigate({ name: 'admin' }, { replace: true });
        return;
      }

      if (result.user?.role !== Roles.Seller) {
        setSigninErrors({
          form: 'Customer accounts cannot sign in on the main website. Please sign in through a store page instead.',
        });
        triggerShake('signin');
        return;
      }

      pushToast({
        type: 'success',
        title: 'Signed in successfully',
        description: `Welcome back, ${result.user?.name ?? 'Merchant'}.`,
      });
      navigate({ name: 'dashboard' }, { replace: true });
    } catch (err: any) {
      setIsSubmitting(false);
      const message = err?.message || 'Unable to connect to database.';
      setSigninErrors({ form: message });
      pushToast({ type: 'error', title: 'Database Error', description: message });
      triggerShake('signin');
    }
  };

  const handleSignUpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors: SignUpErrors = {};
    const trimmedName = signupName.trim();
    const trimmedEmail = signupEmail.trim();

    if (!trimmedName || trimmedName.length < 2) {
      nextErrors.fullName = 'Please enter your full name.';
    }
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = 'Please enter a valid email address.';
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

    setIsSubmitting(true);
    const cleanEmail = trimmedEmail.toLowerCase();

    try {
      const result = await signUpUser(trimmedName, cleanEmail, signupPassword);
      setIsSubmitting(false);
      if (!result.success) {
        const message = result.error || 'Unable to create account.';
        if (result.isSystemError) {
          setSignupErrors({ form: message });
          pushToast({
            type: 'error',
            title: 'Database Error',
            description: message,
          });
        } else {
          const lower = message.toLowerCase();
          if (lower.includes('password')) {
            setSignupErrors({ password: message });
          } else if (lower.includes('email') || lower.includes('already exists')) {
            setSignupErrors({ email: message });
          } else {
            setSignupErrors({ form: message });
          }
        }
        triggerShake('signup');
        return;
      }
      if (result.requiresEmailConfirmation) {
        setSigninEmail(cleanEmail);
        handleModeSwitch('signin');
        setSigninErrors({
          form: 'Account created! Please check your email inbox (or spam folder) and click the verification link before signing in.',
        });
        pushToast({
          type: 'info',
          title: 'Verify your email',
          description: 'Account created! Please check your email inbox to confirm before signing in.',
        });
        return;
      }
      pushToast({
        type: 'success',
        title: 'Account created',
        description: `Welcome to mystore, ${trimmedName}.`,
      });
      navigate({ name: 'dashboard' }, { replace: true });
    } catch (err: any) {
      setIsSubmitting(false);
      const message = err?.message || 'Unable to connect to database.';
      setSignupErrors({ form: message });
      pushToast({ type: 'error', title: 'Database Error', description: message });
      triggerShake('signup');
    }
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

  const handleVerifyOtpSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  const handleNewPasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

    const res = await resetUserPassword(resetEmail.trim(), newPassword);
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

  const passwordStrength = getPasswordStrength(signupPassword);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:grid lg:grid-cols-12">
      {/* Left / Main Auth Column */}
      <div
        className="lg:col-span-7 flex flex-col justify-between min-h-screen px-4 sm:px-8 lg:px-12 py-6 lg:border-r border-slate-200"
        style={{
          backgroundColor: '#f8fafc',
          backgroundImage:
            'radial-gradient(at 0% 0%, rgba(15, 23, 42, 0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.08) 0px, transparent 50%)',
        }}
      >
        {/* Top Auth Navigation */}
        <div className="flex items-center justify-between gap-4 max-w-2xl w-full mx-auto">
          <button
            type="button"
            onClick={() => navigate({ name: 'landing' })}
            className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-lg py-1"
            aria-label="mystore home"
          >
            <MystoreAnimatedLogo />
          </button>

          <button
            type="button"
            onClick={() => navigate({ name: 'landing' })}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-white/80 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>

        {/* Animated Mobile-First Auth Card */}
        <div className="w-full max-w-[420px] mx-auto my-6 sm:my-10 bg-white/95 backdrop-blur-xl rounded-[28px] shadow-[0_20px_50px_-12px_rgba(15,23,42,0.10)] border border-slate-200/80 p-6 sm:p-8">
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
              {/* Animated Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20 mb-4">
                  <Lock className="w-5 h-5" />
                </div>
                <div key={mode} className="auth-header-enter">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {mode === 'signin' ? 'Welcome back' : 'Create your account'}
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    {mode === 'signin'
                      ? 'Enter your credentials to access your stores'
                      : 'Launch mystore.com/your-brand in minutes'}
                  </p>
                </div>
              </div>

              {/* Segmented Sliding Pill Toggle */}
              <div
                className="relative grid grid-cols-2 p-1.5 bg-slate-100/90 rounded-2xl mb-6 border border-slate-200/70"
                role="tablist"
                aria-label="Authentication Mode"
              >
                <div
                  aria-hidden="true"
                  className="auth-tab-pill absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm ring-1 ring-slate-900/5"
                  style={{
                    transform: mode === 'signin' ? 'translateX(0%)' : 'translateX(100%)',
                  }}
                />
                <button
                  type="button"
                  role="tab"
                  tabIndex={!forgotPasswordView ? 0 : -1}
                  aria-selected={mode === 'signin'}
                  onClick={() => handleModeSwitch('signin')}
                  className={`relative z-10 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-300 cursor-pointer focus:outline-none ${
                    mode === 'signin' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  tabIndex={!forgotPasswordView ? 0 : -1}
                  aria-selected={mode === 'signup'}
                  onClick={() => handleModeSwitch('signup')}
                  className={`relative z-10 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-300 cursor-pointer focus:outline-none ${
                    mode === 'signup' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Dynamic Height Sliding Forms Viewport */}
              <div
                className="auth-forms-viewport"
                style={{ height: formsHeight ? `${formsHeight}px` : undefined }}
              >
                {/* ==================== SIGN IN FORM ==================== */}
                <form
                  ref={signinFormRef}
                  onSubmit={handleSignInSubmit}
                  noValidate
                  aria-hidden={mode !== 'signin' || forgotPasswordView}
                  className={`auth-form-panel auth-form-signin space-y-4 ${
                    mode === 'signin' ? 'is-active' : 'is-inactive'
                  } ${shakeTarget === 'signin' ? 'auth-shake' : ''}`}
                >
                  {signinErrors.form && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                      {signinErrors.form}
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor="signin-email"
                      className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                    >
                      Email Address
                    </label>
                    <div className="relative group">
                      <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="signin-email"
                        type="email"
                        autoComplete="email"
                        tabIndex={mode === 'signin' && !forgotPasswordView ? 0 : -1}
                        value={signinEmail}
                        onChange={(e) => {
                          setSigninEmail(e.target.value);
                          if (signinErrors.email) {
                            setSigninErrors((prev) => ({ ...prev, email: undefined }));
                          }
                        }}
                        placeholder="merchant@yourbrand.com"
                        className={`w-full pl-10 pr-4 py-3.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
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
                        htmlFor="signin-password"
                        className="block text-xs font-semibold tracking-wide text-slate-600"
                      >
                        Password
                      </label>
                      <button
                        type="button"
                        tabIndex={mode === 'signin' && !forgotPasswordView ? 0 : -1}
                        onClick={openForgotPassword}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline transition-colors py-0.5 cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative group">
                      <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="signin-password"
                        type={signinShowPass ? 'text' : 'password'}
                        autoComplete="current-password"
                        tabIndex={mode === 'signin' && !forgotPasswordView ? 0 : -1}
                        value={signinPassword}
                        onChange={(e) => {
                          setSigninPassword(e.target.value);
                          if (signinErrors.password) {
                            setSigninErrors((prev) => ({ ...prev, password: undefined }));
                          }
                        }}
                        placeholder="••••••••"
                        className={`w-full pl-10 pr-12 py-3.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
                          signinErrors.password
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                            : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                        }`}
                      />
                      <button
                        type="button"
                        tabIndex={mode === 'signin' && !forgotPasswordView ? 0 : -1}
                        aria-label={signinShowPass ? 'Hide password' : 'Show password'}
                        onClick={() => setSigninShowPass((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {signinShowPass ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
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
                    disabled={isSubmitting}
                    tabIndex={mode === 'signin' && !forgotPasswordView ? 0 : -1}
                    className="w-full min-h-[48px] py-3.5 px-4 mt-2 bg-slate-900 hover:bg-slate-800 active:scale-[0.985] disabled:opacity-75 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-slate-900/15 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-slate-500 pt-1">
                    Don&apos;t have an account?
                    <button
                      type="button"
                      tabIndex={mode === 'signin' && !forgotPasswordView ? 0 : -1}
                      onClick={() => handleModeSwitch('signup')}
                      className="font-semibold text-slate-900 hover:underline ml-1 cursor-pointer"
                    >
                      Create one now
                    </button>
                  </p>
                </form>

                {/* ==================== SIGN UP FORM ==================== */}
                <form
                  ref={signupFormRef}
                  onSubmit={handleSignUpSubmit}
                  noValidate
                  aria-hidden={mode !== 'signup' || forgotPasswordView}
                  className={`auth-form-panel auth-form-signup space-y-3.5 ${
                    mode === 'signup' ? 'is-active' : 'is-inactive'
                  } ${shakeTarget === 'signup' ? 'auth-shake' : ''}`}
                >
                  {signupErrors.form && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                      {signupErrors.form}
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor="signup-name"
                      className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                    >
                      Full Name
                    </label>
                    <div className="relative group">
                      <UserIcon className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="signup-name"
                        type="text"
                        autoComplete="name"
                        tabIndex={mode === 'signup' && !forgotPasswordView ? 0 : -1}
                        value={signupName}
                        onChange={(e) => {
                          setSignupName(e.target.value);
                          if (signupErrors.fullName) {
                            setSignupErrors((prev) => ({ ...prev, fullName: undefined }));
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
                      htmlFor="signup-email"
                      className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                    >
                      Email Address
                    </label>
                    <div className="relative group">
                      <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="signup-email"
                        type="email"
                        autoComplete="email"
                        tabIndex={mode === 'signup' && !forgotPasswordView ? 0 : -1}
                        value={signupEmail}
                        onChange={(e) => {
                          setSignupEmail(e.target.value);
                          if (signupErrors.email) {
                            setSignupErrors((prev) => ({ ...prev, email: undefined }));
                          }
                        }}
                        placeholder="merchant@yourbrand.com"
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
                      htmlFor="signup-password"
                      className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                    >
                      Password
                    </label>
                    <div className="relative group">
                      <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="signup-password"
                        type={signupShowPass ? 'text' : 'password'}
                        autoComplete="new-password"
                        tabIndex={mode === 'signup' && !forgotPasswordView ? 0 : -1}
                        value={signupPassword}
                        onChange={(e) => {
                          setSignupPassword(e.target.value);
                          if (signupErrors.password) {
                            setSignupErrors((prev) => ({ ...prev, password: undefined }));
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
                        tabIndex={mode === 'signup' && !forgotPasswordView ? 0 : -1}
                        aria-label={signupShowPass ? 'Hide password' : 'Show password'}
                        onClick={() => setSignupShowPass((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {signupShowPass ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
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
                          Use 8+ chars with letters & numbers
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
                      htmlFor="signup-confirm"
                      className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                    >
                      Confirm Password
                    </label>
                    <div className="relative group">
                      <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="signup-confirm"
                        type={signupShowConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        tabIndex={mode === 'signup' && !forgotPasswordView ? 0 : -1}
                        value={signupConfirm}
                        onChange={(e) => {
                          setSignupConfirm(e.target.value);
                          if (signupErrors.confirmPassword) {
                            setSignupErrors((prev) => ({ ...prev, confirmPassword: undefined }));
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
                        tabIndex={mode === 'signup' && !forgotPasswordView ? 0 : -1}
                        aria-label={
                          signupShowConfirm ? 'Hide confirm password' : 'Show confirm password'
                        }
                        onClick={() => setSignupShowConfirm((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {signupShowConfirm ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
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
                    disabled={isSubmitting}
                    tabIndex={mode === 'signup' && !forgotPasswordView ? 0 : -1}
                    className="w-full min-h-[48px] py-3.5 px-4 mt-1 bg-slate-900 hover:bg-slate-800 active:scale-[0.985] disabled:opacity-75 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-slate-900/15 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Create Free Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-slate-500 pt-1">
                    Already have an account?
                    <button
                      type="button"
                      tabIndex={mode === 'signup' && !forgotPasswordView ? 0 : -1}
                      onClick={() => handleModeSwitch('signin')}
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
              <div className="mb-5">
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
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20 mb-4">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div
                    key={resetSent ? 'sent' : otpVerified ? 'newpass' : otpSent ? 'verify' : 'request'}
                    className="auth-header-enter"
                  >
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                      {resetSent
                        ? 'Password updated'
                        : otpVerified
                          ? 'Set new password'
                          : 'Reset your password'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      {resetSent
                        ? 'Your merchant account password has been reset.'
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
                      htmlFor="reset-new-password"
                      className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                    >
                      New Password
                    </label>
                    <div className="relative group">
                      <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-new-password"
                        type={showNewPass ? 'text' : 'password'}
                        autoComplete="new-password"
                        tabIndex={forgotPasswordView ? 0 : -1}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (newPassError) setNewPassError(undefined);
                        }}
                        placeholder="Min. 6 characters"
                        className={`w-full pl-10 pr-12 py-3.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
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
                      htmlFor="reset-confirm-password"
                      className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                    >
                      Confirm New Password
                    </label>
                    <div className="relative group">
                      <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-confirm-password"
                        type={showNewPass ? 'text' : 'password'}
                        autoComplete="new-password"
                        tabIndex={forgotPasswordView ? 0 : -1}
                        value={confirmNewPassword}
                        onChange={(e) => {
                          setConfirmNewPassword(e.target.value);
                          if (newPassError) setNewPassError(undefined);
                        }}
                        placeholder="Re-enter your new password"
                        className={`w-full pl-10 pr-4 py-3.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
                          newPassError
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                            : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                        }`}
                      />
                    </div>
                    {newPassError && (
                      <p className="text-xs text-rose-600 font-medium mt-1.5 ml-1">
                        {newPassError}
                      </p>
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
                      htmlFor="reset-otp"
                      className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                    >
                      6-Digit OTP
                    </label>
                    <div className="relative group">
                      <KeyRound className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-otp"
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
                        className={`w-full pl-10 pr-14 py-3.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm font-mono tracking-[0.25em] text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
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
                      htmlFor="reset-email"
                      className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5 ml-0.5"
                    >
                      Email Address
                    </label>
                    <div className="relative group">
                      <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        tabIndex={forgotPasswordView ? 0 : -1}
                        value={resetEmail}
                        onChange={(e) => {
                          setResetEmail(e.target.value);
                          if (resetEmailError) setResetEmailError(undefined);
                        }}
                        placeholder="merchant@yourbrand.com"
                        className={`w-full pl-10 pr-4 py-3.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder-slate-400 rounded-2xl border focus:ring-4 outline-none transition-all ${
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
        </div>

        {/* Footer Strip */}
        <div className="text-xs text-slate-500 flex items-center justify-between gap-4 max-w-2xl w-full mx-auto pt-4">
          <span>© 2026 mystore</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            Powered by MyStore
          </span>
        </div>
      </div>

      {/* Right Brand Preview Panel (Desktop) */}
      <aside className="hidden lg:flex lg:col-span-5 bg-slate-900 text-white p-12 flex-col justify-between">
        <div className="space-y-4">
          <p className="text-xs font-medium text-slate-400">Multi-Tenant Merchant Platform</p>
          <h2 className="text-3xl font-bold tracking-tight leading-snug [text-wrap:balance]">
            One dashboard for every brand you run.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed max-w-md">
            Switch seamlessly between multiple stores, update themes and banners, manage discounted
            SKUs, and share instant subpath links.
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
              <Globe className="w-4 h-4 text-slate-400" />
              <span>mystore.com/brew-cafe</span>
            </div>
            <span className="text-xs font-medium text-emerald-400">Live Storefront</span>
          </div>

          <ul className="space-y-3 text-sm text-slate-200">
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>5 fixed industry templates tailored for conversion</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Automatic discount pricing & product variant inventory</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Ready for COD, GCash, Maya, Bank Transfer, and Card</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
