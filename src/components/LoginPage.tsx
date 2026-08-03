import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Mail, Lock, LogIn, Eye, EyeOff, Fingerprint, KeyRound, Delete } from 'lucide-react';
import { useBiometricAuth } from '../hooks/useBiometricAuth';
import {
  authenticateWithPin,
  getLastLoginEmail,
  getPinLoginAccount,
  loadAdminSecurity,
  setLastLoginEmail,
} from '../utils/adminSecurity';

interface LoginPageProps {
  onLoginSuccess: (email: string) => void;
}

type LoginMode = 'password' | 'pin';

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<LoginMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [error, setError] = useState('');
  const [pinShake, setPinShake] = useState(false);
  const [pinAccount, setPinAccount] = useState<{
    email: string;
    pinLength: number | null;
  } | null>(null);
  const [pinLoginAvailable, setPinLoginAvailable] = useState(false);
  const pinSubmitting = useRef(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const { isSupported, hasCredentials, authenticateBiometric } = useBiometricAuth();
  const [showBiometricOption, setShowBiometricOption] = useState(false);

  // Prefill + detect PIN account (no email needed for PIN mode)
  useEffect(() => {
    const last = getLastLoginEmail();
    if (last) setEmail(last);

    const account = getPinLoginAccount();
    setPinAccount(account);

    let cancelled = false;
    (async () => {
      const prefsEmail = account?.email || last;
      if (!prefsEmail) {
        setPinLoginAvailable(false);
        setMode('password');
        return;
      }
      const prefs = await loadAdminSecurity(prefsEmail);
      if (cancelled) return;
      const pinOk = !!prefs.pinEnabled;
      setPinLoginAvailable(pinOk);
      if (!pinOk) {
        setMode('password');
        setPinAccount(null);
      } else {
        setPinAccount(account || { email: prefsEmail, pinLength: null });
      }
      const wantBio =
        isSupported && hasCredentials && (prefs.biometricEnabled || hasCredentials);
      setShowBiometricOption(wantBio);
      if (pinOk && !wantBio) {
        setMode('pin');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSupported, hasCredentials]);

  useEffect(() => {
    setShowBiometricOption(isSupported && hasCredentials);
  }, [isSupported, hasCredentials]);

  // Focus PIN field when switching to PIN mode
  useEffect(() => {
    if (mode === 'pin') {
      setPin('');
      setError('');
      const t = setTimeout(() => pinInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [mode]);

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    setError('');

    try {
      const authenticatedEmail = await authenticateBiometric();

      if (authenticatedEmail) {
        const { data: admin, error: adminError } = await supabase
          .from('admin')
          .select('*')
          .eq('email', authenticatedEmail)
          .single();

        if (adminError || !admin) {
          throw new Error('Biometric authentication failed. User not found.');
        }

        await supabase.from('log').insert({
          admin_id: admin.id,
          admin_email: authenticatedEmail,
          action: 'login_success_biometric',
        });

        setLastLoginEmail(authenticatedEmail);
        onLoginSuccess(authenticatedEmail);
      } else {
        setError('Biometric authentication cancelled or failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Biometric authentication failed.');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: admin, error: adminError } = await supabase
        .from('admin')
        .select('*')
        .eq('email', email)
        .single();

      if (adminError || !admin) {
        throw new Error('Invalid email or password.');
      }

      if (admin.password !== password) {
        await supabase.from('log').insert({
          admin_id: admin.id,
          admin_email: email,
          action: 'login_fail',
        });
        throw new Error('Invalid email or password.');
      }

      await supabase.from('log').insert({
        admin_id: admin.id,
        admin_email: email,
        action: 'login_success',
      });

      setLastLoginEmail(email);
      onLoginSuccess(email);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerPinFail = useCallback((message = 'PIN incorrect') => {
    setError(message);
    setPin('');
    setPinShake(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([35, 50, 35]);
      }
    } catch {
      /* ignore */
    }
    window.setTimeout(() => setPinShake(false), 480);
    pinInputRef.current?.focus();
  }, []);

  const submitPin = useCallback(
    async (pinValue: string, opts?: { clearOnFail?: boolean }) => {
      const account = pinAccount || getPinLoginAccount();
      if (!account) {
        setError('No PIN set up. Log in with password, then set a PIN in Settings → Security.');
        return;
      }
      if (pinSubmitting.current) return;
      pinSubmitting.current = true;
      setLoading(true);
      setError('');
      try {
        const res = await authenticateWithPin(account.email, pinValue);
        if (!res.ok || !res.email) {
          const clear = opts?.clearOnFail !== false;
          if (clear) {
            triggerPinFail('PIN incorrect');
          }
          return;
        }
        setLastLoginEmail(res.email);
        onLoginSuccess(res.email);
      } catch (err: any) {
        triggerPinFail(err.message || 'PIN incorrect');
      } finally {
        setLoading(false);
        pinSubmitting.current = false;
      }
    },
    [pinAccount, onLoginSuccess, triggerPinFail]
  );

  const requiredPinLen = (() => {
    const acc = pinAccount || getPinLoginAccount();
    const n = acc?.pinLength;
    if (n != null && n >= 4 && n <= 6) return n;
    return 4;
  })();
  const pinDots = requiredPinLen;

  const onPinChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, requiredPinLen);
    setPin(digits);
    setError('');

    const account = pinAccount || getPinLoginAccount();
    if (!account || digits.length < 4) return;

    // Default length is 4; longer only if PIN was set as 5–6 digits
    const required = account.pinLength != null ? account.pinLength : 4;
    if (digits.length === required) {
      void submitPin(digits, { clearOnFail: true });
    }
  };

  const appendPinDigit = (digit: string) => {
    if (loading || pinSubmitting.current || pin.length >= requiredPinLen) return;
    onPinChange(pin + digit);
  };

  const backspacePin = () => {
    if (loading || pinSubmitting.current) return;
    onPinChange(pin.slice(0, -1));
  };

  return (
    <div className="min-h-screen w-full bg-[#1a1818] flex items-center justify-center p-4 relative overflow-hidden">
      <img
        src="/mobilelogin.webp"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center md:hidden pointer-events-none select-none"
        aria-hidden
      />
      <img
        src="/pclogin.webp"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-top hidden md:block pointer-events-none select-none"
        aria-hidden
      />

      <div className="w-full max-w-md z-10">
        <form
          onSubmit={mode === 'pin' && pinLoginAvailable ? e => e.preventDefault() : handlePasswordLogin}
          className="rounded-2xl p-8 space-y-6 animate-fadeIn"
        >
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
              Manager Pro
            </h1>
            <p
              key={`sub-${mode}`}
              className="text-[#F6E9E9]/70 mt-1 login-mode-subtitle"
            >
              {mode === 'pin' && pinLoginAvailable
                ? 'Welcome back, please enter OGO PIN.'
                : 'Welcome back, please log in.'}
            </p>
          </div>

          {pinLoginAvailable && (
            <div className="flex gap-6 border-b border-[#E16428]/20">
              <button
                type="button"
                onClick={() => {
                  setMode('password');
                  setError('');
                }}
                className={`relative flex-1 flex items-center justify-center gap-1.5 pb-2.5 text-xs font-['Inter'] bg-transparent border-0 rounded-none transition-colors duration-300 ${
                  mode === 'password'
                    ? 'text-[#E16428]'
                    : 'text-[#F6E9E9]/50 hover:text-[#E16428]/80'
                }`}
              >
                <Lock
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${
                    mode === 'password' ? 'scale-110' : 'scale-100'
                  }`}
                />
                Password
                <span
                  className={`absolute left-0 right-0 -bottom-px h-0.5 bg-[#E16428] origin-center transition-transform duration-300 ease-out ${
                    mode === 'password' ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('pin');
                  setError('');
                  setPinAccount(getPinLoginAccount());
                }}
                className={`relative flex-1 flex items-center justify-center gap-1.5 pb-2.5 text-xs font-['Inter'] bg-transparent border-0 rounded-none transition-colors duration-300 ${
                  mode === 'pin'
                    ? 'text-[#E16428]'
                    : 'text-[#F6E9E9]/50 hover:text-[#E16428]/80'
                }`}
              >
                <KeyRound
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${
                    mode === 'pin' ? 'scale-110' : 'scale-100'
                  }`}
                />
                PIN
                <span
                  className={`absolute left-0 right-0 -bottom-px h-0.5 bg-[#E16428] origin-center transition-transform duration-300 ease-out ${
                    mode === 'pin' ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          <div
            key={mode}
            className="space-y-6 login-mode-panel"
          >
          {mode === 'pin' && pinLoginAvailable ? (
            <div className="space-y-5">
              {/* PIN dots — mobile dialpad only */}
              <div
                className={`flex md:hidden items-center justify-center gap-3 py-1 ${
                  pinShake ? 'pin-dots-shake' : ''
                }`}
              >
                {Array.from({ length: pinDots }).map((_, i) => (
                  <span
                    key={i}
                    className={`block size-2.5 rounded-full border transition-all duration-200 ${
                      pinShake
                        ? 'border-red-400 bg-red-400/80'
                        : i < pin.length
                          ? 'bg-[#E16428] border-[#E16428] scale-110'
                          : 'bg-transparent border-[#F6E9E9]/35'
                    }`}
                  />
                ))}
              </div>

              {error && mode === 'pin' && (
                <p className="text-center text-sm text-red-400 font-['Inter'] -mt-2 animate-fadeIn">
                  {error}
                </p>
              )}

              {/* Desktop / tablet: text field */}
              <div className={`relative hidden md:block ${pinShake ? 'pin-dots-shake' : ''}`}>
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#E16428]" />
                <input
                  ref={pinInputRef}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={requiredPinLen}
                  placeholder="OGO PIN"
                  value={pin}
                  onChange={e => onPinChange(e.target.value)}
                  disabled={loading}
                  className={`underline-field w-full pl-12 pr-4 py-3 bg-transparent border-0 border-b rounded-none text-[#F6E9E9] placeholder-[#F6E9E9]/50 tracking-[0.4em] text-center text-xl focus:border-[#E16428] ${
                    pinShake ? 'border-red-400' : 'border-[#E16428]/30'
                  }`}
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>

              {/* Mobile: custom dialpad */}
              <div className="md:hidden select-none pin-dialpad">
                <div className="grid grid-cols-3 gap-y-1 gap-x-2 max-w-[280px] mx-auto">
                  {(['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      disabled={loading}
                      onClick={() => appendPinDigit(d)}
                      className="pin-key h-14 flex items-center justify-center text-2xl font-['Poppins'] font-light text-[#F6E9E9] bg-transparent border-0 rounded-none
                        hover:text-[#E16428] active:scale-90 active:text-[#E16428]
                        transition-transform duration-150 disabled:opacity-40
                        focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0
                        appearance-none touch-manipulation"
                    >
                      {d}
                    </button>
                  ))}
                  <span className="h-14" aria-hidden />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => appendPinDigit('0')}
                    className="pin-key h-14 flex items-center justify-center text-2xl font-['Poppins'] font-light text-[#F6E9E9] bg-transparent border-0 rounded-none
                      hover:text-[#E16428] active:scale-90 active:text-[#E16428]
                      transition-transform duration-150 disabled:opacity-40
                      focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0
                      appearance-none touch-manipulation"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={loading || pin.length === 0}
                    onClick={backspacePin}
                    className="pin-key h-14 flex items-center justify-center text-[#F6E9E9]/70 bg-transparent border-0 rounded-none
                      hover:text-[#E16428] active:scale-90
                      transition-transform duration-150 disabled:opacity-30
                      focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0
                      appearance-none touch-manipulation"
                    aria-label="Delete"
                  >
                    <Delete className="w-6 h-6" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#E16428]" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="underline-field w-full pl-12 pr-4 py-3 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] placeholder-[#F6E9E9]/50"
                  required
                  autoComplete="username"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#E16428]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="underline-field w-full pl-12 pr-12 py-3 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] placeholder-[#F6E9E9]/50"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#E16428] hover:text-[#F6E9E9] transition-colors duration-300 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <div className="relative w-5 h-5">
                    <Eye
                      className={`absolute inset-0 w-5 h-5 transition-all duration-300 ease-in-out ${
                        showPassword
                          ? 'opacity-0 rotate-90 scale-0'
                          : 'opacity-100 rotate-0 scale-100'
                      }`}
                    />
                    <EyeOff
                      className={`absolute inset-0 w-5 h-5 transition-all duration-300 ease-in-out ${
                        showPassword
                          ? 'opacity-100 rotate-0 scale-100'
                          : 'opacity-0 -rotate-90 scale-0'
                      }`}
                    />
                  </div>
                </button>
              </div>
            </>
          )}

          {error && !(mode === 'pin' && pinLoginAvailable) && (
            <div className="text-center text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-sm">
              {error}
            </div>
          )}

          {!(mode === 'pin' && pinLoginAvailable) && (
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#E16428] to-[#d35400] text-white font-bold rounded-lg shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#E16428]/50"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Sign In</span>
                  </>
                )}
              </button>

              {showBiometricOption && (
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={biometricLoading || loading}
                  className={`relative h-12 w-12 shrink-0 flex items-center justify-center rounded-none border-0 bg-transparent text-[#E16428] hover:text-[#f07a42] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 focus:outline-none focus-visible:ring-0 ${biometricLoading ? 'fingerprint-scanning' : ''}`}
                  aria-label={biometricLoading ? 'Scanning fingerprint' : 'Use fingerprint login'}
                  title={biometricLoading ? 'Scanning...' : 'Use Fingerprint / Face ID'}
                >
                  <Fingerprint className={`w-8 h-8 ${biometricLoading ? 'fingerprint-icon' : ''}`} strokeWidth={1.75} />
                  {biometricLoading && <div className="fingerprint-scan-line" />}
                </button>
              )}
            </div>
          )}

          {mode === 'pin' && pinLoginAvailable && showBiometricOption && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={biometricLoading || loading}
                className={`relative h-12 w-12 shrink-0 flex items-center justify-center rounded-none border-0 bg-transparent text-[#E16428] hover:text-[#f07a42] disabled:opacity-50 focus:outline-none ${biometricLoading ? 'fingerprint-scanning' : ''}`}
                aria-label="Use fingerprint login"
              >
                <Fingerprint className={`w-8 h-8 ${biometricLoading ? 'fingerprint-icon' : ''}`} strokeWidth={1.75} />
                {biometricLoading && <div className="fingerprint-scan-line" />}
              </button>
            </div>
          )}
          </div>
        </form>
      </div>
    </div>
  );
};
