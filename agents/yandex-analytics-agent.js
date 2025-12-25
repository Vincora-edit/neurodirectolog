#!/usr/bin/env node
'use strict';

// ======== HEADER ========
// Yandex Analytics Agent - Analyzes Yandex.Direct campaign data
// Purpose: Identify performance issues, provide recommendations, generate insights
// Usage:
//   node yandex-analytics-agent.js "Analyze campaign performance for the last 7 days"
//   node yandex-analytics-agent.js "Find campaigns with high CPL" --yolo
//   node yandex-analytics-agent.js "Generate recommendations for campaign 123456" --yolo

const CONFIG = {
  logLevel: process.env.LOG_LEVEL || 'info',
  maxTurns: 10,
  toolTimeoutMs: 60_000,
  maxToolOutputChars: 8192,
  // Neurodirectolog server configuration
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  authToken: process.env.AUTH_TOKEN || '',
};

// ======== UTILITIES ========
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const readline = require('readline');

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const level = LOG_LEVELS[CONFIG.logLevel] ?? LOG_LEVELS.info;
const logger = {
  debug: (...a) => level <= 0 && console.error('[DEBUG]', ...a),
  info: (...a) => level <= 1 && console.log('[INFO]', ...a),
  warn: (...a) => level <= 2 && console.warn('[WARN]', ...a),
  error: (...a) => level <= 3 && console.error('[ERROR]', ...a),
};

class AppError extends Error {
  constructor(message, code = 'ERROR', exitCode = 2) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

function assertString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${name} must be a non-empty string`, 'VALIDATION');
  }
  return value.trim();
}

function loadDotEnvToProcess(cwd) {
  try {
    const envPath = path.join(cwd, '.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (e) {
    logger.warn('Failed to load .env:', e.message);
  }
}

function safePath(baseDir, targetPath) {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, String(targetPath || ''));
  const rel = path.relative(base, resolved);
  if (rel === '' || rel === '.') return resolved;
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new AppError(`Path escapes working directory: ${targetPath}`, 'SECURITY');
  }
  return resolved;
}

function truncate(text, maxChars = CONFIG.maxToolOutputChars) {
  const str = String(text || '');
  if (str.length > maxChars) {
    return str.slice(0, maxChars) + `\n...[truncated ${str.length - maxChars} chars]`;
  }
  return str;
}

function tryParseJSON(s) {
  try { return JSON.parse(s); } catch { }
  let out = '';
  let inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; out += ch; continue; }
      if (ch === '\\') { esc = true; out += ch; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      out += ch;
    } else {
      if (ch === '"') { inStr = true; out += ch; }
      else if (ch === "'") { out += '"'; }
      else if (ch === ',' && i + 1 < s.length) {
        let j = i + 1;
        while (j < s.length && /\s/.test(s[j])) j++;
        if (j < s.length && (s[j] === '}' || s[j] === ']')) continue;
        out += ch;
      } else { out += ch; }
    }
  }
  let relaxed = out.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
  try { return JSON.parse(relaxed); }
  catch (e) { throw new Error(`Invalid JSON: ${e.message}`); }
}

// ======== TOOL REGISTRY ========
const TOOL_DOCS = {
  help: 'Get tool documentation. args: {tool?}',
  list_projects: 'List all projects with Yandex.Direct connections. args: {}',
  get_project_stats: 'Get statistics for a specific project. args: {projectId, dateFrom?, dateTo?}',
  get_campaigns: 'Get list of campaigns for a project. args: {projectId}',
  get_campaign_performance: 'Get performance metrics for campaigns. args: {projectId, campaignIds?, dateFrom?, dateTo?}',
  get_ad_groups: 'Get ad groups for a campaign. args: {projectId, campaignId}',
  get_ad_group_performance: 'Get performance metrics for ad groups. args: {projectId, adGroupIds?, dateFrom?, dateTo?}',
  analyze_cpl: 'Analyze CPL (cost per lead) across campaigns. args: {projectId, threshold?}',
  analyze_conversion_rate: 'Analyze conversion rates. args: {projectId, threshold?}',
  get_budget_usage: 'Get budget usage statistics. args: {projectId}',
  generate_recommendations: 'Generate optimization recommendations. args: {projectId, focus?}',
  write_report: 'Write analysis report to file. args: {path, content}',
  read_file: 'Read a file from workspace. args: {path}',
  list_files: 'List files in directory. args: {path?}',
};

function toolListInline() {
  return Object.keys(ToolRegistry).join(', ');
}

function toolBullets() {
  return Object.keys(ToolRegistry)
    .map(n => `- **${n}** — ${TOOL_DOCS[n] || 'See help'}`)
    .join('\n');
}

// API helper for making authenticated requests
async function apiRequest(endpoint, options = {}) {
  const url = `${CONFIG.apiBaseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(CONFIG.authToken ? { 'Authorization': `Bearer ${CONFIG.authToken}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AppError(`API error ${res.status}: ${text.slice(0, 200)}`, 'API_ERROR');
  }

  return res.json();
}

const ToolRegistry = {
  async help(args, ctx) {
    const { tool } = args || {};
    const names = Object.keys(ToolRegistry).sort();
    if (!tool) {
      return [
        'Yandex Analytics Agent Tools:',
        names.join(', '),
        '',
        'Usage: <<tool:help {"tool":"TOOL_NAME"}>>',
      ].join('\n');
    }
    const fn = ToolRegistry[tool];
    if (!fn) return `Unknown tool: ${tool}\nAvailable: ${names.join(', ')}`;
    return `Tool: ${tool}\nDescription: ${TOOL_DOCS[tool] || 'No description'}\nUsage: <<tool:${tool} {}>>`;
  },

  // Project Management Tools
  async list_projects(args, ctx) {
    try {
      const projects = await apiRequest('/api/projects');
      if (!projects || projects.length === 0) {
        return 'No projects found with Yandex.Direct connections.';
      }
      const summary = projects.map(p => ({
        id: p.id,
        name: p.name,
        yandexConnections: p.yandexConnections?.length || 0,
        status: p.status || 'active',
      }));
      return JSON.stringify(summary, null, 2);
    } catch (e) {
      throw new AppError(`Failed to list projects: ${e.message}`, 'API_ERROR');
    }
  },

  async get_project_stats(args, ctx) {
    const { projectId, dateFrom, dateTo } = args || {};
    assertString(projectId, 'projectId');

    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    try {
      const stats = await apiRequest(`/api/yandex/stats/${projectId}?${params}`);
      return JSON.stringify(stats, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get project stats: ${e.message}`, 'API_ERROR');
    }
  },

