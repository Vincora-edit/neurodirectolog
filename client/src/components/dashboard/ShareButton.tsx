import { useState, useEffect } from 'react';
import { Share2, Copy, Check, Trash2, ExternalLink, Plus, X } from 'lucide-react';
import { api } from '../../services/api';

interface PublicShare {
  id: string;
  name: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  url: string;
}

interface ShareButtonProps {
  connectionId: string;
}

export function ShareButton({ connectionId }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shares, setShares] = useState<PublicShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newShareName, setNewShareName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && connectionId) {
      loadShares();
    }
  }, [isOpen, connectionId]);

  const loadShares = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/public-shares/connection/${connectionId}`);
      setShares(response.data);
    } catch (error) {
      console.error('Error loading shares:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createShare = async () => {
    try {
      await api.post('/public-shares', {
        connectionId,
        name: newShareName || undefined,
        expiresInDays: expiresInDays || undefined,
      });
      setNewShareName('');
      setExpiresInDays(null);
      setIsCreating(false);
      loadShares();
    } catch (error: any) {
      console.error('Error creating share:', error);
      const message = error?.response?.data?.error || error?.message || 'Не удалось создать ссылку';
      alert(message);
    }
  };

  const toggleShare = async (id: string, isActive: boolean) => {
    try {
      await api.patch(`/public-shares/${id}`, { isActive: !isActive });
      loadShares();
    } catch (error) {
      console.error('Error toggling share:', error);
    }
  };

  const deleteShare = async (id: string) => {
    if (!confirm('Удалить публичную ссылку?')) return;
    try {
      await api.delete(`/public-shares/${id}`);
      loadShares();
    } catch (error) {
      console.error('Error deleting share:', error);
    }
  };

  const copyUrl = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Share2 size={16} />
        Поделиться
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Публичный доступ</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {shares.length === 0 && !isCreating ? (
                    <div className="text-center py-8">
                      <Share2 size={48} className="mx-auto text-gray-300 mb-4" />
                      <p className="text-gray-500 mb-4">Нет активных ссылок</p>
                      <button
                        onClick={() => setIsCreating(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus size={16} />
                        Создать ссылку
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {shares.map((share) => (
                        <div
                          key={share.id}
                          className={`p-4 rounded-lg border ${
                            share.isActive
                              ? 'border-green-200 bg-green-50'
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 truncate">
                                  {share.name}
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-xs rounded-full ${
                                    share.isActive
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-200 text-gray-600'
                                  }`}
                                >
                                  {share.isActive ? 'Активна' : 'Отключена'}
                                </span>
                              </div>
                              <div className="mt-1 text-sm text-gray-500">
                                Создана: {formatDate(share.createdAt)}
                                {share.expiresAt && (
                                  <> | Истекает: {formatDate(share.expiresAt)}</>
                                )}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="text"
                                  readOnly
                                  value={share.url}
                                  className="flex-1 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md text-gray-600"
                                />
                                <button
                                  onClick={() => copyUrl(share.url, share.id)}
                                  className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                                  title="Копировать"
                                >
                                  {copiedId === share.id ? (
                                    <Check size={16} className="text-green-600" />
                                  ) : (
                                    <Copy size={16} />
                                  )}
                                </button>
                                <a
                                  href={share.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                                  title="Открыть"
                                >
                                  <ExternalLink size={16} />
                                </a>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => toggleShare(share.id, share.isActive)}
                                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                  share.isActive
                                    ? 'text-orange-700 bg-orange-100 hover:bg-orange-200'
                                    : 'text-green-700 bg-green-100 hover:bg-green-200'
                                }`}
                              >
                                {share.isActive ? 'Отключить' : 'Включить'}
                              </button>
                              <button
                                onClick={() => deleteShare(share.id)}
                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                title="Удалить"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {!isCreating && (
                        <button
                          onClick={() => setIsCreating(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-blue-600 border-2 border-dashed border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <Plus size={16} />
                          Создать ещё ссылку
                        </button>
                      )}
                    </div>
                  )}

                  {isCreating && (
                    <div className="mt-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-3">Новая ссылка</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Название (опционально)
                          </label>
                          <input
                            type="text"
                            value={newShareName}
                            onChange={(e) => setNewShareName(e.target.value)}
                            placeholder="Например: Для клиента"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Срок действия
                          </label>
                          <select
                            value={expiresInDays || ''}
                            onChange={(e) =>
                              setExpiresInDays(e.target.value ? parseInt(e.target.value) : null)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Бессрочно</option>
                            <option value="7">7 дней</option>
                            <option value="30">30 дней</option>
                            <option value="90">90 дней</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={createShare}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Создать
                          </button>
                          <button
                            onClick={() => {
                              setIsCreating(false);
                              setNewShareName('');
                              setExpiresInDays(null);
                            }}
                            className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
