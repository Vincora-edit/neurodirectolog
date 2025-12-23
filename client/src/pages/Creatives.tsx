import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { creativesService } from '../services/api';
import { Sparkles } from 'lucide-react';

export default function Creatives() {
  const [businessInfo, setBusinessInfo] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [creatives, setCreatives] = useState<any>(null);

  const generateMutation = useMutation({
    mutationFn: () => creativesService.generate(businessInfo, targetAudience),
    onSuccess: (data) => {
      setCreatives(data);
    },
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    generateMutation.mutate();
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Генерация креативов</h1>
        <p className="mt-2 text-gray-600">
          Создавайте креативные идеи для рекламных материалов
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
              placeholder="Опишите ваш бизнес, продукт или услугу..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Целевая аудитория
            </label>
            <textarea
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              required
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Опишите вашу целевую аудиторию..."
            />
          </div>

          <button
            type="submit"
            disabled={generateMutation.isPending}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles size={20} />
            {generateMutation.isPending ? 'Генерация...' : 'Сгенерировать креативы'}
          </button>
        </form>
      </div>

      {creatives && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Результаты</h2>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm">
            {JSON.stringify(creatives, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
