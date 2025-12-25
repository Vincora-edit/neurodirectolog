#!/usr/bin/env node
'use strict';

// ======== HEADER ========
// Report Generator Agent - Create comprehensive reports from advertising data
// Purpose: Generate PDF/HTML reports with charts, tables, and insights
// Usage:
//   node report-generator-agent.js "Generate weekly report for project X"
//   node report-generator-agent.js "Create executive summary" --yolo
//   node report-generator-agent.js "Build monthly performance report" --yolo

const CONFIG = {
  logLevel: process.env.LOG_LEVEL || 'info',
  maxTurns: 15,
  toolTimeoutMs: 60_000,
  maxToolOutputChars: 8192,
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  authToken: process.env.AUTH_TOKEN || '',
  reportsDir: process.env.REPORTS_DIR || './reports',
};

// ======== UTILITIES ========
const fs = require('fs');
const path = require('path');

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
    return str.slice(0, maxChars) + `\n...[truncated]`;
  }
  return str;
}

function tryParseJSON(s) {
  try { return JSON.parse(s); } catch { }
  let out = '', inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; out += ch; continue; }
      if (ch === '\\') { esc = true; out += ch; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      out += ch;
    } else {
      if (ch === '"') { inStr = true; out += ch; }
      else if (ch === "'") out += '"';
      else if (ch === ',' && i + 1 < s.length) {
        let j = i + 1;
        while (j < s.length && /\s/.test(s[j])) j++;
        if (j < s.length && (s[j] === '}' || s[j] === ']')) continue;
        out += ch;
      } else out += ch;
    }
  }
  try { return JSON.parse(out.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')); }
  catch (e) { throw new Error(`Invalid JSON: ${e.message}`); }
}

// API helper
async function apiRequest(endpoint, options = {}) {
  const url = `${CONFIG.apiBaseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(CONFIG.authToken ? { 'Authorization': `Bearer ${CONFIG.authToken}` } : {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new AppError(`API error ${res.status}: ${text.slice(0, 200)}`, 'API_ERROR');
  }
  return res.json();
}

// Format helpers
function formatCurrency(value, currency = '₽') {
  return Math.round(value).toLocaleString('ru-RU') + ' ' + currency;
}

function formatPercent(value) {
  return value.toFixed(1) + '%';
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('ru-RU');
}

// ======== TOOL REGISTRY ========
const TOOL_DOCS = {
  help: 'Get tool documentation. args: {tool?}',
  list_projects: 'List all available projects. args: {}',
  get_project_data: 'Get all data for a project. args: {projectId, dateFrom?, dateTo?}',
  get_campaign_stats: 'Get campaign statistics. args: {projectId, dateFrom?, dateTo?}',
  get_daily_stats: 'Get daily statistics. args: {projectId, dateFrom, dateTo}',
  get_kpi_data: 'Get KPI metrics. args: {projectId}',
  get_conversion_data: 'Get conversion data. args: {projectId, dateFrom?, dateTo?}',
  calculate_metrics: 'Calculate derived metrics. args: {data}',
  generate_summary: 'Generate executive summary. args: {projectId, period}',
  create_comparison: 'Compare two periods. args: {projectId, period1, period2}',
  build_table: 'Build markdown table from data. args: {headers, rows}',
  build_chart_data: 'Prepare data for charts. args: {type, data}',
  write_report: 'Write report file. args: {filename, content, format?}',
  list_reports: 'List existing reports. args: {path?}',
  read_template: 'Read report template. args: {name}',
  read_file: 'Read any file. args: {path}',
};

function toolListInline() {
  return Object.keys(ToolRegistry).join(', ');
}

function toolBullets() {
  return Object.keys(ToolRegistry)
    .map(n => `- **${n}** — ${TOOL_DOCS[n] || 'See help'}`)
    .join('\n');
}

const ToolRegistry = {
  async help(args) {
    const { tool } = args || {};
    const names = Object.keys(ToolRegistry).sort();
    if (!tool) return ['Report Generator Tools:', names.join(', ')].join('\n');
    return `Tool: ${tool}\nDescription: ${TOOL_DOCS[tool] || 'No description'}`;
  },

  // Data Fetching
  async list_projects() {
    try {
      const projects = await apiRequest('/api/projects');
      return JSON.stringify(projects.map(p => ({
        id: p.id,
        name: p.name,
        accounts: p.yandexConnections?.length || 0,
      })), null, 2);
    } catch (e) {
      throw new AppError(`Failed to list projects: ${e.message}`);
    }
  },

  async get_project_data(args) {
    const { projectId, dateFrom, dateTo } = args || {};
    assertString(projectId, 'projectId');

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      const params = new URLSearchParams({
        dateFrom: dateFrom || weekAgo,
        dateTo: dateTo || today,
      });

      const stats = await apiRequest(`/api/yandex/stats/${projectId}?${params}`);
      return JSON.stringify({
        projectId,
        period: { from: dateFrom || weekAgo, to: dateTo || today },
        summary: {
          totalCost: stats.totalCost || 0,
          totalClicks: stats.totalClicks || 0,
          totalImpressions: stats.totalImpressions || 0,
          totalConversions: stats.totalConversions || 0,
          averageCTR: stats.averageCTR || 0,
          averageCPC: stats.averageCPC || 0,
          averageCPL: stats.averageCPL || 0,
        },
        campaigns: (stats.campaigns || []).slice(0, 20),
        kpi: stats.kpi || {},
      }, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get project data: ${e.message}`);
    }
  },

  async get_campaign_stats(args) {
    const { projectId, dateFrom, dateTo } = args || {};
    assertString(projectId, 'projectId');

    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const data = await apiRequest(`/api/yandex/campaigns/${projectId}/stats?${params}`);
      return JSON.stringify(data, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get campaign stats: ${e.message}`);
    }
  },

  async get_daily_stats(args) {
    const { projectId, dateFrom, dateTo } = args || {};
    assertString(projectId, 'projectId');
    assertString(dateFrom, 'dateFrom');
    assertString(dateTo, 'dateTo');

    try {
      const data = await apiRequest(`/api/yandex/daily/${projectId}?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      return JSON.stringify(data, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get daily stats: ${e.message}`);
    }
  },

  async get_kpi_data(args) {
    const { projectId } = args || {};
    assertString(projectId, 'projectId');

    try {
      const data = await apiRequest(`/api/kpi/${projectId}`);
      return JSON.stringify({
        targetCPL: data.targetCpl || 0,
        targetLeads: data.targetLeads || 0,
        targetBudget: data.budget || 0,
        currentCPL: data.currentCpl || 0,
        currentLeads: data.currentLeads || 0,
        spentBudget: data.spent || 0,
        performance: {
          cplVsTarget: data.targetCpl > 0
            ? ((data.currentCpl - data.targetCpl) / data.targetCpl * 100).toFixed(1) + '%'
            : 'N/A',
          leadsProgress: data.targetLeads > 0
            ? ((data.currentLeads / data.targetLeads) * 100).toFixed(1) + '%'
            : 'N/A',
          budgetUsage: data.budget > 0
            ? ((data.spent / data.budget) * 100).toFixed(1) + '%'
            : 'N/A',
        },
      }, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get KPI data: ${e.message}`);
    }
  },

  async get_conversion_data(args) {
    const { projectId, dateFrom, dateTo } = args || {};
    assertString(projectId, 'projectId');

    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const data = await apiRequest(`/api/conversions/${projectId}?${params}`);
      return JSON.stringify(data, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get conversion data: ${e.message}`);
    }
  },

  // Analysis Tools
  async calculate_metrics(args) {
    const { data } = args || {};
    if (!data) throw new AppError('data is required');

    const metrics = {
      ctr: data.impressions > 0 ? (data.clicks / data.impressions * 100) : 0,
      cpc: data.clicks > 0 ? (data.cost / data.clicks) : 0,
      cpl: data.conversions > 0 ? (data.cost / data.conversions) : 0,
      conversionRate: data.clicks > 0 ? (data.conversions / data.clicks * 100) : 0,
      costPerMille: data.impressions > 0 ? (data.cost / data.impressions * 1000) : 0,
    };

    return JSON.stringify({
      input: data,
      calculated: {
        ctr: formatPercent(metrics.ctr),
        cpc: formatCurrency(metrics.cpc),
        cpl: formatCurrency(metrics.cpl),
        conversionRate: formatPercent(metrics.conversionRate),
        cpm: formatCurrency(metrics.costPerMille),
      },
      raw: metrics,
    }, null, 2);
  },

  async generate_summary(args) {
    const { projectId, period = 'week' } = args || {};
    assertString(projectId, 'projectId');

    const periods = {
      day: 1,
      week: 7,
      month: 30,
      quarter: 90,
    };
    const days = periods[period] || 7;

    const dateTo = new Date().toISOString().split('T')[0];
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      const stats = await apiRequest(`/api/yandex/stats/${projectId}?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      const kpi = await apiRequest(`/api/kpi/${projectId}`).catch(() => ({}));

      const summary = {
        period: { from: dateFrom, to: dateTo, type: period },
        overview: {
          totalSpent: formatCurrency(stats.totalCost || 0),
          totalLeads: stats.totalConversions || 0,
          averageCPL: formatCurrency(stats.averageCPL || (stats.totalCost / (stats.totalConversions || 1))),
          totalClicks: stats.totalClicks || 0,
        },
        performance: {
          vsTarget: kpi.targetCpl
            ? `${((stats.averageCPL || 0) / kpi.targetCpl * 100 - 100).toFixed(0)}% от целевого CPL`
            : 'Цель не установлена',
          leadProgress: kpi.targetLeads
            ? `${((stats.totalConversions || 0) / kpi.targetLeads * 100).toFixed(0)}% от плана по лидам`
            : 'План не установлен',
        },
        topCampaigns: (stats.campaigns || [])
          .sort((a, b) => (b.conversions || 0) - (a.conversions || 0))
          .slice(0, 5)
          .map(c => ({
            name: c.name || c.campaignName,
            leads: c.conversions || c.leads || 0,
            cost: formatCurrency(c.cost || 0),
            cpl: formatCurrency(c.cpl || (c.cost / (c.conversions || 1))),
          })),
        recommendations: [],
      };

      // Generate recommendations
      if (stats.averageCPL > (kpi.targetCpl || 0) * 1.2) {
        summary.recommendations.push('⚠️ CPL превышает целевой более чем на 20%. Рекомендуется оптимизация кампаний.');
      }
      if ((stats.totalConversions || 0) < (kpi.targetLeads || 0) * 0.5) {
        summary.recommendations.push('📉 Выполнено менее 50% плана по лидам. Требуется увеличение активности.');
      }

      return JSON.stringify(summary, null, 2);
    } catch (e) {
      throw new AppError(`Failed to generate summary: ${e.message}`);
    }
  },

  async create_comparison(args) {
    const { projectId, period1, period2 } = args || {};
    assertString(projectId, 'projectId');

    // Parse periods like "2024-01-01:2024-01-07"
    const parsePeriod = (p) => {
      const [from, to] = (p || '').split(':');
      return { from, to };
    };

    const p1 = parsePeriod(period1);
    const p2 = parsePeriod(period2);

    try {
      const data1 = await apiRequest(`/api/yandex/stats/${projectId}?dateFrom=${p1.from}&dateTo=${p1.to}`);
      const data2 = await apiRequest(`/api/yandex/stats/${projectId}?dateFrom=${p2.from}&dateTo=${p2.to}`);

      const compare = (v1, v2) => {
        if (v2 === 0) return v1 > 0 ? '+∞' : '0%';
        const change = ((v1 - v2) / v2) * 100;
        return (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
      };

      return JSON.stringify({
        period1: { ...p1, data: { cost: data1.totalCost, leads: data1.totalConversions, cpl: data1.averageCPL } },
        period2: { ...p2, data: { cost: data2.totalCost, leads: data2.totalConversions, cpl: data2.averageCPL } },
        changes: {
          cost: compare(data1.totalCost || 0, data2.totalCost || 0),
          leads: compare(data1.totalConversions || 0, data2.totalConversions || 0),
          cpl: compare(data1.averageCPL || 0, data2.averageCPL || 0),
        },
      }, null, 2);
    } catch (e) {
      throw new AppError(`Failed to create comparison: ${e.message}`);
    }
  },

  // Report Building Tools
  async build_table(args) {
    const { headers, rows } = args || {};
    if (!headers || !rows) throw new AppError('headers and rows are required');

    const headerRow = '| ' + headers.join(' | ') + ' |';
    const separator = '|' + headers.map(() => '---').join('|') + '|';
    const dataRows = rows.map(row => '| ' + row.join(' | ') + ' |');

    return [headerRow, separator, ...dataRows].join('\n');
  },

  async build_chart_data(args) {
    const { type, data } = args || {};
    assertString(type, 'type');

    // Prepare data for common chart libraries
    const chartTypes = {
      line: { labels: [], datasets: [{ data: [] }] },
      bar: { labels: [], datasets: [{ data: [] }] },
      pie: { labels: [], data: [] },
    };

    if (!chartTypes[type]) {
      throw new AppError(`Unknown chart type: ${type}. Use: line, bar, pie`);
    }

    // Convert data to chart format
    if (Array.isArray(data)) {
      const chart = chartTypes[type];
      data.forEach(item => {
        chart.labels.push(item.label || item.name || item.date);
        if (type === 'pie') {
          chart.data.push(item.value || item.count || 0);
        } else {
          chart.datasets[0].data.push(item.value || item.count || 0);
        }
      });
      return JSON.stringify({ type, chartData: chart }, null, 2);
    }

    return JSON.stringify({ type, chartData: data, note: 'Data passed through unchanged' }, null, 2);
  },

  async write_report(args, ctx) {
    const { filename, content, format = 'md' } = args || {};
    assertString(filename, 'filename');
    assertString(content, 'content');

    const reportsDir = safePath(ctx.cwd, CONFIG.reportsDir);
    fs.mkdirSync(reportsDir, { recursive: true });

    const ext = format === 'html' ? '.html' : '.md';
    const fullFilename = filename.endsWith(ext) ? filename : filename + ext;
    const fullPath = path.join(reportsDir, fullFilename);

    let finalContent = content;

    // Wrap in HTML if format is html
    if (format === 'html' && !content.includes('<html')) {
      finalContent = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report - ${filename}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f5f5f5; }
    h1, h2, h3 { color: #333; }
    .metric { font-size: 24px; font-weight: bold; color: #2196F3; }
    .positive { color: #4CAF50; }
    .negative { color: #f44336; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
    }

    fs.writeFileSync(fullPath, finalContent, 'utf8');

    return JSON.stringify({
      success: true,
      path: fullPath,
      filename: fullFilename,
      format,
      size: Buffer.byteLength(finalContent, 'utf8'),
    }, null, 2);
  },

  async list_reports(args, ctx) {
    const { path: p } = args || {};
    const reportsDir = safePath(ctx.cwd, p || CONFIG.reportsDir);

    if (!fs.existsSync(reportsDir)) {
      return JSON.stringify({ reports: [], message: 'Reports directory not found' }, null, 2);
    }

    const files = fs.readdirSync(reportsDir)
      .filter(f => f.endsWith('.md') || f.endsWith('.html'))
      .map(f => {
        const stat = fs.statSync(path.join(reportsDir, f));
        return {
          name: f,
          size: `${(stat.size / 1024).toFixed(1)} KB`,
          modified: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));

    return JSON.stringify({ reports: files }, null, 2);
  },

  async read_template(args, ctx) {
    const { name } = args || {};
    assertString(name, 'name');

    const templatesDir = safePath(ctx.cwd, './templates');
    const templatePath = path.join(templatesDir, name.endsWith('.md') ? name : name + '.md');

    if (!fs.existsSync(templatePath)) {
      // Return a default template
      return `# {{TITLE}}

**Период:** {{PERIOD}}
**Дата создания:** {{DATE}}

## Обзор

| Метрика | Значение |
|---------|----------|
| Расход | {{COST}} |
| Лиды | {{LEADS}} |
| CPL | {{CPL}} |

## Топ кампании

{{CAMPAIGNS_TABLE}}

## Рекомендации

{{RECOMMENDATIONS}}

---
*Отчёт сгенерирован автоматически*
`;
    }

    return fs.readFileSync(templatePath, 'utf8');
  },

  async read_file(args, ctx) {
    const { path: p } = args || {};
    assertString(p, 'path');
    return truncate(fs.readFileSync(safePath(ctx.cwd, p), 'utf8'));
  },
};

// ======== AGENT CONFIGURATION ========
const AGENT_INSTRUCTION = `
You are a Report Generator Agent specialized in creating comprehensive advertising reports.

Your expertise:
- Fetching and aggregating campaign data
- Calculating performance metrics (CPL, CTR, CPC, ROI)
- Creating formatted tables and summaries
- Comparing periods and identifying trends
- Generating actionable recommendations
- Building professional reports in Markdown and HTML

Your approach:
1. First, understand what report is needed (type, period, project)
2. Fetch relevant data from the API
3. Calculate derived metrics
4. Generate summary and key insights
5. Build formatted tables for detailed data
6. Create period comparisons if applicable
7. Add recommendations based on data
8. Write the final report to file

Report types you can generate:
- **Weekly Report**: Summary of the past week's performance
- **Monthly Report**: Detailed monthly analysis with trends
- **Executive Summary**: High-level KPI overview for management
- **Campaign Report**: Deep dive into specific campaigns
- **Comparison Report**: Period-over-period analysis

Output format:
- Reports are saved to ./reports/ directory
- Use Markdown (.md) for detailed reports
- Use HTML for presentation-ready reports
- Include tables, metrics, and recommendations
- All text should be in Russian

IMPORTANT: Always include:
- Clear period specification
- Key metrics (Cost, Leads, CPL, CTR)
- Comparison to targets when available
- Actionable recommendations
`;

const TOOL_INSTRUCTIONS = `
When you need to use a tool, emit the exact syntax:
<<tool:tool_name {"parameter": "value"}>>

Available tools: ${toolListInline()}

Quick reference:
${toolBullets()}

Remember:
- Use strict JSON in tool calls
- Fetch data before building reports
- Calculate metrics for insights
- Format numbers in Russian locale
- Save reports with descriptive names
`;

const FULL_INSTRUCTION = `${AGENT_INSTRUCTION.trim()}\n\n${TOOL_INSTRUCTIONS.trim()}`;

// ======== PROVIDERS ========
class OllamaProvider {
  constructor({ model = 'mistral-small', host = process.env.OLLAMA_HOST || 'http://localhost:11434' }) {
    this.model = model;
    this.host = host.replace(/\/$/, '');
  }
  async complete({ messages, signal }) {
    const res = await fetch(`${this.host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
      signal
    });
    if (!res.ok) throw new AppError(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    return { content: data.message?.content || '', done: data.done };
  }
}

class OpenAIProvider {
  constructor({ model = 'gpt-4o-mini', apiKey, baseUrl = 'https://api.openai.com' }) {
    this.model = model;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }
  async complete({ messages, signal }) {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
      signal,
    });
    if (!res.ok) throw new AppError(`OpenAI HTTP ${res.status}`);
    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content ?? '', done: true };
  }
}

class AnthropicProvider {
  constructor({ model = 'claude-sonnet-4-5-20250929', apiKey, version = '2023-06-01', baseUrl = 'https://api.anthropic.com' }) {
    this.model = model;
    this.apiKey = apiKey;
    this.version = version;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }
  async complete({ messages, signal }) {
    const system = messages.filter(m => m.role === 'system').map(m => String(m.content)).join('\n');
    const convo = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ type: 'text', text: String(m.content) }]
    }));
    const body = { model: this.model, max_tokens: 4096, messages: convo };
    if (system) body.system = system;

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': this.version },
      body: JSON.stringify(body),
      signal
    });
    if (!res.ok) throw new AppError(`Anthropic HTTP ${res.status}`);
    const data = await res.json();
    return { content: (data.content || []).find(p => p?.text)?.text ?? '', done: true };
  }
}

async function createProvider({ modelSpec, providerHint = '', keys = {} }) {
  const model = modelSpec || '';
  let provider = providerHint || '';
  if (!provider) {
    if (/^gpt/.test(model)) provider = 'openai';
    else if (/claude|sonnet/.test(model)) provider = 'anthropic';
    else provider = 'ollama';
  }

  switch (provider) {
    case 'openai':
      return new OpenAIProvider({ model: model || 'gpt-4o-mini', apiKey: keys.openaiKey || process.env.OPENAI_API_KEY });
    case 'anthropic':
      return new AnthropicProvider({ model: model || 'claude-sonnet-4-5-20250929', apiKey: keys.anthropicKey || process.env.ANTHROPIC_API_KEY });
    default:
      return new OllamaProvider({ model: model || 'mistral-small' });
  }
}

// ======== RUNTIME ENGINE ========
function parseToolCalls(text) {
  const calls = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('<<tool:', i);
    if (start === -1) break;
    const nameStart = start + 7;
    let nameEnd = nameStart;
    while (nameEnd < text.length && /\w/.test(text[nameEnd])) nameEnd++;
    const name = text.slice(nameStart, nameEnd);
    let j = nameEnd;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] !== '{') { i = nameEnd; continue; }
    let depth = 0, k = j, inStr = false, esc = false;
    for (; k < text.length; k++) {
      const ch = text[k];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { k++; break; } }
    }
    const close = text.indexOf('>>', k);
    if (close === -1) { i = k; continue; }
    try { calls.push({ name, args: tryParseJSON(text.slice(j, k)) }); } catch { }
    i = close + 2;
  }
  return calls;
}

async function executeTools(calls, ctx) {
  const results = [];
  for (const call of calls) {
    const tool = ToolRegistry[call.name];
    if (!tool) { results.push({ name: call.name, error: `Unknown: ${call.name}` }); continue; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.toolTimeoutMs);
    try {
      const output = await tool(call.args, { ...ctx, signal: controller.signal });
      results.push({ name: call.name, output: truncate(output) });
    } catch (e) { results.push({ name: call.name, error: e.message }); }
    finally { clearTimeout(timeout); }
  }
  return results;
}

async function runAgent({ task, model, provider: hint, openaiKey, anthropicKey, yolo = false, cwd = process.cwd() }) {
  const provider = await createProvider({ modelSpec: model, providerHint: hint, keys: { openaiKey, anthropicKey } });
  logger.info(`Provider: ${provider.constructor.name}, Model: ${provider.model}`);

  const messages = [{ role: 'system', content: FULL_INSTRUCTION }, { role: 'user', content: task }];

  for (let turn = 0; turn < CONFIG.maxTurns; turn++) {
    const { content, done } = await provider.complete({ messages });
    messages.push({ role: 'assistant', content });
    if (!content?.trim()) continue;

    const toolCalls = parseToolCalls(content);
    if (toolCalls.length > 0) {
      logger.info(`Found ${toolCalls.length} tool call(s)`);
      if (!yolo) {
        console.log('\n=== Tool Calls ===');
        toolCalls.forEach(c => console.log(`- ${c.name}: ${JSON.stringify(c.args)}`));
        console.log('\nRun with --yolo to execute');
        return content;
      }
      const results = await executeTools(toolCalls, { cwd });
      messages.push({ role: 'user', content: `[TOOL OUTPUT]\n${results.map(r => r.error ? `> ${r.name}: ERROR: ${r.error}` : `> ${r.name}: ${r.output}`).join('\n')}` });
      continue;
    }
    if (done || /<<done>>/i.test(content)) return content;
  }
  throw new AppError('Max turns reached');
}

// ======== CLI ========
function parseArgs(argv) {
  const args = { task: '', model: '', provider: '', yolo: false, cwd: process.cwd() };
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--model' || arg === '-m') args.model = argv[++i];
    else if (arg === '--provider' || arg === '-p') args.provider = argv[++i];
    else if (arg === '--cwd') args.cwd = argv[++i];
    else if (arg === '--yolo' || arg === '-y') args.yolo = true;
    else if (arg === '--api-url') CONFIG.apiBaseUrl = argv[++i];
    else if (!arg.startsWith('-')) positional.push(arg);
  }
  args.task = positional.join(' ').trim();
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  loadDotEnvToProcess(args.cwd);
  loadDotEnvToProcess(path.join(args.cwd, '..'));

  if (!args.task) {
    console.log(`
Report Generator Agent - Create Advertising Reports

Usage:
  node report-generator-agent.js "Your report task" --yolo

Examples:
  node report-generator-agent.js "Generate weekly report for project proj_123" --yolo
  node report-generator-agent.js "Create executive summary for last month" --yolo
  node report-generator-agent.js "Build comparison report: this week vs last week" --yolo
  node report-generator-agent.js "Generate HTML report with charts" --yolo

Report Types:
  - Weekly Report: Past 7 days performance
  - Monthly Report: Past 30 days with trends
  - Executive Summary: KPI overview
  - Campaign Report: Detailed campaign analysis
  - Comparison Report: Period comparison

Options:
  --yolo, -y    Auto-execute tools
  --model, -m   AI model
  --provider    Provider (ollama, openai, anthropic)
  --api-url     API URL (default: http://localhost:3001)
`);
    process.exit(0);
  }

  logger.info('Starting Report Generator Agent');
  logger.info(`Reports will be saved to: ${CONFIG.reportsDir}`);

  const result = await runAgent(args);
  console.log('\n=== Report Generated ===');
  console.log(result);
}

if (require.main === module) main().catch(e => { logger.error(e.message); process.exit(2); });
module.exports = { ToolRegistry, runAgent };
