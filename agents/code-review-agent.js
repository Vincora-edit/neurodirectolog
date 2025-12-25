#!/usr/bin/env node
'use strict';

// ======== HEADER ========
// Code Review Agent - Automated code review and quality analysis
// Purpose: Review code changes, find bugs, suggest improvements, check best practices
// Usage:
//   node code-review-agent.js "Review the latest changes in client/src"
//   node code-review-agent.js "Check for security issues" --yolo
//   node code-review-agent.js "Review PR diff" --yolo

const CONFIG = {
  logLevel: process.env.LOG_LEVEL || 'info',
  maxTurns: 15,
  toolTimeoutMs: 30_000,
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

// Execute shell command safely
function execCommand(cmd, cwd, timeout = 30000) {
  try {
    const result = execSync(cmd, {
      cwd,
      encoding: 'utf8',
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result;
  } catch (e) {
    if (e.stdout) return e.stdout;
    throw new AppError(`Command failed: ${e.message}`, 'EXEC_ERROR');
  }
}

// ======== TOOL REGISTRY ========
const TOOL_DOCS = {
  help: 'Get tool documentation. args: {tool?}',
  git_status: 'Get git status of the repository. args: {}',
  git_diff: 'Get git diff for changes. args: {staged?, file?, commit?}',
  git_log: 'Get git commit history. args: {count?, file?}',
  git_show: 'Show a specific commit. args: {commit}',
  list_files: 'List files in directory. args: {path?, pattern?}',
  read_file: 'Read file contents. args: {path, lines?}',
  search_code: 'Search for pattern in code. args: {pattern, path?, extension?}',
  find_files: 'Find files by name pattern. args: {pattern, path?}',
  check_typescript: 'Run TypeScript compiler check. args: {path?}',
  check_eslint: 'Run ESLint on files. args: {path?}',
  analyze_complexity: 'Analyze code complexity. args: {path}',
  find_todos: 'Find TODO/FIXME comments. args: {path?}',
  check_dependencies: 'Check for outdated dependencies. args: {path?}',
  write_review: 'Write review report to file. args: {path, content}',
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
      return [
        'Code Review Agent Tools:',
        names.join(', '),
        '',
        'Usage: <<tool:help {"tool":"TOOL_NAME"}>>',
      ].join('\n');
    }
    const fn = ToolRegistry[tool];
    if (!fn) return `Unknown tool: ${tool}\nAvailable: ${names.join(', ')}`;
    return `Tool: ${tool}\nDescription: ${TOOL_DOCS[tool] || 'No description'}\nUsage: <<tool:${tool} {}>>`;
  },

  // Git Tools
  async git_status(args, ctx) {
    const output = execCommand('git status --porcelain -b', ctx.cwd);
    const lines = output.trim().split('\n');

    const result = {
      branch: '',
      staged: [],
      unstaged: [],
      untracked: [],
    };

    for (const line of lines) {
      if (line.startsWith('##')) {
        result.branch = line.slice(3).split('...')[0];
      } else if (line.length >= 2) {
        const staged = line[0];
        const unstaged = line[1];
        const file = line.slice(3);

        if (staged === 'A' || staged === 'M' || staged === 'D' || staged === 'R') {
          result.staged.push({ status: staged, file });
        }
        if (unstaged === 'M' || unstaged === 'D') {
          result.unstaged.push({ status: unstaged, file });
        }
        if (staged === '?' && unstaged === '?') {
          result.untracked.push(file);
        }
      }
    }

    return JSON.stringify(result, null, 2);
  },

  async git_diff(args, ctx) {
    const { staged = false, file, commit } = args || {};

    let cmd = 'git diff';
    if (staged) cmd += ' --staged';
    if (commit) cmd += ` ${commit}`;
    if (file) cmd += ` -- "${file}"`;

    cmd += ' --stat';
    const stats = execCommand(cmd, ctx.cwd);

    // Also get actual diff (limited)
    let diffCmd = 'git diff';
    if (staged) diffCmd += ' --staged';
    if (commit) diffCmd += ` ${commit}`;
    if (file) diffCmd += ` -- "${file}"`;

    const diff = execCommand(diffCmd, ctx.cwd);

    return truncate(`=== Diff Stats ===\n${stats}\n\n=== Changes ===\n${diff}`);
  },

  async git_log(args, ctx) {
    const { count = 10, file } = args || {};

    let cmd = `git log --oneline -${Math.min(count, 50)}`;
    if (file) cmd += ` -- "${file}"`;

    const output = execCommand(cmd, ctx.cwd);
    return output;
  },

  async git_show(args, ctx) {
    const { commit } = args || {};
    assertString(commit, 'commit');

    const output = execCommand(`git show ${commit} --stat`, ctx.cwd);
    return truncate(output);
  },

  // File Tools
  async list_files(args, ctx) {
    const { path: p = '.', pattern } = args || {};
    const dir = safePath(ctx.cwd, p);

    let files = [];

    function walkDir(currentPath, relativePath = '') {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relPath = path.join(relativePath, entry.name);

        // Skip node_modules, .git, etc.
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
          continue;
        }

        if (entry.isDirectory()) {
          walkDir(fullPath, relPath);
        } else {
          if (!pattern || new RegExp(pattern).test(entry.name)) {
            files.push(relPath);
          }
        }
      }
    }

    walkDir(dir);
    return JSON.stringify(files.slice(0, 200), null, 2);
  },

  async read_file(args, ctx) {
    const { path: p, lines } = args || {};
    assertString(p, 'path');
    const full = safePath(ctx.cwd, p);

    let content = fs.readFileSync(full, 'utf8');

    if (lines) {
      const allLines = content.split('\n');
      const [start, end] = String(lines).split('-').map(n => parseInt(n, 10));
      content = allLines.slice(start - 1, end || start).join('\n');
    }

    return truncate(content);
  },

  async search_code(args, ctx) {
    const { pattern, path: p = '.', extension } = args || {};
    assertString(pattern, 'pattern');

    let cmd = `grep -rn "${pattern.replace(/"/g, '\\"')}" "${p}"`;
    if (extension) {
      cmd += ` --include="*.${extension}"`;
    }
    cmd += ' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist';

    try {
      const output = execCommand(cmd, ctx.cwd);
      return truncate(output);
    } catch (e) {
      return 'No matches found';
    }
  },

  async find_files(args, ctx) {
    const { pattern, path: p = '.' } = args || {};
    assertString(pattern, 'pattern');

    const cmd = `find "${p}" -name "${pattern}" -not -path "*/node_modules/*" -not -path "*/.git/*" -type f`;

    try {
      const output = execCommand(cmd, ctx.cwd);
      return output.trim() || 'No files found';
    } catch (e) {
      return 'No files found';
    }
  },

  // Code Quality Tools
  async check_typescript(args, ctx) {
    const { path: p } = args || {};

    try {
      // Check if tsconfig exists
      const tsconfigPath = path.join(ctx.cwd, 'tsconfig.json');
      if (!fs.existsSync(tsconfigPath)) {
        // Try client directory
        const clientTsconfig = path.join(ctx.cwd, 'client', 'tsconfig.json');
        if (fs.existsSync(clientTsconfig)) {
          const output = execCommand('npx tsc --noEmit', path.join(ctx.cwd, 'client'));
          return output || 'No TypeScript errors found';
        }
        return 'No tsconfig.json found';
      }

      const output = execCommand('npx tsc --noEmit', ctx.cwd);
      return output || 'No TypeScript errors found';
    } catch (e) {
      return truncate(e.message);
    }
  },

  async check_eslint(args, ctx) {
    const { path: p = '.' } = args || {};

    try {
      const output = execCommand(`npx eslint "${p}" --format compact`, ctx.cwd);
      return output || 'No ESLint issues found';
    } catch (e) {
      return truncate(e.message);
    }
  },

  async analyze_complexity(args, ctx) {
    const { path: p } = args || {};
    assertString(p, 'path');

    const full = safePath(ctx.cwd, p);
    const content = fs.readFileSync(full, 'utf8');
    const lines = content.split('\n');

    const analysis = {
      file: p,
      totalLines: lines.length,
      codeLines: 0,
      blankLines: 0,
      commentLines: 0,
      functions: [],
      complexity: {
        cyclomaticScore: 0,
        nestingDepth: 0,
        longFunctions: [],
        issues: [],
      },
    };

    let inMultiLineComment = false;
    let currentFunction = null;
    let braceDepth = 0;
    let maxNesting = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Count line types
      if (!line) {
        analysis.blankLines++;
      } else if (line.startsWith('//') || inMultiLineComment) {
        analysis.commentLines++;
        if (line.includes('/*')) inMultiLineComment = true;
        if (line.includes('*/')) inMultiLineComment = false;
      } else {
        analysis.codeLines++;
      }

      // Find function declarations
      const funcMatch = line.match(/(?:async\s+)?(?:function\s+(\w+)|(\w+)\s*[=:]\s*(?:async\s*)?\([^)]*\)\s*(?:=>|{))/);
      if (funcMatch) {
        const funcName = funcMatch[1] || funcMatch[2];
        currentFunction = { name: funcName, startLine: lineNum, braceStart: braceDepth };
        analysis.functions.push(currentFunction);
      }

      // Track nesting
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceDepth += openBraces - closeBraces;
      maxNesting = Math.max(maxNesting, braceDepth);

      // Complexity indicators
      if (/\bif\b|\belse\b|\bfor\b|\bwhile\b|\bswitch\b|\bcatch\b|\b\?\s*:/.test(line)) {
        analysis.complexity.cyclomaticScore++;
      }
    }

    analysis.complexity.nestingDepth = maxNesting;

    // Identify issues
    if (analysis.totalLines > 500) {
      analysis.complexity.issues.push(`File is very long (${analysis.totalLines} lines). Consider splitting.`);
    }
    if (analysis.complexity.cyclomaticScore > 20) {
      analysis.complexity.issues.push(`High cyclomatic complexity (${analysis.complexity.cyclomaticScore}). Consider refactoring.`);
    }
    if (maxNesting > 5) {
      analysis.complexity.issues.push(`Deep nesting detected (depth ${maxNesting}). Consider extracting functions.`);
    }

    return JSON.stringify(analysis, null, 2);
  },

  async find_todos(args, ctx) {
    const { path: p = '.' } = args || {};

    const patterns = ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG'];
    const cmd = `grep -rn "${patterns.join('\\|')}" "${p}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=.git`;

    try {
      const output = execCommand(cmd, ctx.cwd);
      const lines = output.trim().split('\n').filter(Boolean);

      const todos = lines.map(line => {
        const match = line.match(/^([^:]+):(\d+):(.+)$/);
        if (match) {
          return { file: match[1], line: parseInt(match[2]), text: match[3].trim() };
        }
        return null;
      }).filter(Boolean);

      return JSON.stringify({ count: todos.length, items: todos.slice(0, 50) }, null, 2);
    } catch (e) {
      return JSON.stringify({ count: 0, items: [] });
    }
  },

  async check_dependencies(args, ctx) {
    const { path: p = '.' } = args || {};
    const pkgPath = path.join(safePath(ctx.cwd, p), 'package.json');

    if (!fs.existsSync(pkgPath)) {
      return 'No package.json found';
    }

    try {
      const output = execCommand('npm outdated --json', path.dirname(pkgPath));
      const outdated = JSON.parse(output || '{}');

      const summary = Object.entries(outdated).map(([name, info]) => ({
        package: name,
        current: info.current,
        wanted: info.wanted,
        latest: info.latest,
        type: info.type,
      }));

      return JSON.stringify({
        outdatedCount: summary.length,
        packages: summary.slice(0, 20),
      }, null, 2);
    } catch (e) {
      return 'Could not check dependencies: ' + e.message;
    }
  },

  async write_review(args, ctx) {
    const { path: p, content = '' } = args || {};
    assertString(p, 'path');
    const full = safePath(ctx.cwd, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    return `Review saved to ${p}`;
  },
};

