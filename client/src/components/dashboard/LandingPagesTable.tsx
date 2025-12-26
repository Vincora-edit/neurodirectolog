import { useState } from 'react';
import { Link as LinkIcon, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { dashboardService } from '../../hooks/useDashboardData';

interface LandingPagesTableProps {
  activeProjectId: string;
  activeConnectionId: string;
  dateRange: number;
  selectedGoalIds: string[];
  customDateMode: boolean;
  customStartDate: string;
  customEndDate: string;
}

export function LandingPagesTable({
  activeProjectId,
  activeConnectionId,
  dateRange,
  selectedGoalIds,
  customDateMode,
  customStartDate,
  customEndDate,
}: LandingPagesTableProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [landingPages, setLandingPages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadLandingPages = async () => {
    if (!activeProjectId) return;
    setIsLoading(true);
    try {
      const data = await dashboardService.getLandingPages(
        activeProjectId,
        dateRange,
        selectedGoalIds.length > 0 ? selectedGoalIds : undefined,
        customDateMode ? customStartDate : undefined,
        customDateMode ? customEndDate : undefined,
        activeConnectionId
      );
      setLandingPages(Array.isArray(data) ? data : []);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (newState) loadLandingPages();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <LinkIcon size={20} className="text-blue-600" />
          <span className="font-semibold text-gray-900">Посадочные страницы</span>
          {landingPages.length > 0 && (
            <span className="text-xs text-gray-400">{landingPages.length} страниц</span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp size={20} className="text-gray-400" />
        ) : (
          <ChevronDown size={20} className="text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-gray-200">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-blue-600" size={24} />
            </div>
          ) : landingPages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Нет данных</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Страница
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Клики
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Расход
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Конв.
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      CPL
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {landingPages.map((lp, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <a
                          href={lp.landingPage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate block max-w-xs"
                        >
                          {lp.landingPage?.replace(/^https?:\/\//, '').substring(0, 50)}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {lp.clicks?.toLocaleString() || 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                        {(lp.cost || 0).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {lp.conversions || 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {lp.conversions > 0 ? `${(lp.cpl || 0).toFixed(0)} ₽` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
