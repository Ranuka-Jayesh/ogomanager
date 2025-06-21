import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Mail, Lock, LogIn, Triangle } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (email: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#1a1818]/80 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] focus:ring-2 focus:ring-[#E16428]/50 transition-all duration-300"
              required
            />
          </div>

          {error && (
            <div className="text-center text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              {error}
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