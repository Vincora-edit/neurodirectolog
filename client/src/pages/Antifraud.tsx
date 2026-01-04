import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Shield,
  Copy,
  Check,
  Download,
  Settings,
  AlertTriangle,
  Info,
  ExternalLink,
  Code,
  FileText,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface GenerateScriptOptions {
  metrikaId: string;
  threshold: number;
  enableHoneypot: boolean;
  enableCrmTracking: boolean;
  minified: boolean;
  debug: boolean;
}

interface GenerateScriptResponse {
  success: boolean;
  data: {
    script: string;
    instructions: string;
  };
}

const generateScript = async (options: GenerateScriptOptions): Promise<GenerateScriptResponse> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/antifraud/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });
  return response.json();
};

export default function Antifraud() {
  const [metrikaId, setMetrikaId] = useState('');
  const [threshold, setThreshold] = useState(5);
  const [enableHoneypot, setEnableHoneypot] = useState(true);
  const [enableCrmTracking, setEnableCrmTracking] = useState(true);
  const [minified, setMinified] = useState(true);
  const [debug, setDebug] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const generateMutation = useMutation({
    mutationFn: generateScript,
    onSuccess: (data) => {
      if (data.success && data.data?.script) {
        setGeneratedScript(data.data.script);
      }
    },
  });

  const handleGenerate = () => {
    if (!metrikaId.trim()) return;
    generateMutation.mutate({
      metrikaId: metrikaId.trim(),
      threshold,
      enableHoneypot,
      enableCrmTracking,
      minified,
      debug,
    });
  };

  const handleCopy = async () => {
    if (!generatedScript) return;
    await navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!generatedScript) return;
    const blob = new Blob([generatedScript], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `antifraud-${metrikaId}.js`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <Shield className="text-red-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Антифрод защита</h1>
            <p className="text-gray-600">Защита от скликивания и ботов</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Как это работает?</p>
            <p>
              Скрипт определяет ботов и скликивателей по техническим признакам (WebDriver,
              HeadlessChrome, canvas fingerprint и др.). Данные отправляются в Яндекс.Метрику,
              где вы создаёте сегмент и добавляете корректировку -100% в Директе.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings size={20} />
            Настройки скрипта
          </h2>

          <div className="space-y-4">
            {/* Metrika ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID счётчика Яндекс.Метрики *
              </label>
              <input
                type="text"
                value={metrikaId}
                onChange={(e) => setMetrikaId(e.target.value.replace(/\D/g, ''))}
                placeholder="12345678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Найдите ID в настройках счётчика Метрики
              </p>
            </div>

            {/* Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Порог срабатывания: {threshold}
              </label>
              <input
                type="range"
                min="3"
                max="10"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>3 (строже)</span>
                <span>10 (мягче)</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Чем ниже порог, тем больше посетителей будут помечены как боты
              </p>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={enableHoneypot}
                  onChange={(e) => setEnableHoneypot(e.target.checked)}
                  className="w-4 h-4 rounded text-primary-600"
                />
                <div>
                  <span className="text-sm font-medium">Honeypot-ловушки</span>
                  <p className="text-xs text-gray-500">
                    Скрытые поля в формах, которые заполняют только боты
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={enableCrmTracking}
                  onChange={(e) => setEnableCrmTracking(e.target.checked)}
                  className="w-4 h-4 rounded text-primary-600"
                />
                <div>
                  <span className="text-sm font-medium">Интеграция с CRM</span>
                  <p className="text-xs text-gray-500">
                    Добавляет скрытые поля для анализа заявок в CRM
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={minified}
                  onChange={(e) => setMinified(e.target.checked)}
                  className="w-4 h-4 rounded text-primary-600"
                />
                <div>
                  <span className="text-sm font-medium">Минифицировать</span>
                  <p className="text-xs text-gray-500">
                    Уменьшить размер скрипта (рекомендуется)
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={debug}
                  onChange={(e) => setDebug(e.target.checked)}
                  className="w-4 h-4 rounded text-primary-600"
                />
                <div>
                  <span className="text-sm font-medium">Режим отладки</span>
                  <p className="text-xs text-gray-500">
                    Выводит логи в консоль браузера (только для тестирования)
                  </p>
                </div>
              </label>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!metrikaId.trim() || generateMutation.isPending}
              className="w-full mt-4 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
            >
              {generateMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Генерация...
                </>
              ) : (
                <>
                  <Code size={18} />
                  Сгенерировать скрипт
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated script */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Code size={20} />
              Готовый скрипт
            </h2>
            {generatedScript && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  {copied ? 'Скопировано!' : 'Копировать'}
                </button>
                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Download size={14} />
                  Скачать
                </button>
              </div>
            )}
          </div>

          {generatedScript ? (
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs max-h-96 overflow-y-auto">
                <code>{generatedScript}</code>
              </pre>
            </div>
          ) : (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              <Code className="mx-auto text-gray-300 mb-3" size={40} />
              <p className="text-gray-500">
                Введите ID Метрики и нажмите "Сгенерировать"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-gray-600" />
            <span className="font-medium">Инструкция по установке</span>
          </div>
          <span className={`transform transition-transform ${showInstructions ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {showInstructions && (
          <div className="px-6 pb-6 space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-medium mb-2">Добавьте скрипт на сайт</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Вставьте сгенерированный код перед закрывающим тегом <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> на всех страницах сайта.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                  <AlertTriangle className="text-amber-600 flex-shrink-0" size={18} />
                  <p className="text-sm text-amber-800">
                    Важно: скрипт должен загружаться ПОСЛЕ счётчика Яндекс.Метрики
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-medium mb-2">Создайте сегмент в Метрике</h3>
                <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                  <li>Откройте Яндекс.Метрику → Отчёты → Параметры посетителей</li>
                  <li>Найдите параметр <code className="bg-gray-100 px-1 rounded">ndf_is_bot</code> со значением <code className="bg-gray-100 px-1 rounded">true</code></li>
                  <li>Нажмите "Сохранить как сегмент"</li>
                  <li>Назовите сегмент "Боты (Antifraud)"</li>
                </ol>
                <a
                  href="https://metrika.yandex.ru"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-2"
                >
                  Открыть Метрику
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-medium mb-2">Добавьте корректировку в Директе</h3>
                <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                  <li>Откройте Яндекс.Директ → Кампания → Корректировки ставок</li>
                  <li>Добавьте корректировку "По целевой аудитории"</li>
                  <li>Выберите созданный сегмент "Боты (Antifraud)"</li>
                  <li>Установите корректировку: <strong>-100%</strong></li>
                </ol>
                <a
                  href="https://direct.yandex.ru"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-2"
                >
                  Открыть Директ
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            {/* CRM tracking info */}
            {enableCrmTracking && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <h4 className="font-medium text-green-800 mb-2">Интеграция с CRM</h4>
                <p className="text-sm text-green-700 mb-2">
                  Скрипт автоматически добавляет скрытые поля во все формы:
                </p>
                <ul className="text-sm text-green-700 list-disc list-inside space-y-1">
                  <li><code className="bg-green-100 px-1 rounded">ndf_bot_score</code> — числовой скор (0 = чисто, 5+ = бот)</li>
                  <li><code className="bg-green-100 px-1 rounded">ndf_is_bot</code> — "yes" или "no"</li>
                  <li><code className="bg-green-100 px-1 rounded">ndf_checks</code> — какие проверки сработали</li>
                  <li><code className="bg-green-100 px-1 rounded">ndf_timestamp</code> — время отправки</li>
                </ul>
                <p className="text-sm text-green-700 mt-2">
                  Создайте фильтр в CRM по <code className="bg-green-100 px-1 rounded">ndf_is_bot = "yes"</code> чтобы отслеживать ботов.
                </p>
              </div>
            )}

            {/* Checks table */}
            <div className="mt-4">
              <h4 className="font-medium mb-2">Проверки и их веса</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left">Проверка</th>
                      <th className="px-3 py-2 text-center">Баллы</th>
                      <th className="px-3 py-2 text-left">Описание</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs">webdriver_detected</td>
                      <td className="px-3 py-2 text-center">+5</td>
                      <td className="px-3 py-2 text-gray-600">Selenium, Puppeteer, Playwright</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs">headless_chrome</td>
                      <td className="px-3 py-2 text-center">+5</td>
                      <td className="px-3 py-2 text-gray-600">HeadlessChrome в User-Agent</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs">phantomjs_detected</td>
                      <td className="px-3 py-2 text-center">+5</td>
                      <td className="px-3 py-2 text-gray-600">PhantomJS браузер</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs">canvas_empty</td>
                      <td className="px-3 py-2 text-center">+3</td>
                      <td className="px-3 py-2 text-gray-600">Пустой canvas fingerprint</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs">small_window</td>
                      <td className="px-3 py-2 text-center">+4</td>
                      <td className="px-3 py-2 text-gray-600">Окно меньше 300x100 px</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs">honeypot_filled</td>
                      <td className="px-3 py-2 text-center">+10</td>
                      <td className="px-3 py-2 text-gray-600">Заполнено скрытое поле</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Посетитель помечается как бот, если набирает {threshold}+ баллов
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
