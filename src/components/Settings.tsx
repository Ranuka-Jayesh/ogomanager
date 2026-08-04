import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { Edit, Trash2, Plus, Save, X, Lock, Layers, MessageSquareText, Mail, Shield, RotateCcw } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  getLocalProjectTypes,
  saveProjectTypesLocally,
  saveProjectTypeLocally,
  markProjectTypeDeleted,
  addToSyncQueue,
  getSyncQueueCount,
} from '../lib/offlineStore';
import { syncManager } from '../lib/syncManager';
import { ReceiptCaptionSettings } from './ReceiptCaptionSettings';
import { SecuritySettings } from './SecuritySettings';

const TABS = [
  { id: 'project-types', label: 'Categories', icon: Layers },
  { id: 'receipt-caption', label: 'Captions', icon: MessageSquareText },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'admin-account', label: 'Account', icon: Lock },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function updateStoredSessionEmail(oldEmail: string, newEmail: string) {
  try {
    const sessionData = localStorage.getItem('ogo_session');
    if (sessionData) {
      const session = JSON.parse(sessionData);
      if (session?.email === oldEmail || session?.email) {
        session.email = newEmail;
        localStorage.setItem('ogo_session', JSON.stringify(session));
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const bio = localStorage.getItem('biometric_credential');
    if (bio) {
      const cred = JSON.parse(bio);
      if (cred?.email === oldEmail) {
        cred.email = newEmail;
        localStorage.setItem('biometric_credential', JSON.stringify(cred));
      }
    }
  } catch {
    /* ignore */
  }
}

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('project-types');
  const [adminSubTab, setAdminSubTab] = useState<'email' | 'password'>('email');
  const { isOnline } = useNetworkStatus();

  // Project Types State
  const [projectTypes, setProjectTypes] = useState<{ id: string; name: string }[]>([]);
  const [newType, setNewType] = useState('');
  const [editingType, setEditingType] = useState<{ id: string; name: string } | null>(null);
  const [typeInput, setTypeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<{ id: string, name: string } | null>(null);

  // Admin Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordMsgType, setPasswordMsgType] = useState<'error' | 'success'>('error');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Admin Email State
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailMsgType, setEmailMsgType] = useState<'error' | 'success'>('error');
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  const emailDirty = useMemo(
    () => Boolean(newEmail.trim() || confirmEmail.trim() || emailPassword.trim()),
    [newEmail, confirmEmail, emailPassword]
  );

  const passwordDirty = useMemo(
    () => Boolean(currentPassword.trim() || newPassword.trim() || confirmPassword.trim()),
    [currentPassword, newPassword, confirmPassword]
  );

  const clearEmailDraft = () => {
    setNewEmail('');
    setConfirmEmail('');
    setEmailPassword('');
    setEmailMsg('');
  };

  const clearPasswordDraft = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMsg('');
  };

  // Fetch project types
  useEffect(() => {
    if (activeTab === 'project-types') fetchTypes();
    // eslint-disable-next-line
  }, [activeTab]);

  // Load current admin email when opening account tab
  useEffect(() => {
    if (activeTab !== 'admin-account') return;
    try {
      const sessionData = localStorage.getItem('ogo_session');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session?.email) setCurrentEmail(session.email);
      }
    } catch {
      /* ignore */
    }
  }, [activeTab]);

  // Subscribe to sync events to refresh data
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((event) => {
      if (event.type === 'sync-complete' || event.type === 'data-updated') {
        fetchTypes(); // Refresh data after sync
      }
    });
    
    return unsubscribe;
  }, []);

  async function fetchTypes() {
    setLoading(true);
    
    try {
      if (isOnline) {
        // Online: fetch from Supabase and cache locally
        const { data, error } = await supabase.from('project_types').select('*').order('created_at');
        if (!error && data) {
          setProjectTypes(data);
          await saveProjectTypesLocally(data);
        } else {
          // If online fetch fails, use local data
          const localTypes = await getLocalProjectTypes();
          setProjectTypes(localTypes.map(t => ({ id: t.id, name: t.name })));
        }
      } else {
        // Offline: use local data
        const localTypes = await getLocalProjectTypes();
        setProjectTypes(localTypes.map(t => ({ id: t.id, name: t.name })));
      }
    } catch (error) {
      console.error('Error fetching types:', error);
      // Fallback to local data
      const localTypes = await getLocalProjectTypes();
      setProjectTypes(localTypes.map(t => ({ id: t.id, name: t.name })));
    }
    
    setLoading(false);
  }

  async function addType() {
    if (!newType.trim()) return;
    
    const newTypeData = {
      id: crypto.randomUUID(),
      name: newType.trim(),
      created_at: new Date().toISOString(),
    };
    
    try {
      if (isOnline) {
        // Online: insert directly
        const { error } = await supabase.from('project_types').insert({ name: newType.trim() });
        if (!error) {
          setNewType('');
          fetchTypes();
        }
      } else {
        // Offline: save locally and queue for sync
        await saveProjectTypeLocally(newTypeData, true);
        await addToSyncQueue({
          type: 'create',
          table: 'project_types',
          data: newTypeData,
        });
        setNewType('');
        fetchTypes();
      }
    } catch (error) {
      console.error('Error adding type:', error);
    }
  }

  async function updateType() {
    if (!editingType || !typeInput.trim()) return;
    
    const updatedData = {
      id: editingType.id,
      name: typeInput.trim(),
    };
    
    try {
      if (isOnline) {
        // Online: update directly
        const { error } = await supabase
          .from('project_types')
          .update({ name: typeInput.trim() })
          .eq('id', editingType.id);
        if (!error) {
          setEditingType(null);
          setTypeInput('');
          fetchTypes();
        }
      } else {
        // Offline: save locally and queue for sync
        await saveProjectTypeLocally(updatedData, true);
        await addToSyncQueue({
          type: 'update',
          table: 'project_types',
          data: updatedData,
        });
        setEditingType(null);
        setTypeInput('');
        fetchTypes();
      }
    } catch (error) {
      console.error('Error updating type:', error);
    }
  }

  async function handleDeleteType(id: string) {
    try {
      if (isOnline) {
        // Online: delete directly
        await supabase.from('project_types').delete().eq('id', id);
      } else {
        // Offline: mark as deleted and queue for sync
        await markProjectTypeDeleted(id);
        await addToSyncQueue({
          type: 'delete',
          table: 'project_types',
          data: { id },
        });
      }
      setShowDeleteModal(null);
      fetchTypes();
    } catch (error) {
      console.error('Error deleting type:', error);
    }
  }

  // Log action to database
  const logAction = async (adminId: string | null, adminEmail: string, action: string) => {
    try {
      const { error } = await supabase
        .from('log')
        .insert({
          admin_id: adminId,
          admin_email: adminEmail,
          action: action
        });
      
      if (error) {
        console.error('Error logging action:', error);
      }
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  };

  // Password change handler
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordMsg('');
    setPasswordMsgType('error');

    try {
      // Validate inputs
      if (!currentPassword.trim()) {
        setPasswordMsg('Please enter your current password.');
        setIsChangingPassword(false);
        return;
      }

      if (!newPassword.trim()) {
        setPasswordMsg('Please enter a new password.');
        setIsChangingPassword(false);
        return;
      }

      if (newPassword.length < 3) {
        setPasswordMsg('New password must be at least 3 characters long.');
        setIsChangingPassword(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordMsg('New passwords do not match.');
        setIsChangingPassword(false);
        return;
      }

      if (currentPassword === newPassword) {
        setPasswordMsg('New password must be different from the current password.');
        setIsChangingPassword(false);
        return;
      }

      // Verify current password by finding the admin
      const { data: admin, error: adminError } = await supabase
        .from('admin')
        .select('id, email, password')
        .eq('password', currentPassword.trim())
        .single();

      if (adminError || !admin) {
        // Log failed password change attempt
        await logAction(null, 'Unknown', 'password_change_fail');
        setPasswordMsg('Current password is incorrect.');
        setIsChangingPassword(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase
        .from('admin')
        .update({ password: newPassword.trim() })
        .eq('id', admin.id);

      if (updateError) {
        console.error('Error updating password:', updateError);
        await logAction(admin.id, admin.email, 'password_change_error');
        setPasswordMsg('Failed to update password. Please try again.');
        setIsChangingPassword(false);
        return;
      }

      // Log successful password change
      await logAction(admin.id, admin.email, 'password_change_success');

      // Success
      setPasswordMsgType('success');
      setPasswordMsg('Password changed successfully!');
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Clear success message after 5 seconds
      setTimeout(() => {
        setPasswordMsg('');
      }, 5000);
    } catch (error) {
      console.error('Unexpected error during password change:', error);
      setPasswordMsg('An unexpected error occurred. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setIsChangingEmail(true);
    setEmailMsg('');
    setEmailMsgType('error');

    try {
      const nextEmail = newEmail.trim().toLowerCase();
      const confirm = confirmEmail.trim().toLowerCase();

      if (!nextEmail) {
        setEmailMsg('Please enter a new email.');
        setIsChangingEmail(false);
        return;
      }

      if (!EMAIL_RE.test(nextEmail)) {
        setEmailMsg('Please enter a valid email address.');
        setIsChangingEmail(false);
        return;
      }

      if (nextEmail !== confirm) {
        setEmailMsg('Email addresses do not match.');
        setIsChangingEmail(false);
        return;
      }

      if (!emailPassword.trim()) {
        setEmailMsg('Please enter your current password.');
        setIsChangingEmail(false);
        return;
      }

      if (currentEmail && nextEmail === currentEmail.toLowerCase()) {
        setEmailMsg('New email must be different from the current email.');
        setIsChangingEmail(false);
        return;
      }

      // Verify current password + identity
      let adminQuery = supabase
        .from('admin')
        .select('id, email, password')
        .eq('password', emailPassword.trim());

      if (currentEmail) {
        adminQuery = adminQuery.eq('email', currentEmail);
      }

      const { data: admin, error: adminError } = await adminQuery.single();

      if (adminError || !admin) {
        await logAction(null, currentEmail || 'Unknown', 'email_change_fail');
        setEmailMsg('Current password is incorrect.');
        setIsChangingEmail(false);
        return;
      }

      // Ensure email is not already used by another admin
      const { data: existing } = await supabase
        .from('admin')
        .select('id')
        .eq('email', nextEmail)
        .maybeSingle();

      if (existing && existing.id !== admin.id) {
        setEmailMsg('That email is already in use.');
        setIsChangingEmail(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('admin')
        .update({ email: nextEmail })
        .eq('id', admin.id);

      if (updateError) {
        console.error('Error updating email:', updateError);
        await logAction(admin.id, admin.email, 'email_change_error');
        setEmailMsg('Failed to update email. Please try again.');
        setIsChangingEmail(false);
        return;
      }

      updateStoredSessionEmail(admin.email, nextEmail);
      await logAction(admin.id, nextEmail, 'email_change_success');

      setCurrentEmail(nextEmail);
      setNewEmail('');
      setConfirmEmail('');
      setEmailPassword('');
      setEmailMsgType('success');
      setEmailMsg('Email updated successfully!');
      setTimeout(() => setEmailMsg(''), 5000);
    } catch (error) {
      console.error('Unexpected error during email change:', error);
      setEmailMsg('An unexpected error occurred. Please try again.');
    } finally {
      setIsChangingEmail(false);
    }
  }

  // ESC key handler to close delete modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showDeleteModal) {
        setShowDeleteModal(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteModal]);

  return (
    <div className={`${activeTab === 'receipt-caption' ? 'max-w-5xl' : 'max-w-2xl'} mx-auto pt-4 sm:pt-8 pb-24 px-2 sm:px-4 animate-fadeIn`}>
      {/* Tabs — equal columns on mobile, no horizontal scroll overflow */}
      <div
        role="tablist"
        className="grid grid-cols-2 sm:grid-cols-4 w-full border-b border-[#E16428]/30 mb-6 sm:mb-8"
      >
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-w-0 w-full px-1 sm:px-4 py-2.5 sm:py-3 font-medium transition-colors duration-200 border-b-2 -mb-px ${
                isActive
                  ? 'border-[#E16428] text-[#E16428]'
                  : 'border-transparent text-[#F6E9E9]/70 hover:text-[#E16428]'
              }`}
            >
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="text-[10px] leading-tight sm:text-base text-center break-words max-w-full">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-[#272121]/60 rounded-xl shadow-lg p-4 sm:p-6">
        {activeTab === 'project-types' && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-[#F6E9E9] mb-4 font-['Playfair_Display']">
              Project Types
            </h2>
            <div className="flex flex-row items-end gap-2 sm:gap-3 mb-6">
              <input
                value={newType}
                onChange={e => setNewType(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addType();
                  }
                }}
                className="underline-field flex-1 min-w-0 w-full px-0 py-2.5 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] focus:border-[#E16428] focus:outline-none text-sm font-['Inter'] placeholder-[#F6E9E9]/35 transition-[border-color]"
                placeholder="Add new project type"
              />
              <button
                onClick={addType}
                type="button"
                className="inline-flex items-center justify-center gap-1.5 shrink-0 h-10 pb-0.5 sm:pb-2.5 px-1 text-sm text-[#E16428] hover:text-[#F6E9E9] transition-colors font-['Poppins'] font-medium"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {loading ? (
              <div className="text-[#F6E9E9]/50 text-sm font-['Inter'] py-3">Loading...</div>
            ) : projectTypes.length === 0 ? (
              <div className="text-[#F6E9E9]/40 text-sm font-['Inter'] py-3 border-b border-[#E16428]/15">
                No project types yet
              </div>
            ) : (
              <div className="flex flex-col max-h-[min(50vh,22rem)] overflow-y-auto overscroll-contain pr-1">
                {projectTypes.map(type =>
                  editingType && editingType.id === type.id ? (
                    <div
                      key={type.id}
                      className="flex items-center gap-2 py-3 border-b border-[#E16428]/25"
                    >
                      <input
                        value={typeInput}
                        onChange={e => setTypeInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            updateType();
                          } else if (e.key === 'Escape') {
                            setEditingType(null);
                          }
                        }}
                        autoFocus
                        className="underline-field flex-1 min-w-0 px-0 py-1 bg-transparent border-0 border-b border-[#E16428]/40 rounded-none text-[#F6E9E9] text-sm font-['Inter'] focus:border-[#E16428] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={updateType}
                        className="p-1.5 text-emerald-400/80 hover:text-emerald-400 transition-colors"
                        aria-label="Save"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingType(null)}
                        className="p-1.5 text-[#F6E9E9]/40 hover:text-[#E16428] transition-colors"
                        aria-label="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      key={type.id}
                      className="group flex items-center gap-3 py-3 border-b border-[#E16428]/15 hover:border-[#E16428]/35 transition-colors"
                    >
                      <span className="flex-1 min-w-0 text-[#F6E9E9] text-sm font-['Inter'] truncate">
                        {type.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingType(type);
                          setTypeInput(type.name);
                        }}
                        className="p-1.5 text-[#F6E9E9]/35 hover:text-[#E16428] transition-colors opacity-70 group-hover:opacity-100"
                        aria-label={`Edit ${type.name}`}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteModal(type)}
                        className="p-1.5 text-[#F6E9E9]/35 hover:text-red-400 transition-colors opacity-70 group-hover:opacity-100"
                        aria-label={`Delete ${type.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'receipt-caption' && <ReceiptCaptionSettings />}

        {activeTab === 'security' && <SecuritySettings />}

        {activeTab === 'admin-account' && (
          <section className="w-full">
            <div className="flex flex-col-reverse sm:flex-row gap-6 sm:gap-8 items-start">
              {/* Form content */}
              <div className="flex-1 min-w-0 w-full">
                {adminSubTab === 'email' && (
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#F6E9E9] mb-1 font-['Playfair_Display']">
                      Admin Email
                    </h2>
                    {currentEmail && (
                      <p className="text-[#F6E9E9]/50 text-xs mb-4 font-['Inter']">
                        Current: <span className="text-[#F6E9E9]/80">{currentEmail}</span>
                      </p>
                    )}
                    <form id="admin-email-form" onSubmit={handleChangeEmail} className="space-y-3 max-w-md">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        className="underline-field w-full px-0 py-2.5 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] focus:outline-none transition-[border-color]"
                        placeholder="New email"
                        required
                        autoComplete="email"
                      />
                      <input
                        type="email"
                        value={confirmEmail}
                        onChange={e => setConfirmEmail(e.target.value)}
                        className="underline-field w-full px-0 py-2.5 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] focus:outline-none transition-[border-color]"
                        placeholder="Confirm new email"
                        required
                        autoComplete="email"
                      />
                      <input
                        type="password"
                        value={emailPassword}
                        onChange={e => setEmailPassword(e.target.value)}
                        className="underline-field w-full px-0 py-2.5 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] focus:outline-none transition-[border-color]"
                        placeholder="Current password"
                        required
                        autoComplete="current-password"
                      />
                      {emailMsg && (
                        <div
                          className={`p-3 rounded-lg text-sm font-['Inter'] ${
                            emailMsgType === 'success'
                              ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                              : 'bg-red-500/20 border border-red-500/30 text-red-400'
                          }`}
                        >
                          {emailMsg}
                        </div>
                      )}
                    </form>
                  </div>
                )}

                {adminSubTab === 'password' && (
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#F6E9E9] mb-4 font-['Playfair_Display']">
                      Admin Password
                    </h2>
                    <form id="admin-password-form" onSubmit={handleChangePassword} className="space-y-3 max-w-md">
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        className="underline-field w-full px-0 py-2.5 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] focus:outline-none transition-[border-color]"
                        placeholder="Current password"
                        required
                      />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="underline-field w-full px-0 py-2.5 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] focus:outline-none transition-[border-color]"
                        placeholder="New password"
                        required
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="underline-field w-full px-0 py-2.5 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] focus:outline-none transition-[border-color]"
                        placeholder="Confirm new password"
                        required
                      />
                      {passwordMsg && (
                        <div className={`p-3 rounded-lg text-sm font-['Inter'] ${
                          passwordMsgType === 'success'
                            ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                            : 'bg-red-500/20 border border-red-500/30 text-red-400'
                        }`}>
                          {passwordMsg}
                        </div>
                      )}
                    </form>
                  </div>
                )}
              </div>

              {/* Right side panel: Email / Password */}
              <aside className="w-full sm:w-40 shrink-0 sm:sticky sm:top-24">
                <p className="text-[11px] tracking-[0.12em] uppercase text-[#F6E9E9]/35 font-['Inter'] mb-2.5">
                  Account
                </p>
                <div className="flex sm:flex-col gap-1.5 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('email')}
                    className={`flex items-center gap-2 shrink-0 sm:w-full px-1 py-2.5 border-0 border-b-2 rounded-none bg-transparent text-left text-xs font-['Inter'] transition-colors ${
                      adminSubTab === 'email'
                        ? 'border-[#E16428] text-[#E16428]'
                        : 'border-transparent text-[#F6E9E9]/65 hover:text-[#E16428] hover:border-[#E16428]/35'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('password')}
                    className={`flex items-center gap-2 shrink-0 sm:w-full px-1 py-2.5 border-0 border-b-2 rounded-none bg-transparent text-left text-xs font-['Inter'] transition-colors ${
                      adminSubTab === 'password'
                        ? 'border-[#E16428] text-[#E16428]'
                        : 'border-transparent text-[#F6E9E9]/65 hover:text-[#E16428] hover:border-[#E16428]/35'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    Password
                  </button>
                </div>
              </aside>
            </div>
          </section>
        )}
      </div>

      {activeTab === 'admin-account' &&
        adminSubTab === 'email' &&
        emailDirty &&
        createPortal(
          <div className="fixed bottom-5 sm:bottom-7 inset-x-0 z-40 flex justify-center pointer-events-none px-3">
            <div className="pointer-events-auto flex items-center rounded-full bg-[#272121]/95 backdrop-blur-md border border-[#E16428]/25 shadow-xl shadow-black/40 pl-3.5 pr-1.5 py-1 gap-0.5 animate-fadeIn">
              <button
                type="submit"
                form="admin-email-form"
                disabled={isChangingEmail}
                className="px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#F6E9E9]"
              >
                {isChangingEmail ? 'Updating…' : 'Update'}
              </button>
              <span className="w-px h-4 bg-[#F6E9E9]/15 shrink-0" aria-hidden />
              <button
                type="button"
                onClick={clearEmailDraft}
                disabled={isChangingEmail}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5 opacity-70" />
                Reset
              </button>
              <div className="ml-1.5 shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E16428] border-2 border-[#E16428]/80 flex items-center justify-center shadow-md">
                <Mail className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>,
          document.body
        )}

      {activeTab === 'admin-account' &&
        adminSubTab === 'password' &&
        passwordDirty &&
        createPortal(
          <div className="fixed bottom-5 sm:bottom-7 inset-x-0 z-40 flex justify-center pointer-events-none px-3">
            <div className="pointer-events-auto flex items-center rounded-full bg-[#272121]/95 backdrop-blur-md border border-[#E16428]/25 shadow-xl shadow-black/40 pl-3.5 pr-1.5 py-1 gap-0.5 animate-fadeIn">
              <button
                type="submit"
                form="admin-password-form"
                disabled={isChangingPassword}
                className="px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#F6E9E9]"
              >
                {isChangingPassword ? 'Changing…' : 'Update'}
              </button>
              <span className="w-px h-4 bg-[#F6E9E9]/15 shrink-0" aria-hidden />
              <button
                type="button"
                onClick={clearPasswordDraft}
                disabled={isChangingPassword}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5 opacity-70" />
                Reset
              </button>
              <div className="ml-1.5 shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E16428] border-2 border-[#E16428]/80 flex items-center justify-center shadow-md">
                <Lock className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>,
          document.body
        )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn p-4">
          <div className="bg-[#272121] border border-[#E16428]/30 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-xs w-full flex flex-col items-center scale-100 animate-popIn">
            <div className="mb-4">
              <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#E16428" opacity="0.15"/><path d="M15.535 8.465l-7.07 7.07M8.465 8.465l7.07 7.07" stroke="#E16428" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <h3 className="text-lg font-bold text-[#F6E9E9] mb-2 font-['Poppins']">Delete Project Type?</h3>
            <p className="text-[#F6E9E9]/70 text-center mb-6 font-['Inter']">
              Are you sure you want to delete <span className="text-[#E16428] font-bold">{showDeleteModal.name}</span>? This action cannot be undone.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-5 py-2 rounded-lg bg-[#363333]/60 text-[#F6E9E9] hover:bg-[#E16428]/10 transition-all duration-300 font-['Poppins']"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteType(showDeleteModal.id)}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white shadow-lg hover:scale-105 transition-all duration-300 font-['Poppins']"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 
