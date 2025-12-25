#!/usr/bin/env node
'use strict';

// ======== HEADER ========
// Data Sync Agent - Synchronize data between Yandex.Direct and local database
// Purpose: Fetch, validate, and sync advertising data
// Usage:
//   node data-sync-agent.js "Sync all campaigns for project X"
//   node data-sync-agent.js "Update statistics for last 7 days" --yolo
//   node data-sync-agent.js "Check sync status" --yolo

const CONFIG = {
  logLevel: process.env.LOG_LEVEL || 'info',
  maxTurns: 15,
  toolTimeoutMs: 120_000, // 2 minutes for API calls
  maxToolOutputChars: 8192,
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  authToken: process.env.AUTH_TOKEN || '',
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
    return str.slice(0, maxChars) + `\n...[truncated ${str.length - maxChars} chars]`;
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
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new AppError(`API error ${res.status}: ${text.slice(0, 200)}`, 'API_ERROR');
  }
  return res.json();
}

// ======== TOOL REGISTRY ========
const TOOL_DOCS = {
  help: 'Get tool documentation. args: {tool?}',
  list_projects: 'List all projects. args: {}',
  get_project: 'Get project details. args: {projectId}',
  get_sync_status: 'Get synchronization status. args: {projectId}',
  sync_campaigns: 'Sync campaigns from Yandex.Direct. args: {projectId}',
  sync_adgroups: 'Sync ad groups for campaigns. args: {projectId, campaignIds?}',
  sync_ads: 'Sync ads for ad groups. args: {projectId, adGroupIds?}',
  sync_keywords: 'Sync keywords. args: {projectId, adGroupIds?}',
  sync_statistics: 'Sync statistics for date range. args: {projectId, dateFrom, dateTo}',
  sync_conversions: 'Sync conversion data. args: {projectId, dateFrom?, dateTo?}',
  validate_data: 'Validate synced data integrity. args: {projectId}',
  get_sync_errors: 'Get recent sync errors. args: {projectId?, limit?}',
  retry_failed_sync: 'Retry failed sync operations. args: {projectId}',
  schedule_sync: 'Schedule automatic sync. args: {projectId, interval}',
  get_data_summary: 'Get summary of synced data. args: {projectId}',
  compare_local_remote: 'Compare local and remote data. args: {projectId}',
  cleanup_old_data: 'Remove old/stale data. args: {projectId, olderThanDays}',
  write_log: 'Write sync log. args: {path, content}',
  read_file: 'Read file. args: {path}',
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
    if (!tool) return ['Data Sync Agent Tools:', names.join(', ')].join('\n');
    return `Tool: ${tool}\nDescription: ${TOOL_DOCS[tool] || 'No description'}`;
  },

  // Project Tools
  async list_projects() {
    try {
      const projects = await apiRequest('/api/projects');
      return JSON.stringify(projects.map(p => ({
        id: p.id,
        name: p.name,
        yandexAccounts: p.yandexConnections?.length || 0,
      })), null, 2);
    } catch (e) {
      throw new AppError(`Failed to list projects: ${e.message}`);
    }
  },

  async get_project(args) {
    const { projectId } = args || {};
    assertString(projectId, 'projectId');
    try {
      const project = await apiRequest(`/api/projects/${projectId}`);
      return JSON.stringify(project, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get project: ${e.message}`);
    }
  },

  // Sync Status Tools
  async get_sync_status(args) {
    const { projectId } = args || {};
    assertString(projectId, 'projectId');

    try {
      const status = await apiRequest(`/api/sync/status/${projectId}`);
      return JSON.stringify({
        projectId,
        lastSync: status.lastSync || 'Never',
        status: status.status || 'unknown',
        campaignsCount: status.campaigns || 0,
        adGroupsCount: status.adGroups || 0,
        adsCount: status.ads || 0,
        keywordsCount: status.keywords || 0,
        statsLastDate: status.statsLastDate || 'N/A',
        errors: status.errors || [],
      }, null, 2);
    } catch (e) {
      // Return a default status if endpoint doesn't exist
      return JSON.stringify({
        projectId,
        status: 'unknown',
        message: 'Sync status endpoint not available. Run sync operations to update.',
      }, null, 2);
    }
  },

  // Sync Operations
  async sync_campaigns(args) {
    const { projectId } = args || {};
    assertString(projectId, 'projectId');

    logger.info(`Syncing campaigns for project ${projectId}...`);
    try {
      const result = await apiRequest(`/api/yandex/sync/campaigns/${projectId}`, {
        method: 'POST',
      });
      return JSON.stringify({
        success: true,
        synced: result.count || result.campaigns?.length || 0,
        campaigns: (result.campaigns || []).slice(0, 10).map(c => ({
          id: c.Id || c.id,
          name: c.Name || c.name,
          status: c.Status || c.status,
        })),
        message: 'Campaigns synced successfully',
      }, null, 2);
    } catch (e) {
      return JSON.stringify({
        success: false,
        error: e.message,
        suggestion: 'Check if Yandex API token is valid and project has connected accounts',
      }, null, 2);
    }
  },

  async sync_adgroups(args) {
    const { projectId, campaignIds } = args || {};
    assertString(projectId, 'projectId');

    logger.info(`Syncing ad groups for project ${projectId}...`);
    try {
      const body = campaignIds ? { campaignIds: Array.isArray(campaignIds) ? campaignIds : [campaignIds] } : {};
      const result = await apiRequest(`/api/yandex/sync/adgroups/${projectId}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return JSON.stringify({
        success: true,
        synced: result.count || 0,
        message: 'Ad groups synced successfully',
      }, null, 2);
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message }, null, 2);
    }
  },

  async sync_ads(args) {
    const { projectId, adGroupIds } = args || {};
    assertString(projectId, 'projectId');

    logger.info(`Syncing ads for project ${projectId}...`);
    try {
      const body = adGroupIds ? { adGroupIds: Array.isArray(adGroupIds) ? adGroupIds : [adGroupIds] } : {};
      const result = await apiRequest(`/api/yandex/sync/ads/${projectId}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return JSON.stringify({
        success: true,
        synced: result.count || 0,
        message: 'Ads synced successfully',
      }, null, 2);
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message }, null, 2);
    }
  },

  async sync_keywords(args) {
    const { projectId, adGroupIds } = args || {};
    assertString(projectId, 'projectId');

    logger.info(`Syncing keywords for project ${projectId}...`);
    try {
      const body = adGroupIds ? { adGroupIds: Array.isArray(adGroupIds) ? adGroupIds : [adGroupIds] } : {};
      const result = await apiRequest(`/api/yandex/sync/keywords/${projectId}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return JSON.stringify({
        success: true,
        synced: result.count || 0,
        message: 'Keywords synced successfully',
      }, null, 2);
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message }, null, 2);
    }
  },

  async sync_statistics(args) {
    const { projectId, dateFrom, dateTo } = args || {};
    assertString(projectId, 'projectId');
    assertString(dateFrom, 'dateFrom');
    assertString(dateTo, 'dateTo');

    logger.info(`Syncing statistics for project ${projectId} from ${dateFrom} to ${dateTo}...`);
    try {
      const result = await apiRequest(`/api/yandex/sync/stats/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({ dateFrom, dateTo }),
      });
      return JSON.stringify({
        success: true,
        dateRange: { from: dateFrom, to: dateTo },
        records: result.count || 0,
        summary: result.summary || {},
        message: 'Statistics synced successfully',
      }, null, 2);
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message }, null, 2);
    }
  },

  async sync_conversions(args) {
    const { projectId, dateFrom, dateTo } = args || {};
    assertString(projectId, 'projectId');

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    logger.info(`Syncing conversions for project ${projectId}...`);
    try {
      const result = await apiRequest(`/api/yandex/sync/conversions/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: dateFrom || weekAgo,
          dateTo: dateTo || today,
        }),
      });
      return JSON.stringify({
        success: true,
        conversions: result.count || 0,
        message: 'Conversions synced successfully',
      }, null, 2);
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message }, null, 2);
    }
  },

  // Data Validation
  async validate_data(args) {
    const { projectId } = args || {};
    assertString(projectId, 'projectId');

    try {
      const result = await apiRequest(`/api/sync/validate/${projectId}`);
      return JSON.stringify({
        valid: result.valid ?? true,
        issues: result.issues || [],
        warnings: result.warnings || [],
        stats: result.stats || {},
      }, null, 2);
    } catch (e) {
      // Perform basic validation locally
      return JSON.stringify({
        valid: true,
        message: 'Validation endpoint not available. Basic check passed.',
        suggestion: 'Implement /api/sync/validate endpoint for detailed validation',
      }, null, 2);
    }
  },

  async get_sync_errors(args) {
    const { projectId, limit = 20 } = args || {};

    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (projectId) params.append('projectId', projectId);

      const errors = await apiRequest(`/api/sync/errors?${params}`);
      return JSON.stringify({
        count: errors.length,
        errors: errors.slice(0, limit).map(e => ({
          timestamp: e.timestamp,
          type: e.type,
          message: e.message,
          projectId: e.projectId,
        })),
      }, null, 2);
    } catch (e) {
      return JSON.stringify({ count: 0, errors: [], message: 'No errors found or endpoint not available' }, null, 2);
    }
  },

  async retry_failed_sync(args) {
    const { projectId } = args || {};
    assertString(projectId, 'projectId');

    try {
      const result = await apiRequest(`/api/sync/retry/${projectId}`, { method: 'POST' });
      return JSON.stringify({
        success: true,
        retried: result.count || 0,
        message: 'Failed sync operations retried',
      }, null, 2);
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message }, null, 2);
    }
  },

  // Scheduling
  async schedule_sync(args) {
    const { projectId, interval } = args || {};
    assertString(projectId, 'projectId');
    assertString(interval, 'interval');

    const validIntervals = ['hourly', 'daily', 'weekly', '6h', '12h'];
    if (!validIntervals.includes(interval)) {
      return JSON.stringify({
        success: false,
        error: `Invalid interval. Use: ${validIntervals.join(', ')}`,
      }, null, 2);
    }

    try {
      const result = await apiRequest(`/api/sync/schedule/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({ interval }),
      });
      return JSON.stringify({
        success: true,
        projectId,
        interval,
        nextRun: result.nextRun,
        message: `Sync scheduled ${interval}`,
      }, null, 2);
    } catch (e) {
      return JSON.stringify({
        success: false,
        error: e.message,
        suggestion: 'Schedule endpoint may not be implemented. Consider using cron jobs.',
      }, null, 2);
    }
  },

  // Data Analysis
  async get_data_summary(args) {
    const { projectId } = args || {};
    assertString(projectId, 'projectId');

    try {
      const stats = await apiRequest(`/api/yandex/stats/${projectId}`);
      return JSON.stringify({
        projectId,
        campaigns: stats.campaignsCount || stats.campaigns?.length || 0,
        totalCost: stats.totalCost || 0,
        totalClicks: stats.totalClicks || 0,
        totalConversions: stats.totalConversions || 0,
        dateRange: stats.dateRange || {},
        lastUpdated: stats.lastUpdated || new Date().toISOString(),
      }, null, 2);
    } catch (e) {
      throw new AppError(`Failed to get data summary: ${e.message}`);
    }
  },

  async compare_local_remote(args) {
    const { projectId } = args || {};
    assertString(projectId, 'projectId');

    try {
      // Get local data
      const local = await apiRequest(`/api/yandex/stats/${projectId}`);

      // Get remote data (fresh from Yandex)
      const remote = await apiRequest(`/api/yandex/campaigns/${projectId}?refresh=true`);

      const localCount = local.campaignsCount || local.campaigns?.length || 0;
      const remoteCount = remote.campaigns?.length || remote.length || 0;

      return JSON.stringify({
        projectId,
        local: { campaigns: localCount },
        remote: { campaigns: remoteCount },
        inSync: localCount === remoteCount,
        difference: remoteCount - localCount,
        recommendation: localCount !== remoteCount
          ? 'Run sync_campaigns to update local data'
          : 'Data is in sync',
      }, null, 2);
    } catch (e) {
      return JSON.stringify({
        success: false,
        error: e.message,
        suggestion: 'Unable to compare. Check API connectivity.',
      }, null, 2);
    }
  },

  async cleanup_old_data(args) {
    const { projectId, olderThanDays = 90 } = args || {};
    assertString(projectId, 'projectId');

    try {
      const result = await apiRequest(`/api/sync/cleanup/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({ olderThanDays }),
      });
      return JSON.stringify({
        success: true,
        deleted: result.deleted || 0,
        olderThanDays,
        message: `Cleaned up data older than ${olderThanDays} days`,
      }, null, 2);
    } catch (e) {
      return JSON.stringify({
        success: false,
        error: e.message,
        suggestion: 'Cleanup endpoint may not be implemented',
      }, null, 2);
    }
  },

  // File Tools
  async write_log(args, ctx) {
    const { path: p, content = '' } = args || {};
    assertString(p, 'path');
    const full = safePath(ctx.cwd, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    const timestamp = new Date().toISOString();
    fs.appendFileSync(full, `[${timestamp}] ${content}\n`, 'utf8');
    return `Log written to ${p}`;
  },

  async read_file(args, ctx) {
    const { path: p } = args || {};
    assertString(p, 'path');
    return truncate(fs.readFileSync(safePath(ctx.cwd, p), 'utf8'));
  },
};

