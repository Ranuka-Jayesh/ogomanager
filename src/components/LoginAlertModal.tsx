interface LoginAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  loginTime?: string;
}

export function LoginAlertModal({ isOpen, onClose, loginTime }: LoginAlertModalProps) {
  if (!isOpen) return null;

  const formattedTime = loginTime
    ? new Date(loginTime).toLocaleString()
    : 'A moment ago';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#272121]/95 border border-[#E16428]/30 rounded-2xl shadow-2xl p-8 max-w-md mx-4">
        <div className="text-center">
          <h3 className="text-xl font-bold text-[#F6E9E9] mb-2 font-['Playfair_Display']">
            New Login Detected
          </h3>
          <p className="text-[#F6E9E9]/80 mb-1">
            Your account was accessed from another device.
          </p>
          <p className="text-[#F6E9E9]/60 text-sm mb-6">
            Time: {formattedTime}
          </p>
          <button
            onClick={onClose}
            className="px-5 py-3 bg-gradient-to-r from-[#E16428] to-[#d4551f] text-white rounded-lg hover:scale-105 transition-all duration-300 font-medium"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