  // Campaign Tools
  async get_campaigns(args, ctx) {
    const { projectId } = args || {};
    assertString(projectId, 'projectId');

    try {
      const data = await apiRequest(`/api/yandex/campaigns/${projectId}`);
      const campaigns = data.campaigns || data;
      if (!campaigns || campaigns.length === 0) {
        return 'No campaigns found for this project.';
      }
      const summary = campaigns.map(c => ({
        id: c.Id || c.id,
        name: c.Name || c.name,
        status: c.Status || c.status,
        type: c.Type || c.type,
      }));
      return JSON.stringify(summary, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get campaigns: ${e.message}`, 'API_ERROR');
    }
  },

  async get_campaign_performance(args, ctx) {
    const { projectId, campaignIds, dateFrom, dateTo } = args || {};
    assertString(projectId, 'projectId');

    const params = new URLSearchParams();
    if (campaignIds) params.append('campaignIds', Array.isArray(campaignIds) ? campaignIds.join(',') : campaignIds);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    try {
      const performance = await apiRequest(`/api/yandex/performance/${projectId}?${params}`);
      return JSON.stringify(performance, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get campaign performance: ${e.message}`, 'API_ERROR');
    }
  },

  // Ad Group Tools
  async get_ad_groups(args, ctx) {
    const { projectId, campaignId } = args || {};
    assertString(projectId, 'projectId');
    assertString(campaignId, 'campaignId');

    try {
      const data = await apiRequest(`/api/yandex/adgroups/${projectId}/${campaignId}`);
      return JSON.stringify(data, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get ad groups: ${e.message}`, 'API_ERROR');
    }
  },

  async get_ad_group_performance(args, ctx) {
    const { projectId, adGroupIds, dateFrom, dateTo } = args || {};
    assertString(projectId, 'projectId');

    const params = new URLSearchParams();
    if (adGroupIds) params.append('adGroupIds', Array.isArray(adGroupIds) ? adGroupIds.join(',') : adGroupIds);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    try {
      const performance = await apiRequest(`/api/yandex/adgroup-performance/${projectId}?${params}`);
      return JSON.stringify(performance, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get ad group performance: ${e.message}`, 'API_ERROR');
    }
  },

