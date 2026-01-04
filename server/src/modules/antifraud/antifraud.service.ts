/**
 * Antifraud Service
 * Управление антифрод-защитой для клиентов
 */

import { clickhouseService } from '../../services/clickhouse.service';
import { generateAntifraudScript, generateMinifiedScript, AntifraudConfig } from './antifraud.script';

export interface AntifraudSettings {
  connectionId: string;
  enabled: boolean;
  metrikaId: string;
  threshold: number;
  enableHoneypot: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const antifraudService = {
  /**
   * Get antifraud settings for a connection
   */
  async getSettings(connectionId: string): Promise<AntifraudSettings | null> {
    try {
      // First try to get from antifraud_settings table
      const rows = await clickhouseService.query(`
        SELECT *
        FROM antifraud_settings FINAL
        WHERE connection_id = '${connectionId}'
        LIMIT 1
      `);

      if (rows.length > 0) {
        return this.mapRowToSettings(rows[0]);
      }

      // If no settings, try to get Metrika ID from connection
      const connection = await clickhouseService.getConnectionById(connectionId);
      if (!connection) return null;

      // Return default settings with Metrika ID from connection
      let metrikaId = '';
      try {
        if (connection.conversionGoals) {
          // Try to extract counter ID from goals or other fields
          // For now, user will need to provide it manually
        }
      } catch (e) {
        // No metrika ID
      }

      return {
        connectionId,
        enabled: false,
        metrikaId,
        threshold: 5,
        enableHoneypot: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('[Antifraud] Failed to get settings:', error);
      return null;
    }
  },

  /**
   * Save antifraud settings
   */
  async saveSettings(settings: Partial<AntifraudSettings> & { connectionId: string }): Promise<boolean> {
    try {
      const existing = await this.getSettings(settings.connectionId);
      const merged = { ...existing, ...settings, updatedAt: new Date() };

      await clickhouseService.exec(`
        INSERT INTO antifraud_settings (
          connection_id, enabled, metrika_id, threshold, enable_honeypot, created_at, updated_at
        ) VALUES (
          '${merged.connectionId}',
          ${merged.enabled ? 1 : 0},
          '${merged.metrikaId || ''}',
          ${merged.threshold || 5},
          ${merged.enableHoneypot !== false ? 1 : 0},
          now(),
          now()
        )
      `);

      return true;
    } catch (error) {
      console.error('[Antifraud] Failed to save settings:', error);
      return false;
    }
  },

  /**
   * Enable antifraud for a connection
   */
  async enable(connectionId: string, metrikaId: string): Promise<boolean> {
    return this.saveSettings({
      connectionId,
      enabled: true,
      metrikaId,
    });
  },

  /**
   * Disable antifraud for a connection
   */
  async disable(connectionId: string): Promise<boolean> {
    return this.saveSettings({
      connectionId,
      enabled: false,
    });
  },

  /**
   * Generate antifraud script for a connection
   */
  async generateScript(connectionId: string, options?: {
    minified?: boolean;
    debug?: boolean;
  }): Promise<{ script: string; settings: AntifraudSettings } | null> {
    const settings = await this.getSettings(connectionId);
    if (!settings) {
      return null;
    }

    if (!settings.metrikaId) {
      throw new Error('Metrika ID is required. Please configure it in settings.');
    }

    const config: AntifraudConfig = {
      metrikaId: settings.metrikaId,
      threshold: settings.threshold,
      enableHoneypot: settings.enableHoneypot,
      debug: options?.debug || false,
    };

    const script = options?.minified
      ? generateMinifiedScript(config)
      : generateAntifraudScript(config);

    return { script, settings };
  },

  /**
   * Generate standalone script (without saving settings)
   * For quick testing or manual configuration
   */
  generateStandaloneScript(metrikaId: string, options?: {
    threshold?: number;
    enableHoneypot?: boolean;
    minified?: boolean;
    debug?: boolean;
  }): string {
    const config: AntifraudConfig = {
      metrikaId,
      threshold: options?.threshold || 5,
      enableHoneypot: options?.enableHoneypot !== false,
      debug: options?.debug || false,
    };

    return options?.minified
      ? generateMinifiedScript(config)
      : generateAntifraudScript(config);
  },

  /**
   * Get installation instructions
   */
  getInstallationInstructions(_metrikaId: string): string {
    return `
## Установка антифрод-скрипта

### Шаг 1: Добавьте скрипт на сайт

Вставьте сгенерированный код перед закрывающим тегом </body> на всех страницах сайта.

**Важно:** Скрипт должен загружаться ПОСЛЕ счётчика Яндекс.Метрики.

### Шаг 2: Создайте сегмент в Метрике

1. Откройте Яндекс.Метрику → Отчёты → Параметры посетителей
2. Найдите параметр "ndf_is_bot" со значением "true"
3. Нажмите "Сохранить как сегмент"
4. Назовите сегмент "Боты (Antifraud)"

### Шаг 3: Добавьте корректировку в Директе

1. Откройте Яндекс.Директ → Кампания → Корректировки ставок
2. Добавьте корректировку "По целевой аудитории"
3. Выберите созданный сегмент "Боты (Antifraud)"
4. Установите корректировку: **-100%**

### Проверка работы

- В консоли браузера (F12) должно появиться: [Antifraud] Initialized
- В Метрике → Параметры посетителей появятся данные через несколько часов
- Цель "ndf_bot_detected" будет срабатывать для ботов

### Параметры, передаваемые в Метрику

| Параметр | Описание |
|----------|----------|
| ndf_is_bot | true/false - является ли посетитель ботом |
| ndf_bot_score | Числовой скор подозрительности (0-20+) |
| ndf_checks | Какие проверки сработали |

### Цели

| Цель | Когда срабатывает |
|------|-------------------|
| ndf_bot_detected | Когда score >= ${5} (порог) |
`.trim();
  },

  // Helper: map database row to settings
  mapRowToSettings(row: any): AntifraudSettings {
    return {
      connectionId: row.connection_id,
      enabled: row.enabled === 1 || row.enabled === true,
      metrikaId: row.metrika_id || '',
      threshold: parseInt(row.threshold) || 5,
      enableHoneypot: row.enable_honeypot === 1 || row.enable_honeypot === true,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  },
};
