import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Fingerprint, KeyRound, X } from 'lucide-react';
import { useBiometricAuth } from '../hooks/useBiometricAuth';
import {
  loadAdminSecurity,
  removeAdminPin,
  setAdminPin,
  setBiometricPreference,
  verifyAdminPassword,
  type AdminSecurityPrefs,
} from '../utils/adminSecurity';
import { isValidPinFormat } from '../utils/pinHash';

type ModalKind = 'set-pin' | 'remove-pin' | 'disable-bio' | null;

function getSessionEmail(): string | null {
  try {
    const raw = localStorage.getItem('ogo_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    return typeof s?.email === 'string' ? s.email : null;
  } catch {
    return null;
  }
}

function Toggle({
  checked,
  disabled,
  busy,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className="toggle-switch group relative inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E16428]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#272121] disabled:opacity-40 disabled:cursor-not-allowed -mr-1"
    >
      {/* Visual track stays compact; outer button is the 44px touch target */}
      <span
        aria-hidden
        className={`relative block h-7 w-12 rounded-full transition-colors duration-200 ${
          checked ? 'bg-[#E16428]' : 'bg-[#F6E9E9]/15 group-hover:bg-[#F6E9E9]/22'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-out will-change-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

export const SecuritySettings: React.FC = () => {
  const [email, setEmail] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<AdminSecurityPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [modal, setModal] = useState<ModalKind>(null);
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');

  const {
    isSupported: bioSupported,
    hasCredentials: hasBio,
    registerBiometric,
    removeBiometric,
  } = useBiometricAuth();
  const [bioBusy, setBioBusy] = useState(false);

  const pinOn = !!prefs?.pinEnabled;
  const bioOn = !!(prefs?.biometricEnabled || hasBio);

  const refresh = useCallback(async (em: string) => {
    setLoading(true);
    try {
      const p = await loadAdminSecurity(em);
      setPrefs(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const em = getSessionEmail();
    setEmail(em);
    if (em) void refresh(em);
    else setLoading(false);
  }, [refresh]);

  const flash = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const closeModal = () => {
    setModal(null);
    setPassword('');
    setPin('');
    setPinConfirm('');
    setModalError('');
    setBusy(false);
  };

  const openModal = (kind: ModalKind) => {
    setPassword('');
    setPin('');
    setPinConfirm('');
    setModalError('');
    setModal(kind);
  };

  const handlePinToggle = (next: boolean) => {
    if (!email || loading || busy) return;
    if (next) {
      openModal('set-pin');
      return;
    }
    if (pinOn) openModal('remove-pin');
  };

  const handleBioToggle = async (next: boolean) => {
    if (!email || !prefs || loading || bioBusy) return;
    if (!bioSupported) {
      flash('error', 'Biometrics not available on this device.');
      return;
    }

    if (next) {
      setBioBusy(true);
      try {
        const adminId = prefs.adminId || email;
        const ok = await registerBiometric(email, String(adminId));
        if (!ok) {
          flash('error', 'Could not enable device unlock.');
          return;
        }
        await setBiometricPreference({
          email,
          enabled: true,
          adminId: prefs.adminId,
        });
        await refresh(email);
        flash('success', 'Device unlock enabled.');
      } finally {
        setBioBusy(false);
      }
      return;
    }

    if (bioOn) openModal('disable-bio');
  };

  const submitSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!isValidPinFormat(pin)) {
      setModalError('PIN must be 4–6 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      setModalError('PINs do not match.');
      return;
    }
    if (!password.trim()) {
      setModalError('Enter your account password.');
      return;
    }
    setBusy(true);
    setModalError('');
    try {
      const res = await setAdminPin({
        email,
        pin,
        currentPassword: password,
      });
      if (!res.ok) {
        setModalError(res.error || 'Failed to set PIN.');
        return;
      }
      closeModal();
      await refresh(email);
      flash('success', pinOn ? 'PIN updated.' : 'PIN enabled.');
    } finally {
      setBusy(false);
    }
  };

  const submitRemovePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!password.trim()) {
      setModalError('Enter your account password.');
      return;
    }
    setBusy(true);
    setModalError('');
    try {
      const res = await removeAdminPin({ email, currentPassword: password });
      if (!res.ok) {
        setModalError(res.error || 'Failed to remove PIN.');
        return;
      }
      closeModal();
      await refresh(email);
      flash('success', 'PIN disabled.');
    } finally {
      setBusy(false);
    }
  };

  const submitDisableBio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!password.trim()) {
      setModalError('Enter your account password.');
      return;
    }
    setBusy(true);
    setModalError('');
    try {
      const auth = await verifyAdminPassword(email, password);
      if (!auth.ok) {
        setModalError(auth.error || 'Incorrect password.');
        return;
      }
      removeBiometric();
      await setBiometricPreference({
        email,
        enabled: false,
        adminId: prefs?.adminId,
      });
      closeModal();
      await refresh(email);
      flash('success', 'Device unlock disabled.');
    } finally {
      setBusy(false);
    }
  };

  const field =
    "underline-field w-full px-0 py-2.5 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] focus:outline-none focus:ring-0 focus:shadow-none transition-[border-color]";

  const modalTitle =
    modal === 'set-pin'
      ? pinOn
        ? 'Update PIN'
        : 'Enable PIN'
      : modal === 'remove-pin'
        ? 'Disable PIN'
        : modal === 'disable-bio'
          ? 'Disable biometrics'
          : '';

  const modalHint =
    modal === 'set-pin'
      ? 'Choose a 4–6 digit PIN and confirm with your account password.'
      : modal === 'remove-pin'
        ? 'Enter your account password to disable login PIN.'
        : modal === 'disable-bio'
          ? 'Enter your account password to turn off device unlock.'
          : '';

  if (!email) {
    return (
      <p className="text-sm text-[#F6E9E9]/50 font-['Inter']">
        Sign in again to manage security settings.
      </p>
    );
  }

  return (
    <section className="w-full min-w-0">
      <div className="mb-5 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-[#F6E9E9] font-['Poppins'] tracking-tight">
          Security
        </h2>
        <p className="text-[11px] sm:text-[12px] text-[#F6E9E9]/45 font-['Inter'] mt-0.5 break-all">
          {email}
          {prefs?.localOnly ? ' · device only until DB migration' : ''}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#F6E9E9]/50 font-['Inter']">Loading…</p>
      ) : (
        <div className="flex flex-col">
          {/* PIN row */}
          <div className="flex items-center gap-3 sm:gap-4 py-3.5 sm:py-4 border-b border-[#E16428]/15 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-[#E16428]/25 bg-[#E16428]/10">
              <KeyRound className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E16428]" />
            </div>
            <div className="min-w-0 flex-1 pr-1">
              <p className="text-sm font-medium text-[#F6E9E9] font-['Poppins'] leading-snug">
                Login PIN
              </p>
              <p className="text-[11px] sm:text-[12px] text-[#F6E9E9]/45 font-['Inter'] leading-snug mt-0.5">
                {pinOn ? '4–6 digit unlock' : 'Off'}
              </p>
              {pinOn && (
                <button
                  type="button"
                  onClick={() => openModal('set-pin')}
                  className="toggle-link mt-1.5 min-h-0 h-auto py-0 px-0 text-left text-[12px] text-[#E16428] hover:text-[#f07a42] font-['Inter'] transition-colors"
                >
                  Change PIN
                </button>
              )}
            </div>
            <Toggle
              checked={pinOn}
              busy={busy}
              label="Login PIN"
              onChange={handlePinToggle}
            />
          </div>

          {/* Biometrics row */}
          <div className="flex items-center gap-3 sm:gap-4 py-3.5 sm:py-4 border-b border-[#E16428]/15 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-[#E16428]/25 bg-[#E16428]/10">
              <Fingerprint className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E16428]" />
            </div>
            <div className="min-w-0 flex-1 pr-1">
              <p className="text-sm font-medium text-[#F6E9E9] font-['Poppins'] leading-snug">
                Biometrics
              </p>
              <p className="text-[11px] sm:text-[12px] text-[#F6E9E9]/45 font-['Inter'] leading-snug mt-0.5">
                {!bioSupported
                  ? 'Not available on this device'
                  : bioOn
                    ? 'Fingerprint / Face ID'
                    : 'Off'}
              </p>
            </div>
            <Toggle
              checked={bioOn}
              disabled={!bioSupported}
              busy={bioBusy}
              label="Biometrics"
              onChange={handleBioToggle}
            />
          </div>
        </div>
      )}

      {msg && (
        <p
          className={`mt-4 text-xs font-['Inter'] ${
            msg.type === 'success' ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {msg.text}
        </p>
      )}

      {modal &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
            onClick={closeModal}
          >
            <div
              className="w-full max-w-sm p-6 animate-scaleIn"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E16428]/30 bg-[#E16428]/12">
                    {modal === 'disable-bio' ? (
                      <Fingerprint className="w-4 h-4 text-[#E16428]" />
                    ) : (
                      <KeyRound className="w-4 h-4 text-[#E16428]" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-[#F6E9E9] font-['Poppins']">
                    {modalTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-1 text-[#F6E9E9]/60 hover:text-[#F6E9E9] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[#F6E9E9]/70 text-sm mb-4 font-['Inter']">{modalHint}</p>

              <form
                onSubmit={
                  modal === 'set-pin'
                    ? submitSetPin
                    : modal === 'remove-pin'
                      ? submitRemovePin
                      : submitDisableBio
                }
                className="space-y-3"
              >
                {modal === 'set-pin' && (
                  <>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={6}
                      value={pin}
                      onChange={e =>
                        setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      className={`${field} tracking-[0.3em] text-center text-base`}
                      placeholder="New PIN"
                      autoFocus
                      required
                    />
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={6}
                      value={pinConfirm}
                      onChange={e =>
                        setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      className={`${field} tracking-[0.3em] text-center text-base`}
                      placeholder="Confirm PIN"
                      required
                    />
                  </>
                )}
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setModalError('');
                  }}
                  className={field}
                  placeholder="Account password"
                  autoFocus={modal !== 'set-pin'}
                  required
                />
                {modalError && (
                  <p className="text-red-400 text-sm font-['Inter'] text-center">
                    {modalError}
                  </p>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 bg-transparent border border-[#E16428]/25 text-[#F6E9E9]/80 rounded-lg hover:border-[#E16428]/45 hover:bg-[#E16428]/8 transition-all duration-200 font-['Inter'] text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-semibold font-['Inter'] transition-colors disabled:opacity-50 ${
                      modal === 'set-pin'
                        ? 'bg-[#E16428] hover:bg-[#d4551f]'
                        : 'bg-red-600/90 hover:bg-red-600'
                    }`}
                  >
                    {busy
                      ? '…'
                      : modal === 'set-pin'
                        ? pinOn
                          ? 'Update'
                          : 'Enable'
                        : 'Disable'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
};