  // Analytics Tools
  async analyze_cpl(args, ctx) {
    const { projectId, threshold = 5000 } = args || {};
    assertString(projectId, 'projectId');

    try {
      const stats = await apiRequest(`/api/yandex/stats/${projectId}`);
      const campaigns = stats.campaigns || [];

      const analysis = {
        summary: {
          totalCampaigns: campaigns.length,
          averageCPL: 0,
          threshold: threshold,
        },
        highCPL: [],
        normalCPL: [],
        lowCPL: [],
      };

      let totalCPL = 0;
      let validCampaigns = 0;

      for (const c of campaigns) {
        const cpl = c.cpl || c.costPerLead || 0;
        if (cpl > 0) {
          totalCPL += cpl;
          validCampaigns++;

          const item = {
            id: c.id || c.campaignId,
            name: c.name || c.campaignName,
            cpl: Math.round(cpl),
            leads: c.leads || c.conversions || 0,
            cost: Math.round(c.cost || 0),
          };

          if (cpl > threshold * 1.5) {
            analysis.highCPL.push({ ...item, severity: 'critical' });
          } else if (cpl > threshold) {
            analysis.highCPL.push({ ...item, severity: 'warning' });
          } else if (cpl < threshold * 0.5) {
            analysis.lowCPL.push(item);
          } else {
            analysis.normalCPL.push(item);
          }
        }
      }

      analysis.summary.averageCPL = validCampaigns > 0 ? Math.round(totalCPL / validCampaigns) : 0;

      return JSON.stringify(analysis, null, 2);
    } catch (e) {
      throw new AppError(`Failed to analyze CPL: ${e.message}`, 'API_ERROR');
    }
  },

  async analyze_conversion_rate(args, ctx) {
    const { projectId, threshold = 2 } = args || {};
    assertString(projectId, 'projectId');

    try {
      const stats = await apiRequest(`/api/yandex/stats/${projectId}`);
      const campaigns = stats.campaigns || [];

      const analysis = {
        summary: {
          totalCampaigns: campaigns.length,
          averageConversionRate: 0,
          threshold: threshold,
        },
        lowConversion: [],
        normalConversion: [],
        highConversion: [],
      };

      let totalRate = 0;
      let validCampaigns = 0;

      for (const c of campaigns) {
        const clicks = c.clicks || 0;
        const conversions = c.leads || c.conversions || 0;
        const rate = clicks > 0 ? (conversions / clicks) * 100 : 0;

        if (clicks > 10) { // Only analyze campaigns with meaningful data
          totalRate += rate;
          validCampaigns++;

          const item = {
            id: c.id || c.campaignId,
            name: c.name || c.campaignName,
            conversionRate: rate.toFixed(2) + '%',
            clicks: clicks,
            conversions: conversions,
          };

          if (rate < threshold * 0.5) {
            analysis.lowConversion.push({ ...item, severity: 'critical' });
          } else if (rate < threshold) {
            analysis.lowConversion.push({ ...item, severity: 'warning' });
          } else if (rate > threshold * 2) {
            analysis.highConversion.push(item);
          } else {
            analysis.normalConversion.push(item);
          }
        }
      }

      analysis.summary.averageConversionRate = validCampaigns > 0
        ? (totalRate / validCampaigns).toFixed(2) + '%'
        : '0%';

      return JSON.stringify(analysis, null, 2);
    } catch (e) {
      throw new AppError(`Failed to analyze conversion rate: ${e.message}`, 'API_ERROR');
    }
  },

