import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { Edit, Trash2, Plus, Save, Lock, Layers, MessageSquareText, Mail, Shield, RotateCcw, Package } from 'lucide-react';
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
import { ExpenseProductsSettings } from './ExpenseProductsSettings';

const TABS = [
  { id: 'project-types', label: 'Categories', icon: Layers },
  { id: 'products', label: 'Products', icon: Package },
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

  // ESC / Enter for project type delete confirm
  useEffect(() => {
    if (!showDeleteModal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDeleteModal(null);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        void handleDeleteType(showDeleteModal.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteModal]);

  return (
    <div className={`${activeTab === 'receipt-caption' || activeTab === 'products' ? 'max-w-5xl' : 'max-w-2xl'} mx-auto pt-4 sm:pt-8 pb-24 px-2 sm:px-4 animate-fadeIn`}>
      {/* Tabs — wrap evenly on mobile */}
      <div
        role="tablist"
        className="grid grid-cols-3 sm:grid-cols-5 w-full border-b border-[#E16428]/30 mb-6 sm:mb-8"
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
            <div className="mb-6">
              <label className="block text-[10px] uppercase tracking-wide text-[#F6E9E9]/45 mb-0.5 font-['Inter']">
                {editingType ? 'Edit type' : 'New type'}
              </label>
              <input
                value={editingType ? typeInput : newType}
                onChange={e => {
                  if (editingType) setTypeInput(e.target.value);
                  else setNewType(e.target.value);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (editingType) void updateType();
                    else void addType();
                  } else if (e.key === 'Escape' && editingType) {
                    setEditingType(null);
                    setTypeInput('');
                  }
                }}
                className="underline-field w-full min-w-0 px-0 py-2.5 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] focus:border-[#E16428] focus:outline-none text-sm font-['Inter'] placeholder-[#F6E9E9]/35 transition-[border-color]"
                placeholder={editingType ? 'Project type name' : 'Add new project type'}
              />
            </div>
            {loading ? (
              <div className="text-[#F6E9E9]/50 text-sm font-['Inter'] py-3">Loading...</div>
            ) : projectTypes.length === 0 ? (
              <div className="text-[#F6E9E9]/40 text-sm font-['Inter'] py-3 border-b border-[#E16428]/15">
                No project types yet
              </div>
            ) : (
              <div className="flex flex-col max-h-[min(50vh,22rem)] overflow-y-auto overscroll-contain pr-1">
                {projectTypes.map(type => (
                    <div
                      key={type.id}
                      className={`group flex items-center gap-3 py-3 border-b transition-colors ${
                        editingType?.id === type.id
                          ? 'border-[#E16428]/40'
                          : 'border-[#E16428]/15 hover:border-[#E16428]/35'
                      }`}
                    >
                      <span
                        className={`flex-1 min-w-0 text-sm font-['Inter'] truncate ${
                          editingType?.id === type.id
                            ? 'text-[#E16428]'
                            : 'text-[#F6E9E9]'
                        }`}
                      >
                        {type.name}
                        {editingType?.id === type.id && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-[#E16428]/60">
                            Editing
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingType(type);
                          setTypeInput(type.name);
                          setNewType('');
                        }}
                        disabled={editingType?.id === type.id}
                        className="p-1.5 text-[#F6E9E9]/35 hover:text-[#E16428] transition-colors opacity-70 group-hover:opacity-100 disabled:opacity-40"
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
                  ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'products' && <ExpenseProductsSettings />}

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

      {activeTab === 'project-types' &&
        (Boolean(editingType) || Boolean(newType.trim())) &&
        !showDeleteModal &&
        createPortal(
          <div className="fixed bottom-5 sm:bottom-7 inset-x-0 z-40 flex justify-center pointer-events-none px-3">
            <div className="pointer-events-auto flex items-center rounded-full bg-[#272121]/95 backdrop-blur-md border border-[#E16428]/25 shadow-xl shadow-black/40 pl-3.5 pr-1.5 py-1 gap-0.5 animate-fadeIn">
              <button
                type="button"
                onClick={() => {
                  if (editingType) void updateType();
                  else void addType();
                }}
                className="px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all"
              >
                {editingType ? 'Save' : 'Add'}
              </button>
              <span className="w-px h-4 bg-[#F6E9E9]/15 shrink-0" aria-hidden />
              <button
                type="button"
                onClick={() => {
                  if (editingType) {
                    setEditingType(null);
                    setTypeInput('');
                  } else {
                    setNewType('');
                  }
                }}
                className="px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all"
              >
                Cancel
              </button>
              <div className="ml-1.5 shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E16428] border-2 border-[#E16428]/80 flex items-center justify-center shadow-md">
                {editingType ? (
                  <Save className="w-4 h-4 text-white" strokeWidth={2.5} />
                ) : (
                  <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

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

      {showDeleteModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
            onClick={() => setShowDeleteModal(null)}
          >
            <div
              className="w-full max-w-[280px] p-6 animate-scaleIn text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative mx-auto mb-5 h-[4.5rem] w-[4.5rem]">
                <span
                  className="absolute inset-0 rounded-full border border-red-400/25 opacity-60"
                  style={{ animation: 'delete-ring 2.4s ease-out infinite' }}
                />
                <span
                  className="absolute inset-2 rounded-full border border-[#E16428]/20 opacity-50"
                  style={{ animation: 'delete-ring 2.4s ease-out 0.6s infinite' }}
                />
                <div className="relative flex h-full w-full items-center justify-center rounded-full border border-red-400/40 bg-gradient-to-br from-red-500/15 to-transparent">
                  <Trash2
                    className="h-6 w-6 text-red-400"
                    style={{ animation: 'delete-icon 2.8s ease-in-out infinite' }}
                  />
                </div>
              </div>

              <h3 className="text-2xl font-semibold tracking-tight text-[#F6E9E9] font-['Playfair_Display']">
                Delete project type?
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#F6E9E9]/55 font-['Inter']">
                Remove{' '}
                <span className="text-[#E16428] font-medium">{showDeleteModal.name}</span>
                . This can’t be undone.
              </p>

              <div className="mt-6 space-y-2.5">
                <button
                  type="button"
                  onClick={() => void handleDeleteType(showDeleteModal.id)}
                  className="group w-full flex items-center justify-center gap-2 py-3 border-0 border-b-2 border-red-500/70 rounded-none bg-transparent text-sm font-semibold text-red-400 hover:text-red-300 hover:border-red-400 transition-all duration-200 font-['Inter'] focus:outline-none"
                >
                  <Trash2 className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                  <span>Yes, delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(null)}
                  className="w-full py-2.5 border-0 border-b border-transparent rounded-none bg-transparent text-sm text-[#F6E9E9]/50 hover:text-[#F6E9E9] hover:border-[#F6E9E9]/25 transition-all duration-200 font-['Inter'] focus:outline-none"
                >
                  Keep type
                </button>
              </div>

              <p className="mt-5 text-[10px] tracking-[0.18em] uppercase text-[#F6E9E9]/25 font-['Inter']">
                Esc to keep · Enter to delete
              </p>

              <style>{`
                @keyframes delete-ring {
                  0% { transform: scale(0.85); opacity: 0.55; }
                  70% { transform: scale(1.25); opacity: 0; }
                  100% { transform: scale(1.25); opacity: 0; }
                }
                @keyframes delete-icon {
                  0%, 100% { transform: scale(1) rotate(0deg); }
                  50% { transform: scale(1.08) rotate(-6deg); }
                }
              `}</style>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}; 
