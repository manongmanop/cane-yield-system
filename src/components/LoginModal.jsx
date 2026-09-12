import React, { useState } from 'react';
import { User, Lock, LogIn, AlertCircle, Database, MapPin } from 'lucide-react';
import { loginUser } from '../services/plotService';

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await loginUser(username, password);
      if (result && result.user) {
        onLoginSuccess(result.user);
      }
    } catch (err) {
      setError(err.message || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
            <Database className="w-7 h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            ระบบคำนวณและประเมินผลผลิตอ้อย
          </h1>
          <p className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" /> โรงงานน้ำตาล จ.สุรินทร์ (อ.ปราสาท)
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-950/50 border border-rose-500/40 text-rose-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2 font-medium animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              ชื่อผู้ใช้งาน (Username)
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้งาน..."
                className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน..."
                className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>เข้าสู่ระบบ (Login)</span>
              </>
            )}
          </button>
        </form>

        {/* Security Note */}
        <div className="text-center text-[11px] text-slate-500 pt-2 border-t border-slate-800">
          กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับอนุญาตเพื่อเข้าใช้งานระบบ GIS และการคำนวณ
        </div>

      </div>
    </div>
  );
}