  async get_budget_usage(args, ctx) {
    const { projectId } = args || {};
    assertString(projectId, 'projectId');

    try {
      const stats = await apiRequest(`/api/yandex/stats/${projectId}`);
      const kpi = stats.kpi || {};

      const budgetAnalysis = {
        totalBudget: kpi.budget || 0,
        spent: stats.totalCost || 0,
        remaining: (kpi.budget || 0) - (stats.totalCost || 0),
        usagePercent: kpi.budget > 0 ? ((stats.totalCost / kpi.budget) * 100).toFixed(1) + '%' : 'N/A',
        daysRemaining: kpi.daysRemaining || 0,
        dailyAverage: stats.dailyAverage || 0,
        projectedOverspend: false,
      };

      if (budgetAnalysis.daysRemaining > 0 && budgetAnalysis.dailyAverage > 0) {
        const projectedSpend = stats.totalCost + (budgetAnalysis.dailyAverage * budgetAnalysis.daysRemaining);
        budgetAnalysis.projectedSpend = Math.round(projectedSpend);
        budgetAnalysis.projectedOverspend = projectedSpend > (kpi.budget || 0);
      }

      return JSON.stringify(budgetAnalysis, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get budget usage: ${e.message}`, 'API_ERROR');
    }
  },

  async generate_recommendations(args, ctx) {
    const { projectId, focus } = args || {};
    assertString(projectId, 'projectId');

    try {
      const stats = await apiRequest(`/api/yandex/stats/${projectId}`);
      const recommendations = [];

      const campaigns = stats.campaigns || [];
      const kpi = stats.kpi || {};

      // Analyze CPL issues
      for (const c of campaigns) {
        const cpl = c.cpl || c.costPerLead || 0;
        const targetCpl = kpi.targetCpl || 2000;

        if (cpl > targetCpl * 1.5) {
          recommendations.push({
            type: 'cpl_critical',
            priority: 'high',
            campaign: c.name || c.campaignName,
            message: `CPL (${Math.round(cpl)}₽) превышает целевой (${targetCpl}₽) более чем на 50%. Рекомендуется немедленный анализ и оптимизация.`,
            actions: [
              'Проверить качество ключевых слов',
              'Анализировать конверсию посадочной страницы',
              'Рассмотреть корректировку ставок',
            ],
          });
        } else if (cpl > targetCpl) {
          recommendations.push({
            type: 'cpl_warning',
            priority: 'medium',
            campaign: c.name || c.campaignName,
            message: `CPL (${Math.round(cpl)}₽) превышает целевой (${targetCpl}₽). Требуется внимание.`,
            actions: [
              'Оптимизировать минус-слова',
              'Проверить время показа объявлений',
            ],
          });
        }

        // Check conversion rate
        const clicks = c.clicks || 0;
        const conversions = c.leads || c.conversions || 0;
        const rate = clicks > 0 ? (conversions / clicks) * 100 : 0;

        if (clicks > 50 && rate < 1) {
          recommendations.push({
            type: 'conversion_low',
            priority: 'high',
            campaign: c.name || c.campaignName,
            message: `Низкая конверсия (${rate.toFixed(2)}%) при ${clicks} кликах.`,
            actions: [
              'Проверить релевантность объявлений',
              'Улучшить посадочную страницу',
              'Проверить целевую аудиторию',
            ],
          });
        }

        // Check CTR
        const impressions = c.impressions || 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

        if (impressions > 1000 && ctr < 1) {
          recommendations.push({
            type: 'ctr_low',
            priority: 'medium',
            campaign: c.name || c.campaignName,
            message: `Низкий CTR (${ctr.toFixed(2)}%) при ${impressions} показах.`,
            actions: [
              'Улучшить тексты объявлений',
              'Добавить расширения',
              'Проверить ключевые слова',
            ],
          });
        }
      }

      // Budget recommendations
      const totalCost = stats.totalCost || 0;
      const budget = kpi.budget || 0;

      if (budget > 0 && totalCost > budget * 0.9) {
        recommendations.push({
          type: 'budget_warning',
          priority: 'high',
          message: `Израсходовано более 90% бюджета (${Math.round(totalCost)}₽ из ${budget}₽).`,
          actions: [
            'Проверить расход за оставшийся период',
            'Рассмотреть корректировку бюджета',
          ],
        });
      }

      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      return JSON.stringify({
        totalRecommendations: recommendations.length,
        byPriority: {
          high: recommendations.filter(r => r.priority === 'high').length,
          medium: recommendations.filter(r => r.priority === 'medium').length,
          low: recommendations.filter(r => r.priority === 'low').length,
        },
        recommendations: recommendations,
      }, null, 2);
    } catch (e) {
      throw new AppError(`Failed to generate recommendations: ${e.message}`, 'API_ERROR');
    }
  },

  // File Tools
  async write_report(args, ctx) {
    const { path: p, content = '' } = args || {};
    assertString(p, 'path');
    const full = safePath(ctx.cwd, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    return `Report saved to ${p} (${Buffer.byteLength(content, 'utf8')} bytes)`;
  },

  async read_file(args, ctx) {
    const { path: p, max_bytes = 204800 } = args || {};
    assertString(p, 'path');
    const full = safePath(ctx.cwd, p);
    let data = fs.readFileSync(full, 'utf8');
    if (typeof max_bytes === 'number' && max_bytes > 0) {
      data = data.slice(0, max_bytes);
    }
    return truncate(data);
  },

  async list_files(args, ctx) {
    const { path: p = '.' } = args || {};
    const dir = safePath(ctx.cwd, p);
    const names = fs.readdirSync(dir, { withFileTypes: true })
      .map(d => (d.isDirectory() ? d.name + '/' : d.name));
    return JSON.stringify(names, null, 2);
  },
};

// ======== AGENT CONFIGURATION ========
const AGENT_INSTRUCTION = `
You are a Yandex.Direct Analytics Agent specialized in analyzing advertising campaign performance data.

Your expertise:
- Analyzing CPL (Cost Per Lead) metrics and identifying optimization opportunities
- Evaluating conversion rates and CTR across campaigns and ad groups
- Budget analysis and spending optimization
- Generating actionable recommendations for campaign improvement

Your approach:
1. First, list available projects to understand the data scope
2. Gather statistics and performance data for the specified project
3. Analyze key metrics: CPL, conversion rate, CTR, budget usage
4. Identify campaigns/ad groups with performance issues
5. Generate specific, actionable recommendations
6. Create a structured report with findings

Output format:
- Markdown reports with clear sections
- JSON data for detailed metrics
- Save reports to ./reports/ directory with descriptive names
- Use Russian language for recommendations (as the target audience is Russian-speaking)

Focus on:
- Identifying campaigns with CPL above target
- Finding low-converting ad groups that waste budget
- Detecting budget pacing issues
- Providing specific optimization actions

IMPORTANT: When analyzing, always check if the API is accessible. If not, provide guidance on configuration.
`;

const TOOL_INSTRUCTIONS = `
When you need to use a tool, emit the exact syntax:
<<tool:tool_name {"parameter": "value"}>>

Available tools: ${toolListInline()}

Quick reference:
${toolBullets()}

Remember:
- Use strict JSON in tool calls (no trailing commas, quoted keys)
- Start by listing projects to understand available data
- Analyze multiple metrics for comprehensive insights
- Always provide specific, actionable recommendations
- Save reports to files for reference
`;

const FULL_INSTRUCTION = `${AGENT_INSTRUCTION.trim()}\n\n${TOOL_INSTRUCTIONS.trim()}`;

// ======== PROVIDERS ========
class OllamaProvider {
  constructor({ model = 'mistral-small', host = process.env.OLLAMA_HOST || 'http://localhost:11434' }) {
    this.model = model;
    this.host = host.replace(/\/$/, '');
  }

  async complete({ messages, signal }) {
    try {
      const res = await fetch(`${this.host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, stream: false }),
        signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { content: data.message?.content || '', done: data.done };
    } catch (e) {
      throw new AppError(`Ollama error: ${e.message}`, 'PROVIDER');
    }
  }
}

