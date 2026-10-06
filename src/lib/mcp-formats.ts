/**
 * MCP 配置格式库 — 多格式检测 / 解析 / 导出
 *
 * 兼容 Android-Guru-Agent (apex-agent) McpConfigImport.kt 的推断规则：
 *  - mcpServers 包装：Claude Desktop / Cursor / Cline / Operit mcp_config.json 通用格式
 *  - 数组：apex mcp_servers.json（List<McpServerConfig>）
 *  - {"servers":[...]}：apex-mcp-hub index.json
 *  - 单对象：裸服务器（自动包装）
 *  - .claude-plugin/marketplace.json：Anthropic 插件市场
 *  - SKILL.md：Anthropic Agent Skills（YAML frontmatter）
 *
 * 传输层推断（与 apex 一致）：
 *  - command 非空 → STDIO（command + url 同时存在且无 type → 报错）
 *  - type = streamable_http | http → HTTP
 *  - type = sse → SSE
 *  - 仅 url → HTTP
 */

import type {
  ImportFormat,
  McpCategory,
  McpServerConfig,
  McpScope,
  McpTransport,
  ParsedServerEntry,
} from "./types";

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeTransport(t: unknown): McpTransport | null {
  if (typeof t !== "string") return null;
  const s = t.trim().toLowerCase();
  if (s === "stdio") return "STDIO";
  if (s === "http" || s === "streamable_http" || s === "streamable-http") return "HTTP";
  if (s === "sse") return "SSE";
  return null;
}

function inferScope(v: unknown): McpScope {
  if (v === "agent" || v === "coding" || v === "all") return v;
  return "all";
}

