import React, { useState } from 'react';
import { CheckCircle, XCircle, DollarSign } from 'lucide-react';

interface PaymentConfirmationModalProps {
  project: {
    id: string;
    projectId: string;
    clientName: string;
    price: number;
    advance: number;
  };
  remainingBalance: number;
  onConfirm: (customAmount?: number) => void;
  onCancel: () => void;
}

export const PaymentConfirmationModal: React.FC<PaymentConfirmationModalProps> = ({
  project,
  remainingBalance,
  onConfirm,
  onCancel,
}) => {
  const [customAmount, setCustomAmount] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isFullPayment, setIsFullPayment] = useState(true);

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Allow clearing the input
    if (rawValue === '') {
      setCustomAmount('');
      return;
    }
    // Keep only digits and optional decimal point
    const sanitized = rawValue.replace(/[^\d.]/g, '');
    const parsed = parseFloat(sanitized);
    if (isNaN(parsed)) {
      setCustomAmount('');
      return;
    }
    // Clamp between 0 and remainingBalance
    const clamped = Math.max(0, Math.min(parsed, remainingBalance));
    setCustomAmount(clamped.toString());
  };

  const handlePaymentTypeChange = (isFull: boolean) => {
    setIsFullPayment(isFull);
    setShowCustomInput(!isFull);
    if (isFull) {
      setCustomAmount('');
    }
  };

  const handleConfirm = () => {
    if (isFullPayment) {
      onConfirm();
    } else {
      const amount = parseFloat(customAmount || '0');
      if (amount >= 0 && amount <= remainingBalance) {
        onConfirm(amount);
      }
    }
  };

  const isValidCustomAmount = () => {
    if (isFullPayment) return true;
    if (customAmount === '') return false;
    const amount = parseFloat(customAmount);
    return amount >= 0 && amount <= remainingBalance;
  };

  const getNewAdvanceAmount = () => {
    if (isFullPayment) {
      return project.price;
    } else {
      const amount = parseFloat(customAmount) || 0;
      return project.advance + amount;
    }
  };

  const getFinalStatus = () => {
    if (isFullPayment) {
      return 'Delivered';
    } else {
      const amount = parseFloat(customAmount) || 0;
      const newBalance = remainingBalance - amount;
      return newBalance > 0 ? 'Pending Payment' : 'Delivered';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onCancel}
    >
      <div 
        className="bg-[#272121]/95 border border-[#E16428]/20 rounded-xl shadow-2xl p-10 max-w-4xl mx-4 animate-scaleIn hover:shadow-3xl transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          {/* Header */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="p-4 bg-green-500/20 rounded-full">
              <DollarSign className="w-7 h-7 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
              Payment Required
            </h3>
          </div>
          
          {/* Project Info */}
          <div className="bg-[#232021]/60 rounded-lg p-6 mb-6 border border-[#E16428]/10">
            <div className="grid grid-cols-2 gap-6 text-left">
              <div className="space-y-1.5">
                <div className="text-[#F6E9E9]/60 text-xs">Project ID</div>
                <div className="text-[#F6E9E9] text-sm font-medium">{project.projectId}</div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[#F6E9E9]/60 text-xs">Client</div>
                <div className="text-[#F6E9E9] text-sm font-medium">{project.clientName}</div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[#F6E9E9]/60 text-xs">Total Price</div>
                <div className="text-[#E16428] text-sm font-bold">LKR {project.price.toLocaleString()}</div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[#F6E9E9]/60 text-xs">Remaining Balance</div>
                <div className="text-yellow-400 text-sm font-bold">LKR {remainingBalance.toLocaleString()}</div>
              </div>
            </div>
          </div>
          
          {/* Payment Type Selection */}
          <div className="mb-6">
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => handlePaymentTypeChange(true)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105 ${
                  isFullPayment 
                    ? 'bg-[#E16428] text-white shadow-sm' 
                    : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'
                }`}
              >
                Full Payment
              </button>
              <button
                onClick={() => handlePaymentTypeChange(false)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105 ${
                  !isFullPayment 
                    ? 'bg-[#E16428] text-white shadow-sm' 
                    : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'
                }`}
              >
                Partial Payment
              </button>
            </div>

            {/* Payment Confirmation Message */}
            <div className="overflow-hidden">
              <div className={`transition-all duration-500 ease-in-out ${
                isFullPayment 
                  ? 'max-h-20 opacity-100 transform translate-y-0' 
                  : 'max-h-0 opacity-0 transform -translate-y-4'
              }`}>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                  <p className="text-blue-300 text-sm text-center">
                    💰 Has the full payment of <span className="font-bold text-blue-200">LKR {remainingBalance.toLocaleString()}</span> been received from the client?
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Amount Input */}
            <div className="overflow-hidden">
              <div className={`transition-all duration-500 ease-in-out ${
                showCustomInput 
                  ? 'max-h-32 opacity-100 transform translate-y-0' 
                  : 'max-h-0 opacity-0 transform -translate-y-4'
              }`}>
                <div className="space-y-2 pt-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E16428] font-medium text-sm">LKR</span>
                    <input
                      type="number"
                      min={0}
                      max={remainingBalance}
                      step="0.01"
                      value={customAmount}
                      onChange={handleCustomAmountChange}
                      placeholder="Enter amount"
                      className="w-full pl-12 pr-4 py-3 bg-[#232021] border-2 border-[#E16428]/40 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] focus:bg-[#232021]/90 focus:ring-2 focus:ring-[#E16428]/20 font-['Inter'] text-base transition-all duration-200 placeholder-[#F6E9E9]/50"
                      autoFocus={showCustomInput}
                    />
                  </div>
                  <div className="text-sm text-[#F6E9E9]/50 text-center">
                    Maximum: LKR {remainingBalance.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="overflow-hidden">
            <div className={`transition-all duration-500 ease-in-out ${
              showCustomInput && parseFloat(customAmount) > 0
                ? 'max-h-32 opacity-100 transform translate-y-0' 
                : 'max-h-0 opacity-0 transform -translate-y-4'
            }`}>
              <div className="bg-[#232021]/60 rounded-lg p-3 mb-4 border border-[#E16428]/10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#F6E9E9]/70">New Advance:</span>
                  <span className="text-green-400 font-bold">
                    LKR {getNewAdvanceAmount().toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-[#F6E9E9]/70">Remaining:</span>
                  <span className="text-yellow-400 font-medium">
                    LKR {(remainingBalance - (parseFloat(customAmount) || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-[#1a1818]/80 border border-[#E16428]/30 rounded-md text-[#F6E9E9] hover:bg-[#E16428]/10 hover:border-[#E16428] transition-all duration-300 font-medium text-xs flex items-center justify-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isValidCustomAmount()}
              className={`flex-1 px-4 py-2.5 rounded-md font-medium text-xs flex items-center justify-center gap-1.5 transition-all duration-300 ${
                isValidCustomAmount()
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:scale-105'
                  : 'bg-gray-500/50 text-gray-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="transition-all duration-300">
                {isFullPayment ? 'Full Payment Received' : 'Partial Payment'}
              </span>
            </button>
          </div>
          
          {/* Additional Info */}
          <div className="overflow-hidden">
            <p className="text-sm text-[#F6E9E9]/50 mt-3 text-center transition-all duration-300">
              {isFullPayment 
                ? 'Advance will match total price'
                : 'Amount will be added to advance'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};