import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { campaignService } from '../services/api';
import { Download, Plus } from 'lucide-react';

export default function Campaign() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [campaignName, setCampaignName] = useState('');

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignService.list,
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Рекламные кампании</h1>
          <p className="mt-2 text-gray-600">
            Создавайте и управляйте рекламными кампаниями
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={20} />
          Создать кампанию
        </button>
      </div>

      {showCreateForm && (
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Новая кампания</h2>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название кампании
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Введите название кампании"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Создать
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {isLoading ? (
          <div className="text-center py-8 text-gray-600">Загрузка...</div>
        ) : campaigns && campaigns.length > 0 ? (
          <div className="space-y-4">
            {campaigns.map((campaign: any, index: number) => (
              <div
                key={index}
                className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
              >
                <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                <p className="text-sm text-gray-600 mt-1">Статус: {campaign.status}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">У вас пока нет кампаний</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Создать первую кампанию
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
