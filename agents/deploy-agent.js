#!/usr/bin/env node
'use strict';

// ======== HEADER ========
// Deploy Agent - Automated deployment and release management
// Purpose: Build, test, and deploy applications safely
// Usage:
//   node deploy-agent.js "Deploy to production"
//   node deploy-agent.js "Build and test before deploy" --yolo
//   node deploy-agent.js "Rollback to previous version" --yolo

const CONFIG = {
  logLevel: process.env.LOG_LEVEL || 'info',
  maxTurns: 20,
  toolTimeoutMs: 300_000, // 5 minutes for build/deploy
  maxToolOutputChars: 8192,
};

// ======== UTILITIES ========
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

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

function execCommand(cmd, cwd, timeout = 300000) {
  try {
    const result = execSync(cmd, {
      cwd,
      encoding: 'utf8',
      timeout,
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result;
  } catch (e) {
    if (e.stdout) return `STDOUT:\n${e.stdout}\n\nSTDERR:\n${e.stderr || ''}`;
    throw new AppError(`Command failed: ${e.message}`, 'EXEC_ERROR');
  }
}

// ======== TOOL REGISTRY ========
const TOOL_DOCS = {
  help: 'Get tool documentation. args: {tool?}',
  check_git_status: 'Check if working directory is clean. args: {}',
  get_current_branch: 'Get current git branch. args: {}',
  get_latest_tag: 'Get latest git tag/version. args: {}',
  create_tag: 'Create a new git tag. args: {tag, message?}',
  npm_install: 'Run npm install. args: {path?}',
  npm_build: 'Run npm build. args: {path?}',
  npm_test: 'Run npm test. args: {path?}',
  check_build_output: 'Verify build output exists. args: {path?}',
  run_typecheck: 'Run TypeScript type checking. args: {path?}',
  docker_build: 'Build Docker image. args: {tag?, dockerfile?}',
  docker_push: 'Push Docker image to registry. args: {image}',
  pm2_status: 'Check PM2 process status. args: {}',
  pm2_restart: 'Restart PM2 process. args: {name?}',
  pm2_deploy: 'Deploy using PM2 ecosystem. args: {env?}',
  run_migrations: 'Run database migrations. args: {}',
  health_check: 'Check if service is healthy. args: {url}',
  create_backup: 'Create backup before deploy. args: {name?}',
  rollback: 'Rollback to previous deployment. args: {version?}',
  write_log: 'Write deployment log. args: {path, content}',
  read_file: 'Read file contents. args: {path}',
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

const ToolRegistry = {
  async help(args, ctx) {
    const { tool } = args || {};
    const names = Object.keys(ToolRegistry).sort();
    if (!tool) {
      return ['Deploy Agent Tools:', names.join(', '), '', 'Usage: <<tool:help {"tool":"TOOL_NAME"}>>'].join('\n');
    }
    return `Tool: ${tool}\nDescription: ${TOOL_DOCS[tool] || 'No description'}`;
  },

  // Git Tools
  async check_git_status(args, ctx) {
    const output = execCommand('git status --porcelain', ctx.cwd);
    const lines = output.trim().split('\n').filter(Boolean);

    if (lines.length === 0) {
      return JSON.stringify({ clean: true, message: 'Working directory is clean' });
    }

    return JSON.stringify({
      clean: false,
      changes: lines.length,
      files: lines.slice(0, 20),
      message: 'Working directory has uncommitted changes',
    });
  },

  async get_current_branch(args, ctx) {
    const branch = execCommand('git rev-parse --abbrev-ref HEAD', ctx.cwd).trim();
    const commit = execCommand('git rev-parse --short HEAD', ctx.cwd).trim();
    return JSON.stringify({ branch, commit });
  },

  async get_latest_tag(args, ctx) {
    try {
      const tag = execCommand('git describe --tags --abbrev=0', ctx.cwd).trim();
      const commits = execCommand(`git rev-list ${tag}..HEAD --count`, ctx.cwd).trim();
      return JSON.stringify({ tag, commitsSinceTag: parseInt(commits, 10) });
    } catch (e) {
      return JSON.stringify({ tag: null, message: 'No tags found' });
    }
  },

  async create_tag(args, ctx) {
    const { tag, message } = args || {};
    assertString(tag, 'tag');

    const msg = message || `Release ${tag}`;
    execCommand(`git tag -a "${tag}" -m "${msg}"`, ctx.cwd);
    return JSON.stringify({ success: true, tag, message: msg });
  },

  // Build Tools
  async npm_install(args, ctx) {
    const { path: p = '.' } = args || {};
    const cwd = safePath(ctx.cwd, p);

    logger.info('Running npm install...');
    const output = execCommand('npm ci', cwd);
    return truncate(`npm install completed:\n${output}`);
  },

  async npm_build(args, ctx) {
    const { path: p = '.' } = args || {};
    const cwd = safePath(ctx.cwd, p);

    logger.info('Running npm build...');
    const output = execCommand('npm run build', cwd);
    return truncate(`Build completed:\n${output}`);
  },

  async npm_test(args, ctx) {
    const { path: p = '.' } = args || {};
    const cwd = safePath(ctx.cwd, p);

    logger.info('Running npm test...');
    try {
      const output = execCommand('npm test', cwd);
      return JSON.stringify({ success: true, output: truncate(output) });
    } catch (e) {
      return JSON.stringify({ success: false, error: truncate(e.message) });
    }
  },

  async check_build_output(args, ctx) {
    const { path: p = 'dist' } = args || {};
    const buildPath = safePath(ctx.cwd, p);

    if (!fs.existsSync(buildPath)) {
      return JSON.stringify({ exists: false, message: `Build directory not found: ${p}` });
    }

    const files = fs.readdirSync(buildPath);
    let totalSize = 0;

    function getSize(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          getSize(fullPath);
        } else {
          totalSize += fs.statSync(fullPath).size;
        }
      }
    }

    getSize(buildPath);

    return JSON.stringify({
      exists: true,
      files: files.length,
      totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
      contents: files.slice(0, 20),
    });
  },

  async run_typecheck(args, ctx) {
    const { path: p = '.' } = args || {};
    const cwd = safePath(ctx.cwd, p);

    try {
      const output = execCommand('npx tsc --noEmit', cwd);
      return JSON.stringify({ success: true, message: 'No type errors', output: truncate(output) });
    } catch (e) {
      const errorLines = e.message.split('\n').filter(l => l.includes('error TS'));
      return JSON.stringify({
        success: false,
        errorCount: errorLines.length,
        errors: errorLines.slice(0, 10),
      });
    }
  },

  // Docker Tools
  async docker_build(args, ctx) {
    const { tag = 'app:latest', dockerfile = 'Dockerfile' } = args || {};

    logger.info(`Building Docker image: ${tag}`);
    try {
      const output = execCommand(`docker build -t ${tag} -f ${dockerfile} .`, ctx.cwd);
      return JSON.stringify({ success: true, image: tag, output: truncate(output) });
    } catch (e) {
      return JSON.stringify({ success: false, error: truncate(e.message) });
    }
  },

  async docker_push(args, ctx) {
    const { image } = args || {};
    assertString(image, 'image');

    logger.info(`Pushing Docker image: ${image}`);
    try {
      const output = execCommand(`docker push ${image}`, ctx.cwd);
      return JSON.stringify({ success: true, image, output: truncate(output) });
    } catch (e) {
      return JSON.stringify({ success: false, error: truncate(e.message) });
    }
  },

  // PM2 Tools
  async pm2_status(args, ctx) {
    try {
      const output = execCommand('pm2 jlist', ctx.cwd);
      const processes = JSON.parse(output);

      const summary = processes.map(p => ({
        name: p.name,
        status: p.pm2_env?.status,
        memory: `${Math.round((p.monit?.memory || 0) / 1024 / 1024)} MB`,
        cpu: `${p.monit?.cpu || 0}%`,
        uptime: p.pm2_env?.pm_uptime ? new Date(p.pm2_env.pm_uptime).toISOString() : 'N/A',
        restarts: p.pm2_env?.restart_time || 0,
      }));

      return JSON.stringify({ processes: summary });
    } catch (e) {
      return JSON.stringify({ error: 'PM2 not available or no processes running' });
    }
  },

  async pm2_restart(args, ctx) {
    const { name = 'all' } = args || {};

    logger.info(`Restarting PM2 process: ${name}`);
    try {
      const output = execCommand(`pm2 restart ${name}`, ctx.cwd);
      return JSON.stringify({ success: true, output: truncate(output) });
    } catch (e) {
      return JSON.stringify({ success: false, error: truncate(e.message) });
    }
  },

  async pm2_deploy(args, ctx) {
    const { env = 'production' } = args || {};

    // Check if ecosystem file exists
    const ecosystemPath = path.join(ctx.cwd, 'ecosystem.config.js');
    if (!fs.existsSync(ecosystemPath)) {
      return JSON.stringify({ success: false, error: 'ecosystem.config.js not found' });
    }

    logger.info(`Deploying with PM2 to ${env}`);
    try {
      const output = execCommand(`pm2 deploy ${env}`, ctx.cwd);
      return JSON.stringify({ success: true, environment: env, output: truncate(output) });
    } catch (e) {
      return JSON.stringify({ success: false, error: truncate(e.message) });
    }
  },

  // Database Tools
  async run_migrations(args, ctx) {
    logger.info('Running database migrations...');

    // Try common migration commands
    const commands = [
      'npm run migrate',
      'npx prisma migrate deploy',
      'npx knex migrate:latest',
      'npm run db:migrate',
    ];

    for (const cmd of commands) {
      try {
        const output = execCommand(cmd, ctx.cwd);
        return JSON.stringify({ success: true, command: cmd, output: truncate(output) });
      } catch (e) {
        continue;
      }
    }

    return JSON.stringify({ success: false, error: 'No migration command found' });
  },

  // Health & Monitoring
  async health_check(args, ctx) {
    const { url } = args || {};
    assertString(url, 'url');

    try {
      const res = await fetch(url, { method: 'GET', timeout: 10000 });
      const status = res.status;
      const ok = status >= 200 && status < 300;

      return JSON.stringify({
        healthy: ok,
        status,
        url,
        message: ok ? 'Service is healthy' : `Service returned ${status}`,
      });
    } catch (e) {
      return JSON.stringify({
        healthy: false,
        error: e.message,
        url,
        message: 'Health check failed',
      });
    }
  },

  // Backup & Rollback
  async create_backup(args, ctx) {
    const { name } = args || {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = name || `backup-${timestamp}`;
    const backupDir = path.join(ctx.cwd, 'backups', backupName);

    fs.mkdirSync(backupDir, { recursive: true });

    // Backup dist folder if exists
    const distPath = path.join(ctx.cwd, 'dist');
    if (fs.existsSync(distPath)) {
      execCommand(`cp -r "${distPath}" "${backupDir}/dist"`, ctx.cwd);
    }

    // Backup package.json
    const pkgPath = path.join(ctx.cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      fs.copyFileSync(pkgPath, path.join(backupDir, 'package.json'));
    }

    // Save git info
    const gitInfo = {
      branch: execCommand('git rev-parse --abbrev-ref HEAD', ctx.cwd).trim(),
      commit: execCommand('git rev-parse HEAD', ctx.cwd).trim(),
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(backupDir, 'git-info.json'), JSON.stringify(gitInfo, null, 2));

    return JSON.stringify({
      success: true,
      backupName,
      path: backupDir,
      gitInfo,
    });
  },

  async rollback(args, ctx) {
    const { version } = args || {};
    const backupsDir = path.join(ctx.cwd, 'backups');

    if (!fs.existsSync(backupsDir)) {
      return JSON.stringify({ success: false, error: 'No backups directory found' });
    }

    const backups = fs.readdirSync(backupsDir)
      .filter(d => fs.statSync(path.join(backupsDir, d)).isDirectory())
      .sort()
      .reverse();

    if (backups.length === 0) {
      return JSON.stringify({ success: false, error: 'No backups available' });
    }

    const targetBackup = version || backups[0];
    const backupPath = path.join(backupsDir, targetBackup);

    if (!fs.existsSync(backupPath)) {
      return JSON.stringify({
        success: false,
        error: `Backup not found: ${targetBackup}`,
        available: backups.slice(0, 5),
      });
    }

    // Restore dist
    const backupDist = path.join(backupPath, 'dist');
    if (fs.existsSync(backupDist)) {
      const currentDist = path.join(ctx.cwd, 'dist');
      if (fs.existsSync(currentDist)) {
        execCommand(`rm -rf "${currentDist}"`, ctx.cwd);
      }
      execCommand(`cp -r "${backupDist}" "${currentDist}"`, ctx.cwd);
    }

    return JSON.stringify({
      success: true,
      restoredFrom: targetBackup,
      message: 'Rollback completed. Restart services to apply.',
    });
  },

  // File Tools
  async write_log(args, ctx) {
    const { path: p, content = '' } = args || {};
    assertString(p, 'path');
    const full = safePath(ctx.cwd, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.appendFileSync(full, content + '\n', 'utf8');
    return `Log written to ${p}`;
  },

  async read_file(args, ctx) {
    const { path: p } = args || {};
    assertString(p, 'path');
    const full = safePath(ctx.cwd, p);
    return truncate(fs.readFileSync(full, 'utf8'));
  },

  async list_files(args, ctx) {
    const { path: p = '.' } = args || {};
    const dir = safePath(ctx.cwd, p);
    const files = fs.readdirSync(dir, { withFileTypes: true })
      .map(d => (d.isDirectory() ? d.name + '/' : d.name));
    return JSON.stringify(files, null, 2);
  },
};

// ======== AGENT CONFIGURATION ========
const AGENT_INSTRUCTION = `
You are a Deploy Agent specialized in safe and reliable application deployments.

Your expertise:
- Building and testing applications before deployment
- Managing Docker containers and PM2 processes
- Running database migrations safely
- Creating backups and handling rollbacks
- Health checking and monitoring deployments

Your approach:
1. First, check git status to ensure clean working directory
2. Verify current branch and latest version
3. Run tests and type checking
4. Create a backup before any changes
5. Build the application
6. Deploy using appropriate method (PM2, Docker, etc.)
7. Run health checks to verify deployment
8. Log all deployment activities

Safety rules:
- ALWAYS create backup before deploying
- ALWAYS run tests before deploying to production
- NEVER deploy with uncommitted changes
- ALWAYS verify health after deployment
- Be ready to rollback if health check fails

Output format:
- Provide step-by-step deployment status
- Log all actions to ./logs/deploy-{date}.log
- Report success/failure clearly
- Include rollback instructions if needed
`;

const TOOL_INSTRUCTIONS = `
When you need to use a tool, emit the exact syntax:
<<tool:tool_name {"parameter": "value"}>>

Available tools: ${toolListInline()}

Quick reference:
${toolBullets()}

Remember:
- Use strict JSON in tool calls
- Always backup before deploying
- Check health after deployment
- Log all actions
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, messages, stream: false }),
        signal,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      const data = JSON.parse(text);
      return { content: data.choices?.[0]?.message?.content ?? '', done: true };
    } catch (e) {
      throw new AppError(`OpenAI error: ${e.message}`, 'PROVIDER');
    }
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
    try {
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
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      const data = JSON.parse(text);
      return { content: (data.content || []).find(p => p?.text)?.text ?? '', done: true };
    } catch (e) {
      throw new AppError(`Anthropic error: ${e.message}`, 'PROVIDER');
    }
  }
}

function inferProviderFromModel(model) {
  const s = (model || '').toLowerCase();
  if (/^(gpt-[345]|o[1-9])/.test(s)) return 'openai';
  if (s.startsWith('claude') || s.includes('sonnet')) return 'anthropic';
  return '';
}

async function createProvider({ modelSpec, providerHint = '', keys = {} }) {
  let provider = (providerHint || '').toLowerCase() || inferProviderFromModel(modelSpec) || 'ollama';
  let model = modelSpec || '';
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
    default:
      return new OllamaProvider({ model });
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
    if (!tool) { results.push({ name: call.name, error: `Unknown tool: ${call.name}` }); continue; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.toolTimeoutMs);
    try {
      const output = await tool(call.args, { ...ctx, signal: controller.signal });
      results.push({ name: call.name, output: truncate(output) });
    } catch (e) {
      results.push({ name: call.name, error: e.message });
    } finally { clearTimeout(timeout); }
  }
  return results;
}

async function runAgent({ task, model, provider: providerHint, openaiKey, anthropicKey, yolo = false, cwd = process.cwd() }) {
  const provider = await createProvider({ modelSpec: model, providerHint, keys: { openaiKey, anthropicKey } });
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
        console.log('\n=== Tool Calls Detected ===');
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
  const args = { task: '', model: '', provider: '', yolo: false, cwd: process.cwd(), openaiKey: '', anthropicKey: '' };
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--model' || arg === '-m') args.model = argv[++i];
    else if (arg === '--provider' || arg === '-p') args.provider = argv[++i];
    else if (arg === '--cwd') args.cwd = argv[++i];
    else if (arg === '--yolo' || arg === '-y') args.yolo = true;
    else if (!arg.startsWith('-')) positional.push(arg);
  }
  args.task = positional.join(' ').trim();
  return args;
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    loadDotEnvToProcess(args.cwd);

    if (!args.task) {
      console.log(`
Deploy Agent - Safe Application Deployment

Usage:
  node deploy-agent.js "Your deployment task" --yolo

Examples:
  node deploy-agent.js "Build and deploy to production" --yolo
  node deploy-agent.js "Check deployment status" --yolo
  node deploy-agent.js "Rollback to previous version" --yolo
  node deploy-agent.js "Run tests and build" --yolo

Options:
  --yolo, -y    Auto-execute tools
  --model, -m   AI model
  --provider    Provider (ollama, openai, anthropic)
  --cwd         Working directory
`);
      process.exit(0);
    }

    logger.info('Starting Deploy Agent');
    const result = await runAgent(args);
    console.log('\n=== Deployment Complete ===');
    console.log(result);

  } catch (error) {
    logger.error(error.message);
    process.exit(2);
  }
}

if (require.main === module) main();
module.exports = { ToolRegistry, runAgent };
