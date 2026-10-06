/**
 * Android Guru Agent · MCP & 插件枢纽 — 共享类型定义
 *
 * 与 Android-Guru-Agent (apex-agent) 的 McpServerConfig / McpConfigImport /
 * apex-mcp-hub index.json / Operit mcp_config.json / Anthropic 插件格式保持兼容。
 */

export type McpTransport = "STDIO" | "HTTP" | "SSE";
export type McpScope = "agent" | "coding" | "all";
export type McpCategory = "programming" | "reverse";
export type McpSource = "catalog" | "import" | "manual";

/** apex McpServerConfig（内部规范格式，导出 mcp_servers.json 用） */
export interface McpServerConfig {
  name: string;
  description?: string;
  transport: McpTransport;
  url?: string;
  command?: string;
  args: string[];
  env: Record<string, string>;
  headers: Record<string, string>;
  apiKey?: string;
  enabled: boolean;
  runInSandbox: boolean;
  scope: McpScope;
  category?: McpCategory;
  tags: string[];
  vendor?: string;
  homepage?: string;
  requiresRootfs?: boolean;
}

/** API 返回的 MCP 服务器 DTO */
export interface McpServerDto {
  id: string;
  name: string;
  description: string;
  transport: McpTransport;
  url: string | null;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  headers: Record<string, string>;
  apiKey: string | null;
  enabled: boolean;
  runInSandbox: boolean;
  scope: McpScope;
  category: McpCategory;
  tags: string[];
  vendor: string | null;
  homepage: string | null;
  source: McpSource;
  installed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PluginFormat = "operit" | "anthropic-marketplace" | "anthropic-skill";

/** API 返回的插件 DTO */
export interface PluginDto {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  format: PluginFormat;
  pluginType: string;
  config: Record<string, unknown>;
  skillBody: string | null;
  enabled: boolean;
  installed: boolean;
  sourceUrl: string | null;
  repo: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** 导入来源格式标签 */
export type ImportFormat =
  | "mcpServers" // Claude Desktop / Cursor / Cline / Operit 通用 {"mcpServers":{...}}
  | "apex-array" // apex List<McpServerConfig>
  | "hub-index" // apex-mcp-hub index.json {"servers":[...]}
  | "bare-server" // 单个服务器对象
  | "claude-marketplace" // .claude-plugin/marketplace.json
  | "skill-md" // Anthropic Agent Skills SKILL.md
  | "unknown";

export const IMPORT_FORMAT_LABELS: Record<ImportFormat, string> = {
  "mcpServers": "Claude Desktop / Cursor / Cline / Operit 通用 mcpServers 格式",
  "apex-array": "apex-agent mcp_servers.json（数组格式）",
  "hub-index": "apex-mcp-hub index.json（servers 数组）",
  "bare-server": "单个 MCP 服务器对象",
  "claude-marketplace": "Anthropic Claude 插件市场（.claude-plugin/marketplace.json）",
  "skill-md": "Anthropic Agent Skills（SKILL.md）",
  unknown: "未知格式",
};

export const TRANSPORT_LABELS: Record<McpTransport, string> = {
  STDIO: "STDIO 本地进程",
  HTTP: "HTTP / Streamable HTTP",
  SSE: "SSE 远程",
};

export const SCOPE_LABELS: Record<McpScope, string> = {
  agent: "Agent 模式",
  coding: "Coding 模式",
  all: "全部模式",
};

export const CATEGORY_LABELS: Record<McpCategory, string> = {
  programming: "编程开发",
  reverse: "逆向工程",
};

export const PLUGIN_FORMAT_LABELS: Record<PluginFormat, string> = {
  operit: "Operit 结构插件",
  "anthropic-marketplace": "Anthropic 插件市场",
  "anthropic-skill": "Anthropic Agent Skill",
};

/** 单条导入解析结果 */
export interface ParsedServerEntry {
  server: McpServerConfig;
  error?: string;
}

/** 导入 API 响应 */
export interface ImportResponse {
  ok: boolean;
  format: ImportFormat;
  total: number;
  success: number;
  failed: number;
  added: { name: string; transport: McpTransport }[];
  skipped: { name: string; reason: string }[];
  errors: string[];
}
