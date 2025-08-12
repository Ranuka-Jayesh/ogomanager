import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Edit, Trash2, Plus, Save, X, Lock, Layers } from 'lucide-react';

const TABS = [
  { id: 'project-types', label: 'Project Types', icon: Layers },
  { id: 'admin-password', label: 'Admin Password', icon: Lock },
];

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('project-types');

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

  // Fetch project types
  useEffect(() => {
    if (activeTab === 'project-types') fetchTypes();
    // eslint-disable-next-line
  }, [activeTab]);

  async function fetchTypes() {
    setLoading(true);
    const { data } = await supabase.from('project_types').select('*').order('created_at');
    setProjectTypes(data || []);
    setLoading(false);
  }

  async function addType() {
    if (!newType.trim()) return;
    const { error } = await supabase.from('project_types').insert({ name: newType.trim() });
    if (!error) {
      setNewType('');
      fetchTypes();
    }
  }

  async function updateType() {
    if (!editingType || !typeInput.trim()) return;
    const { error } = await supabase
      .from('project_types')
      .update({ name: typeInput.trim() })
      .eq('id', editingType.id);
    if (!error) {
      setEditingType(null);
      setTypeInput('');
      fetchTypes();
    }
  }

  async function handleDeleteType(id: string) {
    await supabase.from('project_types').delete().eq('id', id);
    setShowDeleteModal(null);
    fetchTypes();
  }

  // Dummy password change handler (replace with real auth logic)
  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg('New passwords do not match.');
      return;
    }
    // TODO: Implement real password change logic with Supabase Auth
    setPasswordMsg('Password change feature not implemented in this demo.');
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
    <div className="max-w-2xl mx-auto py-4 sm:py-8 px-2 sm:px-4 animate-fadeIn">
      {/* Tabs */}
      <div className="flex border-b border-[#E16428]/30 mb-6 sm:mb-8">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 sm:px-6 py-2 sm:py-3 font-medium transition-all duration-200 border-b-2 text-sm sm:text-base ${
                isActive
                  ? 'border-[#E16428] text-[#E16428] bg-[#272121]/40'
                  : 'border-transparent text-[#F6E9E9]/70 hover:text-[#E16428]'
              }`}
              style={{ outline: 'none' }}
            >
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-[#272121]/60 rounded-xl shadow-lg p-4 sm:p-6">
        {activeTab === 'project-types' && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-[#F6E9E9] mb-4">Project Types</h2>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mb-4">
              <input
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#272121]/50 border border-[#E16428]/20 text-[#F6E9E9] focus:outline-none text-sm"
                placeholder="Add new project type"
              />
              <button
                onClick={addType}
                className="bg-[#E16428] text-white px-4 py-2 rounded hover:bg-[#d35400] flex items-center justify-center sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </button>
            </div>
            {loading ? (
              <div className="text-[#F6E9E9]/70">Loading...</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {projectTypes.map(type =>
                  editingType && editingType.id === type.id ? (
                    <div key={type.id} className="flex items-center bg-[#363333] border border-[#E16428]/30 rounded-full px-3 py-1 space-x-2 shadow transition">
                      <input
                        value={typeInput}
                        onChange={e => setTypeInput(e.target.value)}
                        className="bg-transparent border-none outline-none text-[#F6E9E9] px-1 text-sm"
                      />
                      <button onClick={updateType} className="text-green-500"><Save className="w-4 h-4" /></button>
                      <button onClick={() => setEditingType(null)} className="text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div key={type.id} className="flex items-center bg-[#272121]/70 border border-[#E16428]/20 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 space-x-2 shadow hover:scale-105 transition cursor-pointer">
                      <Layers className="w-3 h-3 sm:w-4 sm:h-4 text-[#E16428]" />
                      <span className="text-[#F6E9E9] font-medium text-xs sm:text-sm">{type.name}</span>
                      <button onClick={() => { setEditingType(type); setTypeInput(type.name); }} className="text-blue-400 hover:scale-110 transition"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setShowDeleteModal(type)} className="text-red-400 hover:scale-110 transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'admin-password' && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-[#F6E9E9] mb-4">Admin Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#272121]/50 border border-[#E16428]/20 text-[#F6E9E9] text-sm"
                placeholder="Current password"
                required
              />
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#272121]/50 border border-[#E16428]/20 text-[#F6E9E9] text-sm"
                placeholder="New password"
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#272121]/50 border border-[#E16428]/20 text-[#F6E9E9] text-sm"
                placeholder="Confirm new password"
                required
              />
              <button
                type="submit"
                className="bg-[#E16428] text-white px-4 py-2 rounded hover:bg-[#d35400] w-full"
              >
                Change Password
              </button>
              {passwordMsg && <div className="text-red-400">{passwordMsg}</div>}
            </form>
          </section>
        )}
      </div>

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