/**
 * Модель проекта и брифа
 * Все данные о проекте хранятся здесь и используются всеми модулями
 *
 * МИГРАЦИЯ: теперь использует ClickHouse вместо JSON-файла
 */

import { clickhouseService } from '../services/clickhouse.service';

export interface ProjectBrief {
  // Основная информация
  businessName: string;
  niche: string;
  businessDescription: string;
  website: string; // сайт клиента
  geo: string; // география

  // Преимущества компании
  advantages: string[]; // преимущества конкретной компании

  // Бюджет, цели и желания
  budget: {
    total: number;
    period: 'день' | 'неделя' | 'месяц';
  };
  goals: string; // цели
  desires: string; // желания/хотелки клиента
  targetCPA?: number; // целевая цена конверсии

  // Дополнительная информация
  schedule?: string; // расписание показов
  prohibitions?: string; // что нельзя использовать в рекламе
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  brief: ProjectBrief;

  // Результаты работы модулей (сохраняются для переиспользования)
  semantics?: {
    keywords: string[];
    generatedAt: Date;
  };

  creatives?: {
    ideas: any[];
    generatedAt: Date;
  };

  ads?: {
    headlines: string[];
    texts: string[];
    generatedAt: Date;
  };

  completeAds?: {
    campaignType: 'search' | 'display';
    generatedAt: string;
    ads: Array<{
      adNumber: number;
      targetSegment: string;
      approach: string;
      headline: string;
      text: string;
      clarifications: string[];
      quickLinks: Array<{ title: string; description: string }>;
      images?: Array<{ concept: string; text: string; style: string }>;
    }>;
  };

  minusWords?: {
    words: string[];
    analysis?: any;
    generatedAt: Date;
  };

  keywordAnalysis?: {
    classified: Array<{
      keyword: string;
      category: 'trash' | 'review' | 'target';
      reason: string;
    }>;
    minusWords: string[];
    statistics: {
      total: number;
      trash: number;
      review: number;
      target: number;
    };
    recommendations: string;
    generatedAt: Date;
  };

  campaigns?: {
    structure: any;
    generatedAt: Date;
  };

  strategy?: {
    plan: any;
    generatedAt: Date;
  };

  analytics?: {
    competitorAdsAnalysis?: any; // анализ рекламы конкурентов (заглушка)
    competitorWebsitesAnalysis?: any; // анализ сайтов конкурентов (заглушка)
    targetAudienceAnalysis?: any; // анализ ЦА с таблицей сегментов
    landingPageAnalysis?: any; // анализ посадочной страницы клиента
    mediaPlan?: any; // медиаплан с прогнозом ROI
    generatedAt?: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Асинхронное хранилище проектов на ClickHouse
 * Обеспечивает масштабируемость и отказоустойчивость
 */
class ProjectStore {
  private generateId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async create(userId: string, name: string, brief: ProjectBrief): Promise<Project> {
    const project: Project = {
      id: this.generateId(),
      userId,
      name,
      brief,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await clickhouseService.createProject({
      id: project.id,
      userId: project.userId,
      name: project.name,
      brief: project.brief,
    });

    return project;
  }

  async getById(id: string): Promise<Project | undefined> {
    const project = await clickhouseService.getProjectById(id);
    return project || undefined;
  }

  async getByUserId(userId: string, isAdmin: boolean = false): Promise<Project[]> {
    return await clickhouseService.getProjectsByUserId(userId, isAdmin);
  }

  /**
   * Получить краткую информацию о проектах (без тяжелых данных модулей)
   * Используется для списка проектов, чтобы избежать передачи больших объемов данных
   */
  async getByUserIdLightweight(userId: string, isAdmin: boolean = false): Promise<Array<{
    id: string;
    userId: string;
    name: string;
    brief: ProjectBrief;
    hasSemantics: boolean;
    hasCreatives: boolean;
    hasAds: boolean;
    hasCompleteAds: boolean;
    hasMinusWords: boolean;
    hasKeywordAnalysis: boolean;
    hasCampaigns: boolean;
    hasStrategy: boolean;
    hasAnalytics: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    return await clickhouseService.getProjectsLightweight(userId, isAdmin);
  }

  async update(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const current = await this.getById(id);
    if (!current) return undefined;

    await clickhouseService.updateProject(id, updates);

    return {
      ...current,
      ...updates,
      updatedAt: new Date(),
    };
  }

  async delete(id: string): Promise<boolean> {
    try {
      await clickhouseService.deleteProject(id);
      return true;
    } catch {
      return false;
    }
  }

  // Методы для сохранения результатов модулей
  async saveSemantics(projectId: string, keywords: string[]): Promise<void> {
    await clickhouseService.saveProjectSemantics(projectId, keywords);
  }

  async saveCreatives(projectId: string, ideas: any[]): Promise<void> {
    await clickhouseService.saveProjectCreatives(projectId, ideas);
  }

  async saveAds(projectId: string, headlines: string[], texts: string[]): Promise<void> {
    await clickhouseService.saveProjectAds(projectId, headlines, texts);
  }

  async saveMinusWords(projectId: string, words: string[], analysis?: any): Promise<void> {
    await clickhouseService.saveProjectMinusWords(projectId, words, analysis);
  }

  async saveCampaigns(projectId: string, structure: any): Promise<void> {
    await clickhouseService.saveProjectCampaigns(projectId, structure);
  }

  async saveStrategy(projectId: string, plan: any): Promise<void> {
    await clickhouseService.saveProjectStrategy(projectId, plan);
  }

  async saveAnalytics(projectId: string, analytics: any): Promise<void> {
    await clickhouseService.saveProjectAnalytics(projectId, analytics);
  }

  async saveCompleteAds(projectId: string, completeAds: any): Promise<void> {
    await clickhouseService.saveProjectCompleteAds(projectId, completeAds);
  }

  async saveKeywordAnalysis(projectId: string, analysis: any): Promise<void> {
    await clickhouseService.saveProjectKeywordAnalysis(projectId, analysis);
  }
}

export const projectStore = new ProjectStore();
