import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Mail, Lock, LogIn, Triangle, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { useBiometricAuth } from '../hooks/useBiometricAuth';

interface LoginPageProps {
  onLoginSuccess: (email: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Biometric authentication (mobile only)
  const { 
    isSupported, 
    hasCredentials, 
    registerBiometric, 
    authenticateBiometric 
  } = useBiometricAuth();
  const [showBiometricOption, setShowBiometricOption] = useState(false);

  // Check if biometric option should be shown
  useEffect(() => {
    setShowBiometricOption(isSupported && hasCredentials);
  }, [isSupported, hasCredentials]);

  // Handle biometric authentication
  const handleBiometricLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const authenticatedEmail = await authenticateBiometric();
      
      if (authenticatedEmail) {
        // Verify user exists in database
        const { data: admin, error: adminError } = await supabase
          .from('admin')
          .select('*')
          .eq('email', authenticatedEmail)
          .single();

        if (adminError || !admin) {
          throw new Error('Biometric authentication failed. User not found.');
        }

        // Log successful biometric login
        await supabase.from('log').insert({
          admin_id: admin.id,
          admin_email: authenticatedEmail,
          action: 'login_success_biometric',
        });

        onLoginSuccess(authenticatedEmail);
      } else {
        setError('Biometric authentication cancelled or failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Biometric authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Check if the user exists
      const { data: admin, error: adminError } = await supabase
        .from('admin')
        .select('*')
        .eq('email', email)
        .single();

      if (adminError || !admin) {
        throw new Error('Invalid email or password.');
      }

      // 2. Check if the password matches (plain text comparison, not for production)
      if (admin.password !== password) {
        // Log failed login attempt
        await supabase.from('log').insert({
          admin_id: admin.id,
          admin_email: email,
          action: 'login_fail',
        });
        throw new Error('Invalid email or password.');
      }

      // 3. Log successful login
      await supabase.from('log').insert({
        admin_id: admin.id,
        admin_email: email,
        action: 'login_success',
      });

      // 4. Handle successful login
      onLoginSuccess(email);

      // 5. Offer to register biometric on mobile (if supported and not already registered)
      if (isSupported && !hasCredentials) {
        // Small delay to ensure login completes
        setTimeout(async () => {
          const enableBiometric = window.confirm(
            'Would you like to enable fingerprint/face ID login for faster access?'
          );
          
          if (enableBiometric) {
            const success = await registerBiometric(email, admin.id);
            if (success) {
              setShowBiometricOption(true);
              alert('Biometric authentication enabled! You can use it next time you log in.');
            } else {
              alert('Failed to enable biometric authentication. You can try again later.');
            }
          }
        }, 500);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#1a1818] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background shapes */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-gradient-to-br from-[#E16428]/30 to-transparent rounded-full opacity-50 animate-pulse-slow"></div>
      <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-gradient-to-tl from-[#E16428]/30 to-transparent rounded-full opacity-50 animate-pulse-slow animation-delay-2000"></div>

      <div className="w-full max-w-md z-10">
        <form
          onSubmit={handleLogin}
          className="bg-[#272121]/60 backdrop-blur-xl border border-[#E16428]/20 rounded-2xl shadow-2xl p-8 space-y-6 animate-fadeIn"
        >
          <div className="text-center mb-6">
            <div className="inline-block p-3 bg-gradient-to-r from-[#E16428] to-[#F6E9E9] rounded-xl mb-4">
              <Triangle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
              ogo Manager Pro
            </h1>
            <p className="text-[#F6E9E9]/70 mt-1">
              Welcome back, please log in.
            </p>
          </div>
          
          {/* Email Input */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#E16428]" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#1a1818]/80 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] focus:ring-2 focus:ring-[#E16428]/50 transition-all duration-300"
              required
            />
          </div>
          
          {/* Password Input */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#E16428]" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-12 py-3 bg-[#1a1818]/80 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] focus:ring-2 focus:ring-[#E16428]/50 transition-all duration-300"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#E16428] hover:text-[#F6E9E9] transition-colors duration-300 focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <div className="relative w-5 h-5">
                <Eye
                  className={`absolute inset-0 w-5 h-5 transition-all duration-300 ease-in-out ${
                    showPassword
                      ? 'opacity-0 rotate-90 scale-0'
                      : 'opacity-100 rotate-0 scale-100'
                  }`}
                />
                <EyeOff
                  className={`absolute inset-0 w-5 h-5 transition-all duration-300 ease-in-out ${
                    showPassword
                      ? 'opacity-100 rotate-0 scale-100'
                      : 'opacity-0 -rotate-90 scale-0'
                  }`}
                />
              </div>
            </button>
          </div>

          {error && (
            <div className="text-center text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}

          {/* Biometric Login Button (Mobile Only) */}
          {showBiometricOption && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#E16428]/80 to-[#d35400]/80 text-white font-bold rounded-lg shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#E16428]/50 mb-2"
            >
              <Fingerprint className="w-5 h-5" />
              <span>Use Fingerprint / Face ID</span>
            </button>
          )}

          {/* Divider (Mobile Only) */}
          {showBiometricOption && (
            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-[#E16428]/30"></div>
              <span className="text-[#F6E9E9]/50 text-sm">OR</span>
              <div className="flex-1 h-px bg-[#E16428]/30"></div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#E16428] to-[#d35400] text-white font-bold rounded-lg shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#E16428]/50"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}; 