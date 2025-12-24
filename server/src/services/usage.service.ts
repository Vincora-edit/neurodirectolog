import fs from 'fs';
import path from 'path';

const USAGE_FILE = path.join(process.cwd(), 'data', 'usage.json');

export interface UsageRecord {
  date: string; // YYYY-MM-DD
  userId: string;
  aiRequests: number;       // Запросы к OpenAI/Claude
  aiTokensUsed: number;     // Токены (примерная оценка)
  yandexSyncs: number;      // Синхронизации Яндекс.Директ
  apiRequests: number;      // Общее кол-во API запросов
}

export interface UserUsageSummary {
  userId: string;
  userName: string;
  userEmail: string;
  totalAiRequests: number;
  totalAiTokens: number;
  totalYandexSyncs: number;
  totalApiRequests: number;
  estimatedCostRub: number;
  lastActivityDate: string;
  dailyBreakdown: UsageRecord[];
}

// Загрузка данных использования
function loadUsageData(): Record<string, UsageRecord[]> {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      const data = fs.readFileSync(USAGE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading usage data:', error);
  }
  return {};
}

// Сохранение данных использования
function saveUsageData(data: Record<string, UsageRecord[]>): void {
  try {
    const dir = path.dirname(USAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving usage data:', error);
  }
}

// Получить текущую дату в формате YYYY-MM-DD
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

// Получить или создать запись на сегодня
function getOrCreateTodayRecord(userId: string): UsageRecord {
  const data = loadUsageData();
  const today = getToday();

  if (!data[userId]) {
    data[userId] = [];
  }

  let todayRecord = data[userId].find(r => r.date === today);
  if (!todayRecord) {
    todayRecord = {
      date: today,
      userId,
      aiRequests: 0,
      aiTokensUsed: 0,
      yandexSyncs: 0,
      apiRequests: 0,
    };
    data[userId].push(todayRecord);
    saveUsageData(data);
  }

  return todayRecord;
}

// Инкремент использования
function incrementUsage(
  userId: string,
  field: 'aiRequests' | 'aiTokensUsed' | 'yandexSyncs' | 'apiRequests',
  amount: number = 1
): void {
  const data = loadUsageData();
  const today = getToday();

  if (!data[userId]) {
    data[userId] = [];
  }

  let todayRecord = data[userId].find(r => r.date === today);
  if (!todayRecord) {
    todayRecord = {
      date: today,
      userId,
      aiRequests: 0,
      aiTokensUsed: 0,
      yandexSyncs: 0,
      apiRequests: 0,
    };
    data[userId].push(todayRecord);
  }

  todayRecord[field] += amount;
  saveUsageData(data);
}

export const usageService = {
  // Трекинг AI запроса
  trackAiRequest(userId: string, estimatedTokens: number = 1000): void {
    incrementUsage(userId, 'aiRequests', 1);
    incrementUsage(userId, 'aiTokensUsed', estimatedTokens);
  },

  // Трекинг синхронизации Яндекс
  trackYandexSync(userId: string): void {
    incrementUsage(userId, 'yandexSyncs', 1);
  },

  // Трекинг общего API запроса
  trackApiRequest(userId: string): void {
    incrementUsage(userId, 'apiRequests', 1);
  },

  // Получить использование по пользователю
  getUserUsage(userId: string, days: number = 30): UsageRecord[] {
    const data = loadUsageData();
    const records = data[userId] || [];

    // Фильтруем по последним N дней
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    return records.filter(r => r.date >= cutoffStr).sort((a, b) => b.date.localeCompare(a.date));
  },

  // Получить суммарное использование по всем пользователям
  getAllUsersUsage(users: Array<{ id: string; name: string; email: string }>, days: number = 30): UserUsageSummary[] {
    const data = loadUsageData();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    return users.map(user => {
      const records = (data[user.id] || []).filter(r => r.date >= cutoffStr);

      const totalAiRequests = records.reduce((sum, r) => sum + r.aiRequests, 0);
      const totalAiTokens = records.reduce((sum, r) => sum + r.aiTokensUsed, 0);
      const totalYandexSyncs = records.reduce((sum, r) => sum + r.yandexSyncs, 0);
      const totalApiRequests = records.reduce((sum, r) => sum + r.apiRequests, 0);

      // Расчёт стоимости (примерно):
      // - GPT-4: ~$0.03/1K токенов ввода, ~$0.06/1K токенов вывода
      // - Среднее: ~$0.05/1K токенов = 5 руб за 1K токенов (при курсе 100)
      const aiCostRub = (totalAiTokens / 1000) * 5;
      // Яндекс API - условно бесплатно, но учитываем нагрузку на сервер
      const syncCostRub = totalYandexSyncs * 0.5; // 0.5 руб за синк (условно)

      const estimatedCostRub = Math.round((aiCostRub + syncCostRub) * 100) / 100;

      const lastActivityDate = records.length > 0
        ? records.sort((a, b) => b.date.localeCompare(a.date))[0].date
        : 'Нет активности';

      return {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        totalAiRequests,
        totalAiTokens,
        totalYandexSyncs,
        totalApiRequests,
        estimatedCostRub,
        lastActivityDate,
        dailyBreakdown: records.sort((a, b) => b.date.localeCompare(a.date)),
      };
    }).sort((a, b) => b.estimatedCostRub - a.estimatedCostRub);
  },

  // Общая статистика по системе
  getSystemUsageStats(days: number = 30): {
    totalAiRequests: number;
    totalAiTokens: number;
    totalYandexSyncs: number;
    totalApiRequests: number;
    estimatedTotalCostRub: number;
    activeUsers: number;
  } {
    const data = loadUsageData();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    let totalAiRequests = 0;
    let totalAiTokens = 0;
    let totalYandexSyncs = 0;
    let totalApiRequests = 0;
    const activeUserIds = new Set<string>();

    for (const [userId, records] of Object.entries(data)) {
      const filteredRecords = records.filter(r => r.date >= cutoffStr);

      if (filteredRecords.length > 0) {
        activeUserIds.add(userId);
      }

      for (const record of filteredRecords) {
        totalAiRequests += record.aiRequests;
        totalAiTokens += record.aiTokensUsed;
        totalYandexSyncs += record.yandexSyncs;
        totalApiRequests += record.apiRequests;
      }
    }

    const aiCostRub = (totalAiTokens / 1000) * 5;
    const syncCostRub = totalYandexSyncs * 0.5;
    const estimatedTotalCostRub = Math.round((aiCostRub + syncCostRub) * 100) / 100;

    return {
      totalAiRequests,
      totalAiTokens,
      totalYandexSyncs,
      totalApiRequests,
      estimatedTotalCostRub,
      activeUsers: activeUserIds.size,
    };
  },
};