// ======== AGENT CONFIGURATION ========
const AGENT_INSTRUCTION = `
You are a Code Review Agent specialized in reviewing code changes and ensuring code quality.

Your expertise:
- Identifying bugs, logic errors, and potential issues
- Checking for security vulnerabilities (XSS, injection, etc.)
- Reviewing code style and best practices
- Analyzing code complexity and maintainability
- Finding performance issues
- Checking TypeScript types and ESLint rules

Your approach:
1. First, check git status to understand what has changed
2. Review the diff to see actual code changes
3. Read relevant files to understand context
4. Run TypeScript and ESLint checks if applicable
5. Analyze code complexity for modified files
6. Check for TODO/FIXME that need attention
7. Generate a comprehensive review report

Review criteria:
- **Correctness**: Does the code do what it's supposed to?
- **Security**: Are there any security vulnerabilities?
- **Performance**: Are there obvious performance issues?
- **Maintainability**: Is the code easy to understand and modify?
- **Style**: Does the code follow project conventions?
- **Tests**: Are changes properly tested?

Output format:
- Markdown reports with clear sections
- Specific line references for issues
- Save reports to ./reviews/ directory
- Include severity levels: critical, warning, suggestion

IMPORTANT: Be constructive and specific. Every issue should have a suggested fix.
`;

