/**
 * Hub API 客户端 — 类型化的 fetch 封装（全部走相对路径 /api/...）
 *
 * 契约见 worklog.md「API CONTRACT」与 src/lib/types.ts
 */
import type { ImportFormat, ImportResponse, McpServerDto, PluginDto } from "@/lib/types";

// ---------------------------------------------------------------------------
// 响应类型
// ---------------------------------------------------------------------------

export interface ImportLogDto {
  id: string;
  kind: string; // "mcp" | "plugin"
  format: string;
  total: number;
  success: number;
  failed: number;
  createdAt: string;
}

export interface StatsResponse {
  servers: {
    total: number;
    installed: number;
    enabled: number;
    programming: number;
    reverse: number;
  };
  plugins: {
    total: number;
    operit: number;
    anthropic: number;
  };
  logs: ImportLogDto[];
}

export interface McpListResponse {
  servers: McpServerDto[];
}

export interface PluginListResponse {
  plugins: PluginDto[];
}

export interface OkResponse {
  ok: boolean;
  error?: string;
}

export interface AddMcpResponse {
  ok: boolean;
  server?: McpServerDto;
  error?: string;
}

export interface InstallResponse {
  ok: boolean;
  installed: number;
  error?: string;
}

export interface ExportPreviewResponse {
  ok: boolean;
  format: string;
  filename: string;
  content: string;
  error?: string;
}

export interface PluginImportResponse {
  ok: boolean;
  format?: string;
  added?: number;
  names?: string[];
  skipped?: { name: string; reason: string }[];
  error?: string;
}

/** 手动新增 / 编辑 MCP 服务器时提交的载荷 */
export interface McpServerPayload {
  name: string;
  description?: string;
  transport: ImportTransport;
  url?: string;
  command?: string;
  args: string[];
  env: Record<string, string>;
  headers: Record<string, string>;
  enabled: boolean;
  runInSandbox: boolean;
  scope: "agent" | "coding" | "all";
  tags: string[];
}

type ImportTransport = "STDIO" | "HTTP" | "SSE";

// ---------------------------------------------------------------------------
// 基础 fetch 工具
// ---------------------------------------------------------------------------

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (
      data !== null &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
    ) {
      return (data as { error: string }).error;
    }
  } catch {
    // 响应体不是 JSON，忽略
  }
  return `请求失败（HTTP ${res.status}）`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return (await res.json()) as T;
}

/** unknown Error → 可展示消息 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// 端点封装
// ---------------------------------------------------------------------------

export interface McpQueryParams {
  q: string;
  category: "all" | "programming" | "reverse";
  filter: "all" | "installed" | "enabled";
}

export interface PluginQueryParams {
  format: "all" | "operit" | "anthropic-marketplace" | "anthropic-skill";
  q: string;
}

export const hubApi = {
  /** GET /api/stats */
  stats: () => apiGet<StatsResponse>("/api/stats"),

  /** GET /api/mcp */
  mcp: (params: McpQueryParams) => {
    const search = new URLSearchParams();
    if (params.q.trim()) search.set("q", params.q.trim());
    if (params.category !== "all") search.set("category", params.category);
    if (params.filter !== "all") search.set("filter", params.filter);
    const qs = search.toString();
    return apiGet<McpListResponse>(`/api/mcp${qs ? `?${qs}` : ""}`);
  },

  /** POST /api/mcp — 手动新增（installed=true） */
  addMcp: (payload: McpServerPayload) => apiSend<AddMcpResponse>("/api/mcp", "POST", payload),

  /** PATCH /api/mcp/[id] */
  patchMcp: (id: string, patch: Partial<McpServerPayload> & { enabled?: boolean }) =>
    apiSend<OkResponse>(`/api/mcp/${id}`, "PATCH", patch),

  /** DELETE /api/mcp/[id] */
  deleteMcp: (id: string) => apiSend<OkResponse>(`/api/mcp/${id}`, "DELETE"),

  /** POST /api/mcp/install — 目录批量安装 */
  installMcp: (ids: string[]) =>
    apiSend<InstallResponse>("/api/mcp/install", "POST", { ids }),

  /** POST /api/mcp/import */
  importMcp: (text: string) => apiSend<ImportResponse>("/api/mcp/import", "POST", { text }),

  /** GET /api/mcp/export（预览，不下载） */
  exportPreview: (format: string, filter: "installed" | "enabled" | "all") =>
    apiGet<ExportPreviewResponse>(
      `/api/mcp/export?format=${encodeURIComponent(format)}&filter=${filter}`,
    ),

  /** GET /api/plugins */
  plugins: (params: PluginQueryParams) => {
    const search = new URLSearchParams({ format: params.format });
    if (params.q.trim()) search.set("q", params.q.trim());
    return apiGet<PluginListResponse>(`/api/plugins?${search.toString()}`);
  },

  /** PATCH /api/plugins/[id] */
  patchPlugin: (id: string, patch: { enabled?: boolean }) =>
    apiSend<OkResponse>(`/api/plugins/${id}`, "PATCH", patch),

  /** DELETE /api/plugins/[id] */
  deletePlugin: (id: string) => apiSend<OkResponse>(`/api/plugins/${id}`, "DELETE"),

  /** POST /api/plugins/import */
  importPlugins: (text: string) =>
    apiSend<PluginImportResponse>("/api/plugins/import", "POST", { text }),
};

// ---------------------------------------------------------------------------
// 导出下载（blob → 临时 <a> 点击）
// ---------------------------------------------------------------------------

export async function downloadExport(
  format: string,
  filter: "installed" | "enabled" | "all",
): Promise<string> {
  const res = await fetch(
    `/api/mcp/export?format=${encodeURIComponent(format)}&filter=${filter}&download=1`,
  );
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const raw = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1] ?? "";
  let filename = "export.json";
  try {
    filename = raw ? decodeURIComponent(raw) : "export.json";
  } catch {
    filename = raw || "export.json";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}

/** 检测到的格式标签（导入日志 / 导入结果共用） */
export function formatLabel(format: string): string {
  if (format === "mcpServers") return "mcpServers (Claude 通用)";
  if (format === "apex-array") return "apex 数组";
  if (format === "hub-index") return "Hub 目录";
  if (format === "bare-server") return "裸服务器";
  if (format === "claude-marketplace") return "Claude 插件市场";
  if (format === "skill-md") return "SKILL.md";
  return format || "未知";
}

/** ImportFormat 收窄（日志 format 字段为宽松 string） */
export function asImportFormat(format: string): ImportFormat {
  const known: ImportFormat[] = [
    "mcpServers",
    "apex-array",
    "hub-index",
    "bare-server",
    "claude-marketplace",
    "skill-md",
    "unknown",
  ];
  return (known as string[]).includes(format) ? (format as ImportFormat) : "unknown";
}