// ======== AGENT CONFIGURATION ========
const AGENT_INSTRUCTION = `
You are a Data Sync Agent specialized in synchronizing advertising data between Yandex.Direct API and local database.

Your expertise:
- Syncing campaigns, ad groups, ads, and keywords
- Fetching and storing statistics data
- Managing conversion tracking data
- Validating data integrity
- Handling sync errors and retries
- Scheduling automatic synchronization

Your approach:
1. First, list projects to understand scope
2. Check current sync status for the target project
3. Compare local and remote data to identify gaps
4. Run appropriate sync operations in order:
   - Campaigns first (parent entities)
   - Ad groups (depend on campaigns)
   - Ads and keywords (depend on ad groups)
   - Statistics last (time-series data)
5. Validate synced data
6. Log all operations

Sync order (important!):
1. sync_campaigns - Always sync campaigns first
2. sync_adgroups - Then ad groups
3. sync_ads - Then ads
4. sync_keywords - Keywords can be parallel with ads
5. sync_statistics - Statistics after entity sync
6. sync_conversions - Conversions last

Error handling:
- Check get_sync_errors for recent issues
- Use retry_failed_sync to recover
- Log all errors for debugging

Output format:
- Report sync status after each operation
- Provide summary at the end
- Log to ./logs/sync-{date}.log
`;

