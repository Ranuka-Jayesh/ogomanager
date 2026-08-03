import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';

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

  const parseAmount = (value: string) => {
    if (!value) return NaN;
    return parseFloat(value.replace(/,/g, ''));
  };

  const formatWithCommas = (raw: string) => {
    const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
    if (!cleaned) return '';

    const parts = cleaned.split('.');
    const intPart = parts[0] || '0';
    const hasDot = cleaned.includes('.');
    const decPart = parts[1] !== undefined ? parts[1].slice(0, 2) : undefined;

    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (hasDot) {
      return decPart !== undefined ? `${formattedInt}.${decPart}` : `${formattedInt}.`;
    }
    return formattedInt;
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === '') {
      setCustomAmount('');
      return;
    }

    const cleaned = rawValue.replace(/,/g, '').replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);

    if (cleaned === '' || cleaned === '.') {
      setCustomAmount(cleaned === '.' ? '0.' : '');
      return;
    }

    if (!isNaN(parsed) && parsed > remainingBalance) {
      setCustomAmount(
        remainingBalance.toLocaleString('en-US', {
          maximumFractionDigits: 2,
          minimumFractionDigits: Number.isInteger(remainingBalance) ? 0 : 2,
        })
      );
      return;
    }

    setCustomAmount(formatWithCommas(cleaned));
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
      const amount = parseAmount(customAmount);
      if (!isNaN(amount) && amount >= 0 && amount <= remainingBalance) {
        onConfirm(amount);
      }
    }
  };

  const isValidCustomAmount = () => {
    if (isFullPayment) return true;
    if (customAmount === '') return false;
    const amount = parseAmount(customAmount);
    return !isNaN(amount) && amount >= 0 && amount <= remainingBalance;
  };

  const getNewAdvanceAmount = () => {
    if (isFullPayment) {
      return project.price;
    }
    const amount = parseAmount(customAmount) || 0;
    return project.advance + amount;
  };

  const amountValue = parseAmount(customAmount) || 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[300px] p-6 animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <h3 className="text-xl font-semibold tracking-tight text-[#F6E9E9] font-['Playfair_Display']">
            Client payment
          </h3>
          <p className="mt-1 text-[12px] text-[#F6E9E9]/45 font-['Inter'] truncate">
            {project.projectId} · {project.clientName}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="text-center border-0 border-b border-[#E16428]/45 pb-2">
            <p className="text-[9px] tracking-[0.14em] uppercase text-[#F6E9E9]/40 font-['Inter']">
              Total
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[#E16428] font-['Inter'] tabular-nums">
              LKR {project.price.toLocaleString()}
            </p>
          </div>
          <div className="text-center border-0 border-b border-yellow-400/50 pb-2">
            <p className="text-[9px] tracking-[0.14em] uppercase text-[#F6E9E9]/40 font-['Inter']">
              Balance
            </p>
            <p className="mt-0.5 text-sm font-semibold text-yellow-400 font-['Inter'] tabular-nums">
              LKR {remainingBalance.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => handlePaymentTypeChange(true)}
            className={`flex-1 pb-2 text-xs font-medium font-['Inter'] bg-transparent border-0 border-b-2 rounded-none transition-colors ${
              isFullPayment
                ? 'text-[#E16428] border-[#E16428]'
                : 'text-[#F6E9E9]/45 border-transparent hover:text-[#F6E9E9]/75'
            }`}
          >
            Full
          </button>
          <button
            type="button"
            onClick={() => handlePaymentTypeChange(false)}
            className={`flex-1 pb-2 text-xs font-medium font-['Inter'] bg-transparent border-0 border-b-2 rounded-none transition-colors ${
              !isFullPayment
                ? 'text-[#E16428] border-[#E16428]'
                : 'text-[#F6E9E9]/45 border-transparent hover:text-[#F6E9E9]/75'
            }`}
          >
            Partial
          </button>
        </div>

        {isFullPayment && (
          <p className="text-[13px] text-center text-[#F6E9E9]/55 font-['Inter'] leading-relaxed mb-5">
            Confirm full payment of{' '}
            <span className="text-[#E16428] font-medium">
              LKR {remainingBalance.toLocaleString()}
            </span>
            ?
          </p>
        )}

        {showCustomInput && (
          <div className="space-y-2 mb-5">
            <div className="relative">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[#E16428] text-xs font-medium">
                LKR
              </span>
              <input
                type="text"
                inputMode="numeric"
                enterKeyHint="done"
                autoComplete="off"
                value={customAmount}
                onChange={handleCustomAmountChange}
                placeholder="Enter amount"
                className="underline-field w-full pl-9 pr-0 py-2.5 bg-transparent border-0 border-b border-[#E16428]/35 rounded-none text-[#F6E9E9] text-sm focus:outline-none focus:border-[#E16428] focus:ring-0 font-['Inter'] placeholder-[#F6E9E9]/30"
                autoFocus
              />
            </div>
            <p className="text-[10px] text-[#F6E9E9]/35 text-center font-['Inter']">
              Max LKR {remainingBalance.toLocaleString()}
            </p>

            {amountValue > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-['Inter'] border-b border-[#E16428]/10 pb-1.5">
                  <span className="text-[#F6E9E9]/45">New advance</span>
                  <span className="text-emerald-400 font-medium tabular-nums">
                    LKR {getNewAdvanceAmount().toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-['Inter']">
                  <span className="text-[#F6E9E9]/45">Remaining</span>
                  <span className="text-yellow-400 font-medium tabular-nums">
                    LKR {(remainingBalance - amountValue).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isValidCustomAmount()}
            className="w-full flex items-center justify-center gap-2 py-3 border-0 border-b-2 border-[#E16428] rounded-none bg-transparent text-sm font-semibold text-[#E16428] hover:text-[#f07a42] hover:border-[#f07a42] transition-colors font-['Inter'] focus:outline-none disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4" />
            {isFullPayment ? 'Confirm' : 'Apply'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 border-0 border-b border-transparent rounded-none bg-transparent text-sm text-[#F6E9E9]/45 hover:text-[#F6E9E9] hover:border-[#F6E9E9]/25 transition-colors font-['Inter'] focus:outline-none"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};
