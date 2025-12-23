import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { strategyService } from '../services/api';
import { Sparkles } from 'lucide-react';

export default function Strategy() {
  const [businessInfo, setBusinessInfo] = useState('');
  const [budget, setBudget] = useState('');
  const [goals, setGoals] = useState('');
  const [strategy, setStrategy] = useState<any>(null);

  const generateMutation = useMutation({
    mutationFn: () => strategyService.generate(businessInfo, Number(budget), goals),
    onSuccess: (data) => {
      setStrategy(data);
    },
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    generateMutation.mutate();
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Стратегия запуска</h1>
        <p className="mt-2 text-gray-600">
          Разработайте стратегию запуска рекламной кампании с помощью AI
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleGenerate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Информация о бизнесе
            </label>
            <textarea
              value={businessInfo}
              onChange={(e) => setBusinessInfo(e.target.value)}
              required
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Опишите ваш бизнес, продукт, целевую аудиторию..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Бюджет (руб/месяц)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              required
              min="0"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Например: 50000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Цели кампании
            </label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              required
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Опишите цели: увеличение продаж, рост узнаваемости, привлечение лидов..."
            />
          </div>

          <button
            type="submit"
            disabled={generateMutation.isPending}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles size={20} />
            {generateMutation.isPending ? 'Разработка стратегии...' : 'Разработать стратегию'}
          </button>
        </form>
      </div>

      {strategy && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Стратегия запуска</h2>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm whitespace-pre-wrap">
            {JSON.stringify(strategy, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
