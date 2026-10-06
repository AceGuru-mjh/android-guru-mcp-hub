/**
 * 序列化帮助 — DB 行 ↔ DTO / McpServerConfig 转换
 *
 * 约定：args / env / headers / tags / config / errors 在 SQLite 中以 JSON 字符串存储，
 * API 层出入库时负责 JSON.stringify / JSON.parse；Date 一律序列化为 ISO 字符串。
 */

import type { ImportLog, McpServer, Plugin } from "@prisma/client";
import type {
  McpCategory,
  McpScope,
  McpServerConfig,
  McpServerDto,
  McpSource,
  McpTransport,
  PluginDto,
  PluginFormat,
} from "./types";

/** 宽松 JSON.parse：失败时返回 fallback，绝不抛异常 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined || raw === "") return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** ImportLog 行 → 精简 DTO（errors 不返回，列表展示用不到） */
export function logToDto(row: ImportLog): {
  id: string;
  kind: string;
  format: string;
  total: number;
  success: number;
  failed: number;
  createdAt: string;
} {
  return {
    id: row.id,
    kind: row.kind,
    format: row.format,
    total: row.total,
    success: row.success,
    failed: row.failed,
    createdAt: row.createdAt.toISOString(),
  };
}

/** McpServer DB 行 → API DTO（解析 JSON 字段 + Date → ISO） */
export function serverToDto(row: McpServer): McpServerDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    transport: row.transport as McpTransport,
    url: row.url,
    command: row.command,
    args: safeJsonParse<string[]>(row.args, []),
    env: safeJsonParse<Record<string, string>>(row.env, {}),
    headers: safeJsonParse<Record<string, string>>(row.headers, {}),
    apiKey: row.apiKey,
    enabled: row.enabled,
    runInSandbox: row.runInSandbox,
    scope: row.scope as McpScope,
    category: row.category as McpCategory,
    tags: safeJsonParse<string[]>(row.tags, []),
    vendor: row.vendor,
    homepage: row.homepage,
    source: row.source as McpSource,
    installed: row.installed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Plugin DB 行 → API DTO（config 解析为对象，skillBody 原样返回） */
export function pluginToDto(row: Plugin): PluginDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.version,
    author: row.author,
    format: row.format as PluginFormat,
    pluginType: row.pluginType,
    config: safeJsonParse<Record<string, unknown>>(row.config, {}),
    skillBody: row.skillBody,
    enabled: row.enabled,
    installed: row.installed,
    sourceUrl: row.sourceUrl,
    repo: row.repo,
    tags: safeJsonParse<string[]>(row.tags, []),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** McpServer DB 行 → apex McpServerConfig（导出四大格式用） */
export function rowToConfig(row: McpServer): McpServerConfig {
  return {
    name: row.name,
    description: row.description,
    transport: row.transport as McpTransport,
    url: row.url ?? undefined,
    command: row.command ?? undefined,
    args: safeJsonParse<string[]>(row.args, []),
    env: safeJsonParse<Record<string, string>>(row.env, {}),
    headers: safeJsonParse<Record<string, string>>(row.headers, {}),
    apiKey: row.apiKey ?? undefined,
    enabled: row.enabled,
    runInSandbox: row.runInSandbox,
    scope: row.scope as McpScope,
    category: row.category as McpCategory,
    tags: safeJsonParse<string[]>(row.tags, []),
    vendor: row.vendor ?? undefined,
    homepage: row.homepage ?? undefined,
    // 与 hub index 约定一致：STDIO 且沙箱运行 → 视为需要 rootfs
    requiresRootfs: row.transport === "STDIO" ? row.runInSandbox : false,
  };
}

/** 警告级错误前缀（导入时仍可入库，仅在 errors 中提示） */
export const WARNING_ERROR_PREFIXES = ["EMPTY_ARGS"];

/** 判断解析错误是否只是警告（如 npx 且 args 为空）：警告级条目仍可导入 */
export function isWarningError(err: string | undefined): boolean {
  if (!err) return false;
  return WARNING_ERROR_PREFIXES.some((p) => err.startsWith(p));
}

/** McpServerConfig → Prisma 可写入字段（args/env/headers/tags 序列化为 JSON 字符串） */
export function mcpConfigToDbData(cfg: McpServerConfig): {
  name: string;
  description: string;
  transport: string;
  url: string | null;
  command: string | null;
  args: string;
  env: string;
  headers: string;
  apiKey: string | null;
  enabled: boolean;
  runInSandbox: boolean;
  scope: string;
  category: string;
  tags: string;
  vendor: string | null;
  homepage: string | null;
} {
  return {
    name: cfg.name.trim(),
    description: cfg.description ?? "",
    transport: cfg.transport,
    url: cfg.url ?? null,
    command: cfg.command ?? null,
    args: JSON.stringify(Array.isArray(cfg.args) ? cfg.args : []),
    env: JSON.stringify(cfg.env && typeof cfg.env === "object" ? cfg.env : {}),
    headers: JSON.stringify(cfg.headers && typeof cfg.headers === "object" ? cfg.headers : {}),
    apiKey: cfg.apiKey ?? null,
    enabled: cfg.enabled === true,
    runInSandbox: cfg.runInSandbox === true,
    scope: cfg.scope ?? "all",
    category: cfg.category ?? "programming",
    tags: JSON.stringify(Array.isArray(cfg.tags) ? cfg.tags : []),
    vendor: cfg.vendor ?? null,
    homepage: cfg.homepage ?? null,
  };
}