function inferCategory(v: unknown): McpCategory {
  if (v === "programming" || v === "reverse") return v;
  return "programming";
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function toStringRecord(v: unknown): Record<string, string> {
  if (!isRecord(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string") out[k] = val;
    else if (typeof val === "number" || typeof val === "boolean") out[k] = String(val);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 格式检测
// ---------------------------------------------------------------------------

/** 检测文本所属的配置格式（MCP 优先，其次 Anthropic 插件格式） */
export function detectFormat(text: string): ImportFormat {
  const trimmed = text.trim();
  if (!trimmed) return "unknown";

  // SKILL.md：YAML frontmatter 且包含 name/description
  if (/^---\s*\n[\s\S]*?\n---/.test(trimmed)) {
    const fm = trimmed.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? "";
    if (/^\s*name\s*:/m.test(fm) && /^\s*description\s*:/m.test(fm)) return "skill-md";
  }

  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return "unknown";
  }

  if (Array.isArray(json)) return "apex-array";
  if (!isRecord(json)) return "unknown";

  if ("mcpServers" in json && isRecord(json.mcpServers)) return "mcpServers";
  if ("servers" in json && Array.isArray(json.servers)) return "hub-index";

  // Anthropic .claude-plugin/marketplace.json：{"name","owner":{"name"},"plugins":[...]}
  if ("plugins" in json && Array.isArray(json.plugins)) return "claude-marketplace";

  // 裸服务器对象
  if ("command" in json || "url" in json || "transport" in json) return "bare-server";

  return "unknown";
}

// ---------------------------------------------------------------------------
// 服务器条目解析（对齐 apex McpConfigImport 推断规则）
// ---------------------------------------------------------------------------

function parseServerEntry(name: string, raw: unknown): ParsedServerEntry {
  if (!isRecord(raw)) return { server: emptyServer(name), error: "条目不是对象" };
  if (typeof name !== "string" || !name.trim()) {
    return { server: emptyServer(""), error: "NAME_BLANK：服务器名称为空" };
  }

  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  const command = typeof raw.command === "string" ? raw.command.trim() : "";
  const explicitType = normalizeTransport(raw.type ?? raw.transport);
  const args = toStringArray(raw.args);
  const env = toStringRecord(raw.env);
  const headers = toStringRecord(raw.headers);

  let transport: McpTransport;
  if (explicitType) {
    transport = explicitType;
  } else if (command) {
    transport = "STDIO";
  } else if (url) {
    transport = "HTTP";
  } else {
    return { server: emptyServer(name), error: "STDIO_NO_COMMAND：缺少 command 或 url，无法推断传输层" };
  }

  // 与 apex 一致的显式冲突校验
  if (!explicitType && command && url) {
    return {
      server: emptyServer(name),
      error: "AMBIGUOUS：同时提供 command 与 url 但未声明 type（http|sse|stdio）",
    };
  }

  if (transport === "STDIO" && !command) {
    return { server: emptyServer(name), error: "STDIO_NO_COMMAND：STDIO 需要非空 command" };
  }
  if ((transport === "HTTP" || transport === "SSE") && !url) {
    return { server: emptyServer(name), error: "REMOTE_NO_URL：远程服务器缺少 url" };
  }
  if ((transport === "HTTP" || transport === "SSE") && url && !/^https?:\/\//i.test(url)) {
    return { server: emptyServer(name), error: `REMOTE_BAD_URL：url 必须以 http/https 开头（${url}）` };
  }
  if (transport === "STDIO" && command === "npx" && args.length === 0) {
    return {
      server: buildServer(name, raw, "STDIO", url, command, args, env, headers),
      error: "EMPTY_ARGS：command 为 npx 但 args 为空（警告，仍可导入）",
    };
  }

  return { server: buildServer(name, raw, transport, url, command, args, env, headers) };
}

function emptyServer(name: string): McpServerConfig {
  return {
    name,
    transport: "STDIO",
    args: [],
    env: {},
    headers: {},
    enabled: false,
    runInSandbox: false,
    scope: "all",
    tags: [],
  };
}

function buildServer(
  name: string,
  raw: Record<string, unknown>,
  transport: McpTransport,
  url: string,
  command: string,
  args: string[],
  env: Record<string, string>,
  headers: Record<string, string>,
): McpServerConfig {
  const stdio = transport === "STDIO";
  return {
    name,
    description: typeof raw.description === "string" ? raw.description : "",
    transport,
    url: url || undefined,
    command: stdio ? command : undefined,
    args,
    env,
    headers,
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : undefined,
    // Operit 约定：导入的 STDIO 强制沙箱运行 + 默认不启用（安装 ≠ 启动）
    enabled: raw.disabled === true ? false : raw.enabled === true,
    runInSandbox: raw.runInSandbox === true || raw.run_in_sandbox === true,
    scope: inferScope(raw.scope),
    category: inferCategory(raw.category),
    tags: toStringArray(raw.tags),
    vendor: typeof raw.vendor === "string" ? raw.vendor : undefined,
    homepage: typeof raw.homepage === "string" ? raw.homepage : undefined,
    requiresRootfs: raw.requiresRootfs === true,
  };
}

// ---------------------------------------------------------------------------
// MCP 配置文本 → 服务器列表（多格式统一入口）
// ---------------------------------------------------------------------------

export function parseMcpText(text: string): { format: ImportFormat; entries: ParsedServerEntry[] } {
  const format = detectFormat(text);
  if (format === "unknown") return { format, entries: [] };

  let json: unknown;
  try {
    json = JSON.parse(text.trim());
  } catch (e) {
    return { format: "unknown", entries: [] };
  }

  const entries: ParsedServerEntry[] = [];

  if (format === "mcpServers") {
    const servers = (json as Record<string, unknown>).mcpServers as Record<string, unknown>;
    for (const [name, cfg] of Object.entries(servers)) {
      entries.push(parseServerEntry(name, cfg));
    }
  } else if (format === "apex-array") {
    for (const item of json as unknown[]) {
      if (isRecord(item) && typeof item.name === "string") {
        entries.push(parseServerEntry(item.name, item));
      } else {
        entries.push({ server: emptyServer(""), error: "数组条目缺少 name 字段" });
      }
    }
  } else if (format === "hub-index") {
    for (const item of (json as Record<string, unknown>).servers as unknown[]) {
      if (isRecord(item) && typeof item.name === "string") {
        entries.push(parseServerEntry(item.name, item));
      } else {
        entries.push({ server: emptyServer(""), error: "servers 条目缺少 name 字段" });
      }
    }
  } else if (format === "bare-server") {
    entries.push(parseServerEntry((json as Record<string, unknown>).name as string ?? "", json));
  }

  return { format, entries };
}

// ---------------------------------------------------------------------------
// 导出器：McpServerConfig[] → 各目标格式
// ---------------------------------------------------------------------------

/** Claude Desktop / Cursor / Cline / Operit 通用格式（Anthropic 官方 MCP 配置格式） */
export function toClaudeFormat(servers: McpServerConfig[]): string {
  const mcpServers: Record<string, Record<string, unknown>> = {};
  for (const s of servers) {
    const entry: Record<string, unknown> = {};
    if (s.transport === "STDIO") {
      entry.command = s.command;
      entry.args = s.args;
      if (Object.keys(s.env).length) entry.env = s.env;
    } else {
      entry.type = s.transport === "SSE" ? "sse" : "streamable_http";
      entry.url = s.url;
      if (Object.keys(s.headers).length) entry.headers = s.headers;
    }
    if (s.scope && s.scope !== "all") entry.scope = s.scope;
    if (s.runInSandbox) entry.runInSandbox = true;
    mcpServers[s.name] = entry;
  }
  return JSON.stringify({ mcpServers }, null, 2);
}

/** apex-agent mcp_servers.json（List<McpServerConfig>） */
export function toApexFormat(servers: McpServerConfig[]): string {
  return JSON.stringify(
    servers.map((s) => ({
      name: s.name,
      ...(s.description ? { description: s.description } : {}),
      ...(s.transport !== "STDIO" && s.url ? { url: s.url } : {}),
      transport: s.transport,
      ...(s.command ? { command: s.command } : {}),
      args: s.args,
      env: s.env,
      ...(Object.keys(s.headers).length ? { headers: s.headers } : {}),
      enabled: s.enabled,
      ...(s.transport === "STDIO" ? { runInSandbox: s.runInSandbox } : {}),
      scope: s.scope,
    })),
    null,
    2,
  );
}

/** apex-mcp-hub index.json（{"servers":[...]}，可整仓下载后作为目录源使用） */
export function toHubFormat(servers: McpServerConfig[]): string {
  return JSON.stringify(
    {
      version: 1,
      servers: servers.map((s) => ({
        name: s.name,
        description: s.description ?? "",
        transport: s.transport,
        url: s.transport === "STDIO" ? "" : s.url ?? "",
        command: s.transport === "STDIO" ? s.command ?? "" : "",
        args: s.transport === "STDIO" ? s.args : [],
        env: s.env,
        runInSandbox: s.transport === "STDIO" ? s.runInSandbox : false,
        enabled: false, // 安装 ≠ 启动
        scope: s.scope,
        requiresRootfs: s.transport === "STDIO" && s.runInSandbox,
        ...(s.vendor ? { vendor: s.vendor } : {}),
        tags: s.tags,
      })),
    },
    null,
    2,
  );
}

/** Operit mcp_config.json（STDIO 强制沙箱 + 默认停用，Operit 生态约定） */
export function toOperitFormat(servers: McpServerConfig[]): string {
  const mcpServers: Record<string, Record<string, unknown>> = {};
  for (const s of servers) {
    const entry: Record<string, unknown> = {};
    if (s.transport === "STDIO") {
      entry.command = s.command;
      entry.args = s.args;
      if (Object.keys(s.env).length) entry.env = s.env;
      entry.runInSandbox = true; // Operit：STDIO 一律沙箱
    } else {
      entry.type = s.transport === "SSE" ? "sse" : "streamable_http";
      entry.url = s.url;
      if (Object.keys(s.headers).length) entry.headers = s.headers;
    }
    entry.disabled = false;
    mcpServers[s.name] = entry;
  }
  return JSON.stringify({ mcpServers }, null, 2);
}

export const EXPORT_FORMATS = [
  {
    id: "claude",
    label: "Claude Desktop / Anthropic",
    file: "claude_mcp.json",
    desc: "Anthropic 官方 mcpServers 格式，适用于 Claude Desktop / Claude Code / Cursor / Cline",
    make: toClaudeFormat,
  },
  {
    id: "apex",
    label: "apex-agent (mcp_servers.json)",
    file: "mcp_servers.json",
    desc: "Android-Guru-Agent 内部持久化格式，直接放入 <filesDir>/mcp_config/ 即可加载",
    make: toApexFormat,
  },
  {
    id: "hub",
    label: "apex-mcp-hub (index.json)",
    file: "index.json",
    desc: "官方 Hub 目录格式，可作为自建 MCP 仓库索引，App 内 Hub 源可直接拉取",
    make: toHubFormat,
  },
  {
    id: "operit",
    label: "Operit (mcp_config.json)",
    file: "mcp_config.json",
    desc: "Operit 生态约定格式，STDIO 强制沙箱运行，放入 Operit 插件仓库根目录即可",
    make: toOperitFormat,
  },
] as const;

export type ExportFormatId = (typeof EXPORT_FORMATS)[number]["id"];

// ---------------------------------------------------------------------------
// Anthropic 插件格式解析
// ---------------------------------------------------------------------------

export interface ParsedMarketplacePlugin {
  name: string;
  source: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
  sourceUrl: string | null;
  config: Record<string, unknown>;
}

/** 解析 .claude-plugin/marketplace.json */
export function parseMarketplaceJson(text: string): ParsedMarketplacePlugin[] {
  const json = JSON.parse(text.trim());
  if (!isRecord(json) || !Array.isArray(json.plugins)) throw new Error("不是合法的 marketplace.json（缺少 plugins 数组）");
  const ownerName = isRecord(json.owner) && typeof json.owner.name === "string" ? json.owner.name : "anthropic";
  const out: ParsedMarketplacePlugin[] = [];
  for (const p of json.plugins) {
    if (!isRecord(p)) continue;
    const name = typeof p.name === "string" ? p.name : "";
    const source = typeof p.source === "string" ? p.source : "";
    if (!name || !source) continue;
    out.push({
      name,
      source,
      description: typeof p.description === "string" ? p.description : "",
      author: ownerName,
      version: typeof p.version === "string" ? p.version : "1.0.0",
      tags: toStringArray(p.categories ?? p.tags),
      sourceUrl: typeof (p as Record<string, unknown>).homepage === "string" ? ((p as Record<string, unknown>).homepage as string) : null,
      config: p as Record<string, unknown>,
    });
  }
  return out;
}

export interface ParsedSkill {
  name: string;
  description: string;
  license: string;
  allowedTools: string[];
  body: string;
}

/** 解析 Anthropic Agent Skills SKILL.md（YAML frontmatter） */
export function parseSkillMd(text: string): ParsedSkill {
  const m = text.trim().match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) throw new Error("不是合法的 SKILL.md（缺少 YAML frontmatter）");
  const [, fm, body] = m;
  const fields: Record<string, string> = {};
  for (const line of fm.split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (kv) fields[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  if (!fields.name || !fields.description) throw new Error("SKILL.md frontmatter 缺少 name 或 description");
  let allowedTools: string[] = [];
  const at = fm.match(/^allowed-tools\s*:\s*\[(.*)\]\s*$/m);
  if (at) allowedTools = at[1].split(",").map((s) => s.trim()).filter(Boolean);
  return {
    name: fields.name,
    description: fields.description,
    license: fields.license || "MIT",
    allowedTools,
    body: body.trim(),
  };
}
