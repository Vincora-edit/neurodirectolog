import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import { dashboardService } from '../../hooks/useDashboardData';

interface AIRecommendationsProps {
  connectionId: string;
}

export function AIRecommendations({ connectionId }: AIRecommendationsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['yandex-recommendations', connectionId],
    queryFn: () => dashboardService.getRecommendations(connectionId),
    enabled: !!connectionId,
    refetchInterval: 10 * 60 * 1000,
  });

  const getBgColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200';
      case 'warning':
        return 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200';
      case 'success':
        return 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200';
      default:
        return 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle size={18} className="text-red-600" />;
      case 'warning':
        return <AlertCircle size={18} className="text-amber-600" />;
      case 'success':
        return <CheckCircle size={18} className="text-green-600" />;
      default:
        return <Sparkles size={18} className="text-blue-600" />;
    }
  };

  const hasCritical = Array.isArray(recommendations) && recommendations.some((r: any) => r.type === 'critical');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Sparkles size={20} className="text-purple-600" />
          <span className="font-semibold text-gray-900">AI-рекомендации</span>
        </div>
        <div className="flex items-center gap-3">
          {hasCritical && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              <AlertTriangle size={14} />
              Требует внимания
            </div>
          )}
          {isOpen ? (
            <ChevronUp size={20} className="text-gray-400" />
          ) : (
            <ChevronDown size={20} className="text-gray-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-200 px-5 py-4">
          {isLoading ? (
            <div className="text-center py-6 text-gray-500">
              <Loader2 size={32} className="mx-auto mb-3 animate-spin text-gray-300" />
              <p className="text-sm">Анализируем данные...</p>
            </div>
          ) : Array.isArray(recommendations) && recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec: any, index: number) => (
                <div key={index} className={`rounded-xl p-4 border ${getBgColor(rec.type)}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">{getIcon(rec.type)}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-sm">{rec.title}</h4>
                      <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                      <div className="flex items-center gap-2">
                        <ArrowRight size={14} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">{rec.actionText}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <CheckCircle size={40} className="mx-auto mb-3 text-green-300" />
              <p className="text-sm font-medium text-green-700">Всё отлично!</p>
              <p className="text-xs text-gray-500 mt-1">Критических проблем не обнаружено</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
