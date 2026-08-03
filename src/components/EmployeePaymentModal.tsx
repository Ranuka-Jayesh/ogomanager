import React, { useState } from 'react';
import { CheckCircle, Undo2 } from 'lucide-react';
import { EmployeePayment } from '../types';
import {
  applyEmployeePaymentAction,
  getEmployeePaidAmount,
  getEmployeeRemainingAmount,
} from '../utils/employeePayments';

interface EmployeePaymentModalProps {
  projectId: string;
  clientName: string;
  employeeName: string;
  payment: EmployeePayment;
  onConfirm: (next: EmployeePayment) => void;
  onCancel: () => void;
}

type Mode = 'full' | 'partial' | 'return';

export const EmployeePaymentModal: React.FC<EmployeePaymentModalProps> = ({
  projectId,
  clientName,
  employeeName,
  payment,
  onConfirm,
  onCancel,
}) => {
  const due = Math.abs(payment.amount ?? payment.payment ?? 0);
  const paid = getEmployeePaidAmount(payment);
  const remaining = getEmployeeRemainingAmount(payment);
  const isZeroDue = due === 0;
  const isPaid = payment.status === 'paid';
  const canMarkFull = isZeroDue ? !isPaid : remaining > 0;
  const canReturn = isZeroDue ? isPaid : paid > 0;
  const canPartial = !isZeroDue && remaining > 0;

  const [mode, setMode] = useState<Mode>(canMarkFull ? 'full' : 'return');
  const [customAmount, setCustomAmount] = useState('');

  const maxForMode = mode === 'return' ? paid : remaining;

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
    if (cleaned === '' || cleaned === '.') {
      setCustomAmount(cleaned === '.' ? '0.' : '');
      return;
    }
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed > maxForMode) {
      setCustomAmount(
        maxForMode.toLocaleString('en-US', {
          maximumFractionDigits: 2,
          minimumFractionDigits: Number.isInteger(maxForMode) ? 0 : 2,
        })
      );
      return;
    }
    setCustomAmount(formatWithCommas(cleaned));
  };

  const handleModeChange = (next: Mode) => {
    setMode(next);
    setCustomAmount('');
  };

  const amountValue = parseAmount(customAmount) || 0;

  const isValid = () => {
    if (mode === 'full') return canMarkFull;
    if (mode === 'return' && isZeroDue) return canReturn;
    if (customAmount === '') return false;
    const amount = parseAmount(customAmount);
    if (isNaN(amount) || amount <= 0) return false;
    if (mode === 'partial') return amount <= remaining;
    return amount <= paid;
  };

  const preview = () => {
    if (mode === 'full') return applyEmployeePaymentAction(payment, 'full');
    if (mode === 'partial') return applyEmployeePaymentAction(payment, 'partial', amountValue);
    if (isZeroDue && mode === 'return') return applyEmployeePaymentAction(payment, 'return');
    return applyEmployeePaymentAction(payment, 'return', amountValue);
  };

  const handleConfirm = () => {
    if (!isValid()) return;
    onConfirm(preview());
  };

  const actionLabel =
    mode === 'full'
      ? 'Mark paid'
      : mode === 'partial'
        ? 'Apply payment'
        : isZeroDue
          ? 'Mark unpaid'
          : 'Return';

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
            Emp. payment
          </h3>
          <p className="mt-1 text-[12px] text-[#F6E9E9]/45 font-['Inter'] truncate">
            {projectId} · {employeeName || clientName}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="text-center border-0 border-b border-[#E16428]/40 pb-2">
            <p className="text-[9px] tracking-[0.14em] uppercase text-[#F6E9E9]/40 font-['Inter']">
              Due
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[#E16428] font-['Inter'] tabular-nums">
              {due.toLocaleString()}
            </p>
          </div>
          <div className="text-center border-0 border-b border-emerald-400/50 pb-2">
            <p className="text-[9px] tracking-[0.14em] uppercase text-[#F6E9E9]/40 font-['Inter']">
              Paid
            </p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-400 font-['Inter'] tabular-nums">
              {paid.toLocaleString()}
            </p>
          </div>
          <div className="text-center border-0 border-b border-yellow-400/50 pb-2">
            <p className="text-[9px] tracking-[0.14em] uppercase text-[#F6E9E9]/40 font-['Inter']">
              Left
            </p>
            <p className="mt-0.5 text-sm font-semibold text-yellow-400 font-['Inter'] tabular-nums">
              {remaining.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {(
            [
              { id: 'full' as const, label: 'Full', disabled: !canMarkFull },
              { id: 'partial' as const, label: 'Partial', disabled: !canPartial },
              { id: 'return' as const, label: isZeroDue ? 'Unpaid' : 'Return', disabled: !canReturn },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => handleModeChange(tab.id)}
              className={`flex-1 pb-2 text-xs font-medium font-['Inter'] bg-transparent border-0 border-b-2 rounded-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                mode === tab.id
                  ? 'text-[#E16428] border-[#E16428]'
                  : 'text-[#F6E9E9]/45 border-transparent hover:text-[#F6E9E9]/75'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === 'full' && (
          <p className="text-[13px] text-center text-[#F6E9E9]/55 font-['Inter'] leading-relaxed mb-5">
            {isZeroDue ? (
              <>Mark this <span className="text-[#F6E9E9]">LKR 0</span> as paid?</>
            ) : (
              <>
                Mark remaining{' '}
                <span className="text-[#E16428] font-medium">
                  LKR {remaining.toLocaleString()}
                </span>{' '}
                as paid?
              </>
            )}
          </p>
        )}

        {mode === 'return' && isZeroDue && (
          <p className="text-[13px] text-center text-[#F6E9E9]/55 font-['Inter'] leading-relaxed mb-5">
            Mark this payment as <span className="text-yellow-400 font-medium">unpaid</span>?
          </p>
        )}

        {((mode === 'partial') || (mode === 'return' && !isZeroDue)) && (
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
                placeholder={mode === 'partial' ? 'Amount to pay' : 'Amount to return'}
                className="underline-field w-full pl-9 pr-0 py-2.5 bg-transparent border-0 border-b border-[#E16428]/35 rounded-none text-[#F6E9E9] text-sm focus:outline-none focus:border-[#E16428] focus:ring-0 font-['Inter'] placeholder-[#F6E9E9]/30"
                autoFocus
              />
            </div>
            <p className="text-[10px] text-[#F6E9E9]/35 text-center font-['Inter']">
              Max LKR {maxForMode.toLocaleString()}
            </p>

            {amountValue > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-['Inter'] border-b border-[#E16428]/10 pb-1.5">
                  <span className="text-[#F6E9E9]/45">New paid</span>
                  <span className="text-emerald-400 font-medium tabular-nums">
                    LKR {getEmployeePaidAmount(preview()).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-['Inter']">
                  <span className="text-[#F6E9E9]/45">Remaining</span>
                  <span className="text-yellow-400 font-medium tabular-nums">
                    LKR {getEmployeeRemainingAmount(preview()).toLocaleString()}
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
            disabled={!isValid()}
            className={`w-full flex items-center justify-center gap-2 py-3 border-0 border-b-2 rounded-none bg-transparent text-sm font-semibold font-['Inter'] transition-colors focus:outline-none disabled:opacity-35 disabled:cursor-not-allowed ${
              mode === 'return'
                ? 'border-blue-400/70 text-blue-400 hover:border-blue-400 hover:text-blue-300'
                : 'border-[#E16428] text-[#E16428] hover:text-[#f07a42] hover:border-[#f07a42]'
            }`}
          >
            {mode === 'return' ? <Undo2 className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {actionLabel}
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