class OpenAIProvider {
  constructor({ model = 'gpt-4o-mini', apiKey, baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com' }) {
    this.model = model;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }
  async complete({ messages, signal }) {
    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, messages, stream: false }),
        signal,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      const data = JSON.parse(text);
      const content = data.choices?.[0]?.message?.content ?? '';
      const finish = data.choices?.[0]?.finish_reason ?? 'stop';
      return { content, done: finish !== 'length' };
    } catch (e) {
      throw new AppError(`OpenAI error: ${e.message}`, 'PROVIDER');
    }
  }
}

class AnthropicProvider {
  constructor({
    model = 'claude-sonnet-4-5-20250929',
    apiKey,
    version = process.env.ANTHROPIC_VERSION || '2023-06-01',
    baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
  }) {
    this.model = model;
    this.apiKey = apiKey;
    this.version = version;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }
  async complete({ messages, signal }) {
    try {
      const system = messages.filter(m => m.role === 'system').map(m => String(m.content || '')).join('\n');
      const convo = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: [{ type: 'text', text: String(m.content || '') }]
        }));
      const body = { model: this.model, max_tokens: 2048, messages: convo };
      if (system) body.system = system;

      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.version
        },
        body: JSON.stringify(body),
        signal
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      const data = JSON.parse(text);
      const parts = data.content || [];
      const firstText = parts.find(p => p && (p.text || p.type === 'text'))?.text ?? '';
      return { content: firstText, done: true };
    } catch (e) {
      throw new AppError(`Anthropic error: ${e.message}`, 'PROVIDER');
    }
  }
}

