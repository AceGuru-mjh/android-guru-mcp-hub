"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  Download,
  Eye,
  FileJson,
  FolderDown,
  Loader2,
  Package,
  Wand2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ImportFormat, ImportResponse } from "@/lib/types";
import { IMPORT_FORMAT_LABELS } from "@/lib/types";
import {
  asImportFormat,
  downloadExport,
  errorMessage,
  hubApi,
  type ExportPreviewResponse,
} from "@/components/hub/api";
import { TransportBadge } from "@/components/hub/badges";
import { CopyButton } from "@/components/hub/copy-button";
import { JsonBlock } from "@/components/hub/json-block";

// ---------------------------------------------------------------------------
// 示例数据（每种格式使用不同 name，避免重复导入被跳过）
// ---------------------------------------------------------------------------

const SAMPLE_TEXTS: Record<string, string> = {
  claude: JSON.stringify(
    {
      mcpServers: {
        "everything-claude": {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-everything"],
        },
        "research-claude": {
          type: "streamable_http",
          url: "https://mcp.example.com/research",
        },
      },
    },
    null,
    2,
  ),
  apex: JSON.stringify(
    [
      {
        name: "everything-apex",
        transport: "STDIO",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-everything"],
        env: {},
        enabled: false,
        runInSandbox: true,
        scope: "all",
      },
    ],
    null,
    2,
  ),
  hub: JSON.stringify(
    {
      servers: [
        {
          name: "everything-hub",
          description: "测试服务器（Hub 目录格式）",
          transport: "STDIO",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-everything"],
        },
      ],
    },
    null,
    2,
  ),
  bare: JSON.stringify(
    {
      name: "everything-bare",
      transport: "STDIO",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-everything"],
    },
    null,
    2,
  ),
};

const SAMPLE_CHIPS = [
  { key: "claude", label: "Claude 格式" },
  { key: "apex", label: "apex 数组" },
  { key: "hub", label: "Hub 目录" },
  { key: "bare", label: "裸服务器" },
] as const;

const SUPPORTED_FORMATS: ImportFormat[] = [
  "mcpServers",
  "apex-array",
  "hub-index",
  "bare-server",
  "claude-marketplace",
  "skill-md",
];

const EXPORT_CARDS = [
  {
    id: "claude",
    label: "Claude Desktop / Anthropic",
    file: "claude_mcp.json",
    desc: "Anthropic 官方 mcpServers 格式，Claude Desktop / Claude Code / Cursor / Cline 通用",
  },
  {
    id: "apex",
    label: "apex-agent mcp_servers.json",
    file: "mcp_servers.json",
    desc: "Android-Guru-Agent 内部持久化格式，放入 <filesDir>/mcp_config/ 即可加载",
  },
  {
    id: "hub",
    label: "apex-mcp-hub index.json",
    file: "index.json",
    desc: "官方 Hub 目录格式，可作为自建 MCP 仓库索引供 App 拉取",
  },
  {
    id: "operit",
    label: "Operit mcp_config.json",
    file: "mcp_config.json",
    desc: "Operit 生态约定格式，STDIO 强制沙箱运行",
  },
] as const;

type ExportFilter = "installed" | "enabled" | "all";

/** Tab 4 · 导入 / 导出（核心枢纽） */
export function ImportExportTab() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <ImportSection />
      <ExportSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 导入区
// ---------------------------------------------------------------------------

