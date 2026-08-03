import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Employee } from '../types';
import { GlassCard } from './GlassCard';

interface EmployeeModalProps {
  employee: Employee | null;
  onClose: () => void;
  onSave: (employee: Omit<Employee, 'id'>) => void;
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  employee,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    employeeId: '',
    birthday: '',
    firstName: '',
    lastName: '',
    position: '',
    address: '',
    whatsappNumber: '',
    emailAddress: '',
    qualifications: '',
    isActive: true,
  });

  useEffect(() => {
    if (employee) {
      setFormData({
        employeeId: employee.employeeId || '',
        birthday: employee.birthday || '',
        firstName: employee.firstName,
        lastName: employee.lastName,
        position: employee.position,
        address: employee.address,
        whatsappNumber: employee.whatsappNumber,
        emailAddress: employee.emailAddress,
        qualifications: employee.qualifications,
        isActive: employee.isActive !== false,
      });
    } else {
      setFormData({
        employeeId: '',
        birthday: '',
        firstName: '',
        lastName: '',
        position: '',
        address: '',
        whatsappNumber: '',
        emailAddress: '',
        qualifications: '',
        isActive: true,
      });
    }
  }, [employee]);

  // ESC key handler to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <GlassCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
              {employee ? 'Edit Employee' : 'Add New Employee'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 bg-[#272121]/50 text-[#F6E9E9] rounded-lg hover:bg-[#E16428]/20 transition-all duration-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Employee ID
                </label>
                <input
                  type="text"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                />
              </div>
              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Birthday
                </label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                />
              </div>
              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                Position
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                required
              />
            </div>

            <div>
              <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                />
              </div>

              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.emailAddress}
                  onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                Qualifications
              </label>
              <textarea
                value={formData.qualifications}
                onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                rows={4}
                required
              />
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={formData.isActive}
              onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                formData.isActive
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-[#E16428]/20 bg-[#272121]/50'
              }`}
            >
              <span className="text-sm text-[#F6E9E9] font-['Inter']">
                {formData.isActive ? 'Active employee' : 'Inactive employee'}
              </span>
              <span
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  formData.isActive ? 'bg-emerald-500/50' : 'bg-[#F6E9E9]/15'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    formData.isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

            <div className="flex justify-end space-x-4 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-[#272121]/50 text-[#F6E9E9] rounded-lg hover:bg-[#272121]/70 transition-all duration-300 font-['Poppins']"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-shortcut="save"
                className="px-6 py-3 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white rounded-lg hover:scale-105 transition-all duration-300 shadow-lg font-['Poppins'] flex items-center gap-2"
              >
                {employee ? 'Update' : 'Create'} Employee
                <kbd className="px-2 py-1 bg-white/20 rounded text-xs font-mono">Alt + S</kbd>
              </button>
            </div>
          </form>
        </div>
      </GlassCard>
    </div>
  );
};