function inferProviderFromModel(model) {
  const s = (model || '').toLowerCase();
  if (!s) return '';
  if (/^(gpt-[345]|o[1-9])/.test(s)) return 'openai';
  if (s.startsWith('claude') || s.includes('sonnet') || s.includes('haiku') || s.includes('opus')) return 'anthropic';
  return '';
}

async function createProvider({ modelSpec, providerHint = '', keys = {}, cwd = process.cwd() }) {
  let provider = (providerHint || '').toLowerCase();
  let model = modelSpec || '';

  if (!provider) provider = inferProviderFromModel(model) || 'ollama';
  if (!model) {
    if (provider === 'ollama') model = 'mistral-small';
    if (provider === 'openai') model = 'gpt-4o-mini';
    if (provider === 'anthropic') model = 'claude-sonnet-4-5-20250929';
  }

  switch (provider) {
    case 'openai': {
      const apiKey = keys.openaiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) throw new AppError('OPENAI_API_KEY required', 'CONFIG');
      return new OpenAIProvider({ model, apiKey });
    }
    case 'anthropic': {
      const apiKey = keys.anthropicKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new AppError('ANTHROPIC_API_KEY required', 'CONFIG');
      return new AnthropicProvider({ model, apiKey });
    }
    case 'ollama':
    default:
      return new OllamaProvider({ model: model || undefined });
  }
}

// ======== RUNTIME ENGINE ========
function parseToolCalls(text) {
  const calls = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('<<tool:', i);
    if (start === -1) break;
    const nameStart = start + '<<tool:'.length;
    let nameEnd = nameStart;
    while (nameEnd < text.length && /\w/.test(text[nameEnd])) nameEnd++;
    const name = text.slice(nameStart, nameEnd);
    let j = nameEnd;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] !== '{') { i = nameEnd; continue; }
    let depth = 0, k = j, inStr = false, esc = false;
    for (; k < text.length; k++) {
      const ch = text[k];
      if (inStr) {
        if (esc) { esc = false; }
        else if (ch === '\\') { esc = true; }
        else if (ch === '"') { inStr = false; }
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { k++; break; }
      }
    }
    const jsonStr = text.slice(j, k);
    const close = text.indexOf('>>', k);
    if (close === -1) { i = k; continue; }
    try {
      calls.push({ name, args: tryParseJSON(jsonStr) });
    } catch (e) {
      logger.warn(`Failed to parse tool call for ${name}: ${e.message}`);
    }
    i = close + 2;
  }
  return calls;
}

async function executeTools(calls, ctx) {
  const results = [];
  for (const call of calls) {
    const tool = ToolRegistry[call.name];
    if (!tool) {
      results.push({ name: call.name, error: `Unknown tool: ${call.name}` });
      continue;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.toolTimeoutMs);
    try {
      const output = await tool(call.args, { ...ctx, signal: controller.signal });
      results.push({ name: call.name, output: truncate(output) });
    } catch (e) {
      results.push({ name: call.name, error: e.message || 'Tool execution failed', args: call.args });
    } finally {
      clearTimeout(timeout);
    }
  }
  return results;
}