function ImportSection() {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function handleImport() {
    if (!text.trim()) {
      toast.error("请先粘贴 MCP 配置内容");
      return;
    }
    setImporting(true);
    try {
      const res = await hubApi.importMcp(text);
      setResult(res);
      const skipped = res.skipped.length;
      if (res.ok) {
        toast.success(
          `导入完成：成功 ${res.success} · 跳过 ${skipped} · 失败 ${res.failed}`,
          { description: `检测格式：${IMPORT_FORMAT_LABELS[asImportFormat(res.format)]}` },
        );
      } else {
        toast.warning("导入完成，但存在失败项", { description: `格式：${res.format}` });
      }
      await queryClient.invalidateQueries({ queryKey: ["mcp"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      toast.error("导入失败", { description: errorMessage(e) });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card className="py-6">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="size-4 text-emerald-500" />
          一键导入
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          粘贴任意支持格式的 JSON / SKILL.md，自动检测格式并批量入库（同名跳过，STDIO 强制沙箱 + 默认停用）
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 示例 chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground/70">{"// 填充示例"}</span>
          {SAMPLE_CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => {
                setText(SAMPLE_TEXTS[chip.key]);
                setResult(null);
              }}
              className="rounded-md border border-border bg-secondary/50 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* 终端风格输入区 */}
        <div className="overflow-hidden rounded-lg border border-zinc-700/60 bg-zinc-950 shadow-inner">
          <div className="flex items-center gap-1.5 border-b border-zinc-800 px-3 py-2">
            <span className="size-2.5 rounded-full bg-red-500/70" aria-hidden />
            <span className="size-2.5 rounded-full bg-amber-500/70" aria-hidden />
            <span className="size-2.5 rounded-full bg-emerald-500/70" aria-hidden />
            <span className="ml-2 font-mono text-[10px] text-zinc-500">import.config.json</span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'{\n  "mcpServers": {\n    "my-server": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-everything"]\n    }\n  }\n}'}
            spellCheck={false}
            className="min-h-48 resize-y rounded-none border-0 bg-transparent font-mono text-xs leading-relaxed text-emerald-50 caret-emerald-400 placeholder:text-zinc-600 focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        <Button
          onClick={() => void handleImport()}
          disabled={importing}
          className="h-11 w-full bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
        >
          {importing ? <Loader2 className="animate-spin" /> : <Package />}
          {importing ? "正在解析并导入…" : "一键导入"}
        </Button>

        {/* 导入结果 */}
        {result ? <ImportResultPanel result={result} /> : null}

        {/* 支持格式说明 */}
        <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
          <p className="mb-2 font-mono text-[10px] text-muted-foreground/70">
            {"// 支持的导入格式（自动检测）"}
          </p>
          <ul className="space-y-1.5">
            {SUPPORTED_FORMATS.map((format) => (
              <li key={format} className="flex items-start gap-2 text-xs">
                <BookOpenCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                <span className="font-mono text-emerald-700 dark:text-emerald-400">{format}</span>
                <span className="text-muted-foreground">— {IMPORT_FORMAT_LABELS[format]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground/80">
            提示：claude-marketplace 与 skill-md 格式请在「插件中心」导入。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ImportResultPanel({ result }: { result: ImportResponse }) {
  const skipped = result.skipped.length;
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 font-mono text-[10px] text-emerald-600 dark:text-emerald-400"
        >
          <FileJson className="size-3" /> {IMPORT_FORMAT_LABELS[asImportFormat(result.format)]}
        </Badge>
        <span className="font-mono text-xs font-semibold">
          成功{" "}
          <span className="text-emerald-600 dark:text-emerald-400">{result.success}</span>
          {" · "}
          跳过 <span className="text-amber-600 dark:text-amber-400">{skipped}</span>
          {" · "}
          失败 <span className="text-destructive">{result.failed}</span>
        </span>
      </div>

      {(result.added.length > 0 || skipped > 0 || result.errors.length > 0) && (
        <div className="hub-scroll mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {result.added.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5"
            >
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
              <span className="min-w-0 truncate font-mono text-xs">{item.name}</span>
              <TransportBadge transport={item.transport} className="ml-auto" />
            </div>
          ))}
          {result.skipped.map((item) => (
            <div
              key={`skip-${item.name}`}
              className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5"
            >
              <AlertCircle className="size-3.5 shrink-0 text-amber-500" />
              <span className="min-w-0 truncate font-mono text-xs">{item.name}</span>
              <span className="ml-auto shrink-0 text-[11px] text-amber-600 dark:text-amber-400">
                {item.reason}
              </span>
            </div>
          ))}
          {result.errors.map((err) => (
            <div
              key={`err-${err}`}
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5"
            >
              <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              <span className="min-w-0 break-all text-[11px] text-destructive">{err}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 导出区
// ---------------------------------------------------------------------------

function ExportSection() {
  const [filter, setFilter] = useState<ExportFilter>("installed");
  const [preview, setPreview] = useState<ExportPreviewResponse | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handlePreview(formatId: string) {
    setPreviewingId(formatId);
    try {
      const res = await hubApi.exportPreview(formatId, filter);
      if (!res.ok) throw new Error(res.error ?? "预览失败");
      setPreview(res);
    } catch (e) {
      toast.error("生成预览失败", { description: errorMessage(e) });
    } finally {
      setPreviewingId(null);
    }
  }

  async function handleDownload(formatId: string) {
    setDownloadingId(formatId);
    try {
      const filename = await downloadExport(formatId, filter);
      toast.success(`已下载 ${filename}`);
    } catch (e) {
      toast.error("下载失败", { description: errorMessage(e) });
    } finally {
      setDownloadingId(null);
    }
  }

  const filterLabel =
    filter === "installed" ? "已安装" : filter === "enabled" ? "仅启用" : "全部目录";

  return (
    <div className="space-y-6">
      <Card className="py-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderDown className="size-4 text-emerald-500" />
            下载 / 导出
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">导出范围</span>
            <Select value={filter} onValueChange={(v) => setFilter(v as ExportFilter)}>
              <SelectTrigger size="sm" className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="installed">已安装</SelectItem>
                <SelectItem value="enabled">仅启用</SelectItem>
                <SelectItem value="all">全部目录</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {EXPORT_CARDS.map((card) => (
            <div
              key={card.id}
              className="rounded-lg border border-border/70 bg-secondary/25 p-3.5 transition-colors hover:border-emerald-500/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{card.label}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                    {card.file}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={previewingId !== null}
                    onClick={() => void handlePreview(card.id)}
                  >
                    {previewingId === card.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                    预览
                  </Button>
                  <Button
                    size="sm"
                    disabled={downloadingId !== null}
                    onClick={() => void handleDownload(card.id)}
                    className="bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                  >
                    {downloadingId === card.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    下载
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{card.desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card className="border-emerald-500/25 bg-emerald-500/[0.04] py-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            <span className="font-mono text-emerald-500">❯</span> 下载后如何使用
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {[
              {
                title: "Claude Desktop / Cursor / Cline",
                desc: "打开下载的 claude_mcp.json，把 mcpServers 字段合并进 claude_desktop_config.json 后重启应用",
              },
              {
                title: "apex-agent（Android-Guru-Agent）",
                desc: "把 mcp_servers.json 推送到设备 <filesDir>/mcp_config/ 目录，Agent 启动时自动加载",
              },
              {
                title: "Operit",
                desc: "把 mcp_config.json 放入 Operit 插件仓库根目录，STDIO 服务器将在 PRoot 沙箱内执行",
              },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium">{step.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* 预览弹窗 */}
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 font-mono text-base">
              <Eye className="size-4 text-emerald-500" />
              {preview?.filename}
            </DialogTitle>
            <DialogDescription>
              导出范围：{filterLabel} · 目标格式：{preview?.format}
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="space-y-2">
              <div className="flex justify-end">
                <CopyButton text={preview.content} label="复制内容" />
              </div>
              <JsonBlock value={preview.content} className="max-h-[55vh]" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
