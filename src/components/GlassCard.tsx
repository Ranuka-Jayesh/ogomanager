import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`backdrop-blur-md bg-[#272121]/40 border border-[#E16428]/20 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
};