async function runAgent({ task, model, provider: providerHint, openaiKey, anthropicKey, yolo = false, cwd = process.cwd() }) {
  const provider = await createProvider({
    modelSpec: model,
    providerHint,
    keys: { openaiKey, anthropicKey },
    cwd,
  });
  logger.info(`Provider: ${provider.constructor.name}, Model: ${provider.model || '(default)'}`);

  const messages = [
    { role: 'system', content: FULL_INSTRUCTION },
    { role: 'user', content: task }
  ];

  for (let turn = 0; turn < CONFIG.maxTurns; turn++) {
    logger.debug(`Turn ${turn + 1}/${CONFIG.maxTurns}`);
    const { content, done } = await provider.complete({ messages });
    logger.debug(`Response length: ${content?.length || 0} chars`);
    messages.push({ role: 'assistant', content });

    if (!content?.trim()) continue;

    const toolCalls = parseToolCalls(content);

    if (toolCalls.length > 0) {
      logger.info(`Found ${toolCalls.length} tool call(s)`);
      if (!yolo) {
        console.log('\n=== Tool Calls Detected ===');
        toolCalls.forEach(c => console.log(`- ${c.name}: ${JSON.stringify(c.args)}`));
        console.log('\nRun with --yolo to execute automatically');
        return content;
      }
      const results = await executeTools(toolCalls, { cwd });
      const toolOutput = results.map(r =>
        r.error ? `> ${r.name}: ERROR: ${r.error}` : `> ${r.name}: ${r.output}`
      ).join('\n');
      messages.push({ role: 'user', content: `[TOOL OUTPUT]\n${toolOutput}` });
      continue;
    }

    if (done || /<<done>>/i.test(content) || turn === CONFIG.maxTurns - 1) {
      return content;
    }
  }

  throw new AppError('Max turns reached without completion');
}

// ======== CLI INTERFACE ========
function parseArgs(argv) {
  const args = {
    task: '', model: '', provider: '', yolo: false, cwd: process.cwd(),
    openaiKey: '', anthropicKey: '', maxTurns: 0
  };
  const positional = [];

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--model' || arg === '-m') { args.model = argv[++i]; }
    else if (arg === '--provider' || arg === '-p') { args.provider = argv[++i]; }
    else if (arg === '--cwd') { args.cwd = argv[++i]; }
    else if (arg === '--yolo' || arg === '-y') { args.yolo = true; }
    else if (arg === '--max-turns') { args.maxTurns = parseInt(argv[++i] || '10', 10); }
    else if (arg === '--api-url') { CONFIG.apiBaseUrl = argv[++i]; }
    else if (arg === '--auth-token') { CONFIG.authToken = argv[++i]; }
    else if (arg === '--openai-key') { args.openaiKey = argv[++i]; }
    else if (arg === '--anthropic-key') { args.anthropicKey = argv[++i]; }
    else if (!arg.startsWith('-')) { positional.push(arg); }
  }

  args.task = positional.join(' ').trim();
  return args;
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    loadDotEnvToProcess(args.cwd);

    // Also load from parent directory (project root)
    loadDotEnvToProcess(path.join(args.cwd, '..'));

    if (!args.task) {
      console.log(`
Yandex Analytics Agent - Campaign Performance Analyzer

Usage:
  node yandex-analytics-agent.js "Your analysis task"
  node yandex-analytics-agent.js "Analyze CPL for all campaigns" --yolo
  node yandex-analytics-agent.js "Generate recommendations" --yolo --api-url http://localhost:3001

Options:
  --yolo, -y          Auto-execute tools without confirmation
  --model, -m         Choose AI model (default: mistral-small)
  --provider, -p      Choose provider (ollama, openai, anthropic)
  --api-url           Neurodirectolog API URL (default: http://localhost:3001)
  --auth-token        Authentication token for API
  --cwd               Working directory for reports
  --max-turns         Maximum conversation turns (default: 10)

Environment Variables:
  API_BASE_URL        API base URL
  AUTH_TOKEN          API authentication token
  OLLAMA_HOST         Ollama server URL
  OPENAI_API_KEY      OpenAI API key
  ANTHROPIC_API_KEY   Anthropic API key

Examples:
  node yandex-analytics-agent.js "List all projects" --yolo
  node yandex-analytics-agent.js "Analyze CPL for project proj_123" --yolo
  node yandex-analytics-agent.js "Find campaigns with high CPL and generate recommendations" --yolo
  node yandex-analytics-agent.js "Create a full performance report for project proj_123" --yolo
`);
      process.exit(0);
    }

    logger.info(`Starting Yandex Analytics Agent`);
    logger.info(`Task: ${args.task}`);
    logger.info(`API URL: ${CONFIG.apiBaseUrl}`);

    if (args.maxTurns) CONFIG.maxTurns = Math.max(1, args.maxTurns);

    const result = await runAgent(args);

    console.log('\n=== Analysis Complete ===');
    console.log(result);
    console.log('=========================\n');

  } catch (error) {
    if (error instanceof AppError) {
      logger.error(`${error.code}: ${error.message}`);
      process.exit(error.exitCode);
    }
    logger.error('Unexpected error:', error.message);
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ToolRegistry, runAgent };
