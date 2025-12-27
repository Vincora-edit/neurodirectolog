import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Mail, RefreshCw, ArrowLeft } from 'lucide-react';
import { authService } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);

  const email = location.state?.email || '';
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) {
      navigate('/register');
    }
  }, [email, navigate]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const verifyMutation = useMutation({
    mutationFn: () => authService.verifyEmail(email, code.join('')),
    onSuccess: (response) => {
      if (response.success && response.data) {
        setAuth(response.data.user, response.data.token);
        navigate('/');
      }
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => authService.resendCode(email),
    onSuccess: () => {
      setResendCooldown(60);
    },
  });

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      setTimeout(() => {
        verifyMutation.mutate();
      }, 100);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      setTimeout(() => {
        verifyMutation.mutate();
      }, 100);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.every(digit => digit !== '')) {
      verifyMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Подтверждение email</h1>
            <p className="text-gray-600 mt-2">
              Мы отправили код на<br />
              <span className="font-medium text-gray-900">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-12 h-14 text-center text-xl font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {verifyMutation.isError && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm text-center">
                Неверный или просроченный код. Попробуйте снова.
              </div>
            )}

            <button
              type="submit"
              disabled={verifyMutation.isPending || code.some(digit => digit === '')}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {verifyMutation.isPending ? 'Проверка...' : 'Подтвердить'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 mb-2">Не получили код?</p>
            <button
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending || resendCooldown > 0}
              className="inline-flex items-center gap-2 text-primary-600 font-medium hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
              {resendCooldown > 0
                ? `Отправить повторно (${resendCooldown}с)`
                : 'Отправить повторно'}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Изменить email
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
