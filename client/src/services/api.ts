import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
  token: string;
}

export const authService = {
  register: async (email: string, password: string, name: string) => {
    const { data } = await api.post<{ data: AuthResponse }>('/auth/register', {
      email,
      password,
      name,
    });
    return data.data;
  },

  login: async (email: string, password: string) => {
    const { data } = await api.post<{ data: AuthResponse }>('/auth/login', {
      email,
      password,
    });
    return data.data;
  },
};

export const semanticsService = {
  generate: async (businessDescription: string, niche: string, projectId?: string) => {
    const { data } = await api.post('/semantics/generate', {
      businessDescription,
      niche,
      projectId,
    });
    return data.data;
  },

  export: async (keywords: string[], format: 'xlsx' | 'csv' = 'xlsx') => {
    const { data } = await api.post('/semantics/export', {
      keywords,
      format,
    });
    return data.data;
  },
};

export const campaignService = {
  create: async (campaignData: any) => {
    const { data } = await api.post('/campaigns/create', { campaignData });
    return data.data;
  },

  list: async () => {
    const { data } = await api.get('/campaigns/list');
    return data.data;
  },

  export: async (campaignData: any, format: 'xlsx' | 'csv' = 'xlsx') => {
    const { data } = await api.post('/campaigns/export', {
      campaignData,
      format,
    });
    return data.data;
  },

  getStats: async (campaignId: number, dateFrom: string, dateTo: string) => {
    const { data } = await api.get(`/campaigns/stats/${campaignId}`, {
      params: { dateFrom, dateTo },
    });
    return data.data;
  },
};

export const creativesService = {
  generate: async (businessInfo: string, targetAudience: string) => {
    const { data } = await api.post('/creatives/generate', {
      businessInfo,
      targetAudience,
    });
    return data.data;
  },
};

export const adsService = {
  generateHeadlines: async (keywords: string[], businessInfo: string, projectId?: string) => {
    const { data } = await api.post('/ads/generate/headlines', {
      keywords,
      businessInfo,
      projectId,
    });
    return data.data;
  },

  generateTexts: async (keywords: string[], businessInfo: string, usp: string, projectId?: string) => {
    const { data } = await api.post('/ads/generate/texts', {
      keywords,
      businessInfo,
      usp,
      projectId,
    });
    return data.data;
  },

  create: async (adsData: any[]) => {
    const { data } = await api.post('/ads/create', { adsData });
    return data.data;
  },

  generateComplete: async (campaignType: 'search' | 'display', quantity: number, projectId: string) => {
    const { data } = await api.post('/ads/generate-complete', {
      campaignType,
      quantity,
      projectId,
    });
    return data.data;
  },
};

export const keywordsService = {
  analyze: async (keywords: string[], niche: string, businessDescription: string, projectId?: string) => {
    const { data } = await api.post('/keywords/analyze', {
      keywords,
      niche,
      businessDescription,
      projectId,
    });
    return data.data;
  },
};

export const strategyService = {
  generate: async (businessInfo: string, budget: number, goals: string) => {
    const { data } = await api.post('/strategy/generate', {
      businessInfo,
      budget,
      goals,
    });
    return data.data;
  },
};

export const minusWordsService = {
  generate: async (keywords: string[], niche: string) => {
    const { data } = await api.post('/minus-words/generate', {
      keywords,
      niche,
    });
    return data.data;
  },

  analyze: async (queries: any[], niche: string, businessInfo: string) => {
    const { data } = await api.post('/minus-words/analyze', {
      queries,
      niche,
      businessInfo,
    });
    return data.data;
  },

  export: async (minusWords: string[]) => {
    const { data } = await api.post('/minus-words/export', { minusWords });
    return data.data;
  },
};

export interface ProjectBrief {
  businessName: string;
  niche: string;
  businessDescription: string;
  website: string;
  geo: string;
  advantages: string[];
  budget: {
    total: number;
    period: 'день' | 'неделя' | 'месяц';
  };
  goals: string;
  desires: string;
  targetCPA?: number;
  schedule?: string;
  prohibitions?: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  brief: ProjectBrief;
  semantics?: any;
  creatives?: any;
  ads?: any;
  minusWords?: any;
  campaigns?: any;
  strategy?: any;
  createdAt: Date;
  updatedAt: Date;
}

export const projectsService = {
  create: async (name: string, brief: ProjectBrief) => {
    const { data } = await api.post('/projects/create', { name, brief });
    return data.data;
  },

  list: async () => {
    const { data } = await api.get('/projects/list');
    return data.data;
  },

  getById: async (projectId: string) => {
    const { data } = await api.get(`/projects/${projectId}`);
    return data.data;
  },

  update: async (projectId: string, updates: Partial<Project>) => {
    const { data } = await api.put(`/projects/${projectId}`, updates);
    return data.data;
  },

  delete: async (projectId: string) => {
    const { data} = await api.delete(`/projects/${projectId}`);
    return data.data;
  },

  getModuleData: async (projectId: string, module: string) => {
    const { data } = await api.get(`/projects/${projectId}/${module}`);
    return data.data;
  },
};

export const analyticsService = {
  analyzeCompetitors: async (
    niche: string,
    businessDescription: string,
    geo: string,
    projectId?: string
  ) => {
    const { data } = await api.post('/analytics/competitors', {
      niche,
      businessDescription,
      geo,
      projectId,
    });
    return data.data;
  },

  analyzeTargetAudience: async (
    niche: string,
    businessDescription: string,
    geo: string,
    projectId?: string
  ) => {
    const { data } = await api.post('/analytics/target-audience', {
      niche,
      businessDescription,
      geo,
      projectId,
    });
    return data.data;
  },

  analyzeLandingPage: async (
    website: string,
    niche: string,
    businessDescription: string,
    projectId?: string
  ) => {
    const { data } = await api.post('/analytics/landing-page', {
      website,
      niche,
      businessDescription,
      projectId,
    });
    return data.data;
  },

  generateMediaPlan: async (
    niche: string,
    businessDescription: string,
    budget: number,
    budgetPeriod: string,
    goals: string,
    geo: string,
    projectId?: string
  ) => {
    const { data } = await api.post('/analytics/media-plan', {
      niche,
      businessDescription,
      budget,
      budgetPeriod,
      goals,
      geo,
      projectId,
    });
    return data.data;
  },

  fullAnalysis: async (
    niche: string,
    businessDescription: string,
    website: string,
    budget: number,
    budgetPeriod: string,
    goals: string,
    geo: string,
    projectId?: string
  ) => {
    const { data } = await api.post('/analytics/full-analysis', {
      niche,
      businessDescription,
      website,
      budget,
      budgetPeriod,
      goals,
      geo,
      projectId,
    });
    return data.data;
  },
};