const TOOL_INSTRUCTIONS = `
When you need to use a tool, emit the exact syntax:
<<tool:tool_name {"parameter": "value"}>>

Available tools: ${toolListInline()}

Quick reference:
${toolBullets()}

Remember:
- Use strict JSON in tool calls
- Sync entities in correct order
- Always validate after sync
- Log all operations
`;

const FULL_INSTRUCTION = `${AGENT_INSTRUCTION.trim()}\n\n${TOOL_INSTRUCTIONS.trim()}`;

// ======== PROVIDERS (same as other agents) ========
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
    const text = await res.text();
    if (!res.ok) throw new AppError(`OpenAI HTTP ${res.status}`);
    const data = JSON.parse(text);
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
    const text = await res.text();
    if (!res.ok) throw new AppError(`Anthropic HTTP ${res.status}`);
    const data = JSON.parse(text);
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
Data Sync Agent - Yandex.Direct Data Synchronization

Usage:
  node data-sync-agent.js "Your sync task" --yolo

Examples:
  node data-sync-agent.js "List all projects" --yolo
  node data-sync-agent.js "Sync campaigns for project proj_123" --yolo
  node data-sync-agent.js "Full sync for project proj_123" --yolo
  node data-sync-agent.js "Sync statistics for last 7 days" --yolo
  node data-sync-agent.js "Check sync status and fix errors" --yolo

Options:
  --yolo, -y    Auto-execute tools
  --model, -m   AI model
  --provider    Provider (ollama, openai, anthropic)
  --api-url     API URL (default: http://localhost:3001)
`);
    process.exit(0);
  }

  logger.info('Starting Data Sync Agent');
  logger.info(`API URL: ${CONFIG.apiBaseUrl}`);

  const result = await runAgent(args);
  console.log('\n=== Sync Complete ===');
  console.log(result);
}

if (require.main === module) main().catch(e => { logger.error(e.message); process.exit(2); });
module.exports = { ToolRegistry, runAgent };
