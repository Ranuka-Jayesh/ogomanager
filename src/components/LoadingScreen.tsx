import React from 'react';

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#000' }}>
    <img src="/logo.gif" alt="Loading..." className="w-48 h-48" />
  </div>
);

export default LoadingScreen; 