const TOOL_INSTRUCTIONS = `
When you need to use a tool, emit the exact syntax:
<<tool:tool_name {"parameter": "value"}>>

Available tools: ${toolListInline()}

Quick reference:
${toolBullets()}

Remember:
- Use strict JSON in tool calls (no trailing commas, quoted keys)
- Start with git_status to understand changes
- Read files before making judgments about code
- Be specific about line numbers when reporting issues
- Save final review to a file
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
      return { content: data.choices?.[0]?.message?.content ?? '', done: true };
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
      const body = { model: this.model, max_tokens: 4096, messages: convo };
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
      return { content: parts.find(p => p?.text)?.text ?? '', done: true };
    } catch (e) {
      throw new AppError(`Anthropic error: ${e.message}`, 'PROVIDER');
    }
  }
}

function inferProviderFromModel(model) {
  const s = (model || '').toLowerCase();
  if (/^(gpt-[345]|o[1-9])/.test(s)) return 'openai';
  if (s.startsWith('claude') || s.includes('sonnet') || s.includes('haiku')) return 'anthropic';
  return '';
}

async function createProvider({ modelSpec, providerHint = '', keys = {}, cwd = process.cwd() }) {
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
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { k++; break; } }
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
      results.push({ name: call.name, error: e.message || 'Tool execution failed' });
    } finally {
      clearTimeout(timeout);
    }
  }
  return results;
}

async function runAgent({ task, model, provider: providerHint, openaiKey, anthropicKey, yolo = false, cwd = process.cwd() }) {
  const provider = await createProvider({ modelSpec: model, providerHint, keys: { openaiKey, anthropicKey }, cwd });
  logger.info(`Provider: ${provider.constructor.name}, Model: ${provider.model}`);

  const messages = [
    { role: 'system', content: FULL_INSTRUCTION },
    { role: 'user', content: task }
  ];

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

  throw new AppError('Max turns reached');
}

// ======== CLI INTERFACE ========
function parseArgs(argv) {
  const args = { task: '', model: '', provider: '', yolo: false, cwd: process.cwd(), openaiKey: '', anthropicKey: '' };
  const positional = [];

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--model' || arg === '-m') args.model = argv[++i];
    else if (arg === '--provider' || arg === '-p') args.provider = argv[++i];
    else if (arg === '--cwd') args.cwd = argv[++i];
    else if (arg === '--yolo' || arg === '-y') args.yolo = true;
    else if (arg === '--openai-key') args.openaiKey = argv[++i];
    else if (arg === '--anthropic-key') args.anthropicKey = argv[++i];
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
Code Review Agent - Automated Code Quality Analysis

Usage:
  node code-review-agent.js "Your review task"
  node code-review-agent.js "Review latest changes" --yolo
  node code-review-agent.js "Check for security issues" --yolo

Options:
  --yolo, -y          Auto-execute tools
  --model, -m         AI model (default: mistral-small)
  --provider, -p      Provider (ollama, openai, anthropic)
  --cwd               Working directory

Examples:
  node code-review-agent.js "Review all staged changes" --yolo
  node code-review-agent.js "Check TypeScript errors and fix suggestions" --yolo
  node code-review-agent.js "Find security vulnerabilities in client/src" --yolo
  node code-review-agent.js "Review changes in the last 3 commits" --yolo
`);
      process.exit(0);
    }

    logger.info('Starting Code Review Agent');
    logger.info(`Task: ${args.task}`);

    const result = await runAgent(args);

    console.log('\n=== Review Complete ===');
    console.log(result);
    console.log('=======================\n');

  } catch (error) {
    if (error instanceof AppError) {
      logger.error(`${error.code}: ${error.message}`);
      process.exit(error.exitCode);
    }
    logger.error('Error:', error.message);
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ToolRegistry, runAgent };
