/**
 * Модель проекта и брифа
 * Все данные о проекте хранятся здесь и используются всеми модулями
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'projects.json');

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

// In-memory хранилище проектов с автосохранением в JSON
class ProjectStore {
  private projects: Map<string, Project> = new Map();

  constructor() {
    this.loadFromFile();
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        const projects = JSON.parse(data);
        this.projects = new Map(Object.entries(projects));
        console.log(`✅ Loaded ${this.projects.size} projects from storage`);
      } else {
        // Создаем директорию и файл если не существует
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        this.saveToFile();
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }

  private saveToFile(): void {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Object.fromEntries(this.projects);
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving projects:', error);
    }
  }

  create(userId: string, name: string, brief: ProjectBrief): Project {
    const project: Project = {
      id: this.generateId(),
      userId,
      name,
      brief,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.projects.set(project.id, project);
    this.saveToFile();
    return project;
  }

  getById(id: string): Project | undefined {
    return this.projects.get(id);
  }

  getByUserId(userId: string): Project[] {
    return Array.from(this.projects.values()).filter(p => p.userId === userId);
  }

  update(id: string, updates: Partial<Project>): Project | undefined {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updated = {
      ...project,
      ...updates,
      updatedAt: new Date(),
    };

    this.projects.set(id, updated);
    this.saveToFile();
    return updated;
  }

  delete(id: string): boolean {
    const result = this.projects.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // Методы для сохранения результатов модулей
  saveSemantics(projectId: string, keywords: string[]): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.semantics = {
      keywords,
      generatedAt: new Date(),
    };
    project.updatedAt = new Date();
    this.saveToFile();
  }

  saveCreatives(projectId: string, ideas: any[]): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.creatives = {
      ideas,
      generatedAt: new Date(),
    };
    project.updatedAt = new Date();
    this.saveToFile();
  }

  saveAds(projectId: string, headlines: string[], texts: string[]): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.ads = {
      headlines,
      texts,
      generatedAt: new Date(),
    };
    project.updatedAt = new Date();
    this.saveToFile();
  }

  saveMinusWords(projectId: string, words: string[], analysis?: any): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.minusWords = {
      words,
      analysis,
      generatedAt: new Date(),
    };
    project.updatedAt = new Date();
    this.saveToFile();
  }

  saveCampaigns(projectId: string, structure: any): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.campaigns = {
      structure,
      generatedAt: new Date(),
    };
    project.updatedAt = new Date();
    this.saveToFile();
  }

  saveStrategy(projectId: string, plan: any): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.strategy = {
      plan,
      generatedAt: new Date(),
    };
    project.updatedAt = new Date();
    this.saveToFile();
  }

  saveAnalytics(projectId: string, analytics: any): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.analytics = {
      ...analytics,
      generatedAt: new Date(),
    };
    project.updatedAt = new Date();
    this.saveToFile();
  }

  saveCompleteAds(projectId: string, completeAds: any): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.completeAds = completeAds;
    project.updatedAt = new Date();
    this.saveToFile();
  }

  saveKeywordAnalysis(projectId: string, analysis: any): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.keywordAnalysis = {
      ...analysis,
      generatedAt: new Date(),
    };
    project.updatedAt = new Date();
    this.saveToFile();
  }

  private generateId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const projectStore = new ProjectStore();
