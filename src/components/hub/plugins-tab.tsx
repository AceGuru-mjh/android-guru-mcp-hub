"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PackagePlus,
  Puzzle,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PluginDto, PluginFormat } from "@/lib/types";
import { PLUGIN_FORMAT_LABELS } from "@/lib/types";
import {
  errorMessage,
  hubApi,
  type PluginImportResponse,
  type PluginListResponse,
  type PluginQueryParams,
} from "@/components/hub/api";
import { useDebounce } from "@/components/hub/use-debounce";
import { PluginFormatBadge } from "@/components/hub/badges";
import { CopyButton } from "@/components/hub/copy-button";
import { JsonBlock } from "@/components/hub/json-block";

type FormatFilter = PluginQueryParams["format"];

const FORMAT_OPTIONS: { value: FormatFilter; label: string }[] = [
  { value: "all", label: "全部插件" },
  { value: "operit", label: "Operit 结构" },
  { value: "anthropic-marketplace", label: "Anthropic 插件市场" },
  { value: "anthropic-skill", label: "Agent Skills" },
];

const PLUGIN_SAMPLES: Record<string, string> = {
  operit: JSON.stringify(
    {
      mcpServers: {
        "operit-demo-import": {
          command: "npx",
          args: ["-y", "operit-demo-server"],
        },
      },
    },
    null,
    2,
  ),
  skill: [
    "---",
    "name: demo-skill",
    "description: 演示 Agent Skill：说明何时使用以及如何执行的分步指南。",
    "license: MIT",
    "---",
    "",
    "# 演示技能",
    "",
    "## 何时使用",
    "- 需要验证 SKILL.md 导入流程时",
    "- 需要 Agent 按固定 SOP 执行任务时",
    "",
    "## 操作指南",
    "1. 解析 YAML frontmatter（name / description）",
    "2. 注册到插件中心并启用",
    "3. 在 Agent 对话中触发对应能力",
  ].join("\n"),
};

/** Tab 5 · 插件中心：Operit / Anthropic 插件与 Skills 管理 */
export function PluginsTab() {
  const queryClient = useQueryClient();
  const [format, setFormat] = useState<FormatFilter>("all");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [detail, setDetail] = useState<PluginDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PluginDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // 导入区状态
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<PluginImportResponse | null>(null);

  const queryParams = useMemo(() => ({ format, q: debouncedQ }), [format, debouncedQ]);
  const queryKey = ["plugins", queryParams];
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => hubApi.plugins(queryParams),
  });
  const plugins = data?.plugins ?? [];

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["plugins"] });
    await queryClient.invalidateQueries({ queryKey: ["stats"] });
  }

  async function toggleEnabled(plugin: PluginDto, next: boolean) {
    setPendingIds((prev) => new Set(prev).add(plugin.id));
    queryClient.setQueryData<PluginListResponse>(queryKey, (old) =>
      old
        ? {
            plugins: old.plugins.map((p) => (p.id === plugin.id ? { ...p, enabled: next } : p)),
          }
        : old,
    );
    try {
      await hubApi.patchPlugin(plugin.id, { enabled: next });
      toast.success(`${plugin.name} ${next ? "已启用" : "已停用"}`);
      await refresh();
    } catch (e) {
      toast.error(`操作失败`, { description: errorMessage(e) });
      await refetch();
    } finally {
      setPendingIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(plugin.id);
        return nextSet;
      });
    }
  }

  async function handleImport() {
    if (!importText.trim()) {
      toast.error("请先粘贴插件配置内容");
      return;
    }
    setImporting(true);
    try {
      const res = await hubApi.importPlugins(importText);
      setImportResult(res);
      if (res.ok) {
        toast.success(`插件导入完成：新增 ${res.added ?? 0} 个`, {
          description: `检测格式：${res.format ?? "unknown"}`,
        });
      } else {
        toast.error("插件导入失败", { description: res.error ?? "未知错误" });
      }
      await refresh();
    } catch (e) {
      toast.error("插件导入失败", { description: errorMessage(e) });
    } finally {
      setImporting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await hubApi.deletePlugin(deleteTarget.id);
      toast.success(`已删除插件 ${deleteTarget.name}`);
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      toast.error("删除失败", { description: errorMessage(e) });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 导入插件 */}
      <Card className="py-6">
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <PackagePlus className="size-4 text-emerald-500" />
              导入插件
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground/70">{"// 填充示例"}</span>
              {(
                [
                  { key: "operit", label: "Operit 示例" },
                  { key: "skill", label: "SKILL.md 示例" },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    setImportText(PLUGIN_SAMPLES[chip.key]);
                    setImportResult(null);
                  }}
                  className="rounded-md border border-border bg-secondary/50 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-700/60 bg-zinc-950 shadow-inner">
            <div className="flex items-center gap-1.5 border-b border-zinc-800 px-3 py-2">
              <span className="size-2.5 rounded-full bg-red-500/70" aria-hidden />
              <span className="size-2.5 rounded-full bg-amber-500/70" aria-hidden />
              <span className="size-2.5 rounded-full bg-emerald-500/70" aria-hidden />
              <span className="ml-2 font-mono text-[10px] text-zinc-500">
                plugin.config / SKILL.md
              </span>
            </div>
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={
                '支持：Operit mcp_config.json（{"mcpServers":{...}}）\n.claude-plugin/marketplace.json（{"plugins":[...]}）\nSKILL.md（YAML frontmatter + 正文）'
              }
              spellCheck={false}
              className="min-h-32 resize-y rounded-none border-0 bg-transparent font-mono text-xs leading-relaxed text-emerald-50 caret-emerald-400 placeholder:text-zinc-600 focus-visible:ring-0 dark:bg-transparent"
            />
          </div>

          <Button
            onClick={() => void handleImport()}
            disabled={importing}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-500 sm:w-auto dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
          >
            {importing ? <Loader2 className="animate-spin" /> : <PackagePlus />}
            {importing ? "正在导入…" : "导入插件"}
          </Button>

          {/* 导入结果 */}
          {importResult && importResult.ok ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 font-mono text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  {importResult.format ?? "unknown"}
                </Badge>
                <span className="font-mono text-xs font-semibold">
                  新增{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">{importResult.added ?? 0}</span>
                  {" · "}
                  跳过{" "}
                  <span className="text-amber-600 dark:text-amber-400">
                    {importResult.skipped?.length ?? 0}
                  </span>
                </span>
              </div>
              {importResult.names && importResult.names.length > 0 ? (
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {importResult.names.map((n) => (
                    <span key={n} className="mr-2 inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-emerald-500" />
                      {n}
                    </span>
                  ))}
                </p>
              ) : null}
              {importResult.skipped && importResult.skipped.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {importResult.skipped.map((s) => (
                    <li
                      key={`skip-${s.name}`}
                      className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400"
                    >
                      <AlertCircle className="size-3" />
                      <span className="font-mono">{s.name}</span>
                      <span className="text-muted-foreground">— {s.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 工具栏 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索插件名称 / 描述…"
            className="pl-9 text-sm"
          />
        </div>
        <Select value={format} onValueChange={(v) => setFormat(v as FormatFilter)}>
          <SelectTrigger className="w-full sm:w-[190px]">
            <SelectValue placeholder="插件格式" />
          </SelectTrigger>
          <SelectContent>
            {FORMAT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="font-mono text-xs text-muted-foreground">共 {plugins.length} 个插件</p>

      {/* 插件卡片网格 */}
      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">加载插件失败：{errorMessage(error)}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </CardContent>
        </Card>
      ) : plugins.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Puzzle className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">没有匹配的插件</p>
            {format !== "all" || q.trim() !== "" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFormat("all");
                  setQ("");
                }}
              >
                清除筛选条件
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin, index) => (
            <motion.div
              key={plugin.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
            >
              <Card
                onClick={() => setDetail(plugin)}
                className="group h-full cursor-pointer border-border/70 transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-[0_0_24px_-12px] hover:shadow-emerald-500/40"
              >
                <CardContent className="flex h-full flex-col gap-2.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <PluginFormatBadge format={plugin.format} />
                    </div>
                    <div
                      className="flex shrink-0 items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Switch
                        checked={plugin.enabled}
                        disabled={pendingIds.has(plugin.id)}
                        onCheckedChange={(checked) => void toggleEnabled(plugin, checked)}
                        aria-label={`启用 ${plugin.name}`}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="删除插件"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(plugin)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="break-all font-mono text-sm font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    {plugin.name}
                  </h3>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    v{plugin.version} · {plugin.author || "unknown"}
                  </p>
                  <p className="line-clamp-2 min-h-[2rem] text-xs leading-relaxed text-muted-foreground">
                    {plugin.description || "（暂无描述）"}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5">
                    {plugin.tags.slice(0, 4).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[10px] font-normal text-muted-foreground"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* 详情弹窗 */}
      <PluginDetailDialog plugin={detail} open={detail !== null} onOpenChange={(open) => !open && setDetail(null)} />

      {/* 删除确认 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该插件？</AlertDialogTitle>
            <AlertDialogDescription>
              即将移除插件 <span className="font-mono">{deleteTarget?.name}</span>
              ，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 插件详情弹窗（按格式差异化展示）
// ---------------------------------------------------------------------------

function configString(config: Record<string, unknown>, key: string): string | null {
  const value = config[key];
  return typeof value === "string" ? value : null;
}

function PluginDetailDialog({
  plugin,
  open,
  onOpenChange,
}: {
  plugin: PluginDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!plugin) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hub-scroll max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-mono">
            <span className="break-all">{plugin.name}</span>
            <PluginFormatBadge format={plugin.format} />
          </DialogTitle>
          <DialogDescription className="text-left">
            {PLUGIN_FORMAT_LABELS[plugin.format]} · v{plugin.version} · {plugin.author || "unknown"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {plugin.description || "（暂无描述）"}
          </p>

          {plugin.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {plugin.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] text-muted-foreground">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}

          {plugin.format === "operit" ? (
            <section>
              <div className="mb-1.5 flex items-center justify-between">
                <h4 className="font-mono text-xs font-semibold text-muted-foreground">
                  {"// mcp_config.json（mcpServers）"}
                </h4>
                <CopyButton text={JSON.stringify(plugin.config, null, 2)} label="复制配置" />
              </div>
              <JsonBlock value={plugin.config} className="max-h-72" />
              {plugin.repo ? (
                <a
                  href={plugin.sourceUrl ?? `https://github.com/${plugin.repo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  <ExternalLink className="size-3.5" />
                  {plugin.repo}
                </a>
              ) : null}
            </section>
          ) : null}

          {plugin.format === "anthropic-marketplace" ? (
            <section className="space-y-2">
              <h4 className="font-mono text-xs font-semibold text-muted-foreground">
                {"// 市场插件元数据"}
              </h4>
              <dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 rounded-lg border border-border/60 bg-secondary/30 p-3 font-mono text-xs">
                <dt className="text-muted-foreground">source</dt>
                <dd className="break-all text-emerald-700 dark:text-emerald-400">
                  {configString(plugin.config, "source") ?? "-"}
                </dd>
                <dt className="text-muted-foreground">category</dt>
                <dd>{configString(plugin.config, "category") ?? "-"}</dd>
                <dt className="text-muted-foreground">pluginType</dt>
                <dd>{plugin.pluginType}</dd>
              </dl>
              {plugin.sourceUrl ? (
                <a
                  href={plugin.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  <ExternalLink className="size-3.5" />
                  {plugin.sourceUrl}
                </a>
              ) : null}
            </section>
          ) : null}

          {plugin.format === "anthropic-skill" ? (
            <section>
              <div className="mb-1.5 flex items-center justify-between">
                <h4 className="font-mono text-xs font-semibold text-muted-foreground">
                  {"// SKILL.md 正文"}
                </h4>
                {plugin.skillBody ? (
                  <CopyButton text={plugin.skillBody} label="复制正文" />
                ) : null}
              </div>
              {plugin.skillBody ? (
                <pre className="hub-scroll max-h-80 overflow-auto rounded-lg border border-border/70 bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap dark:bg-zinc-950/70">
                  {plugin.skillBody}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground">（无正文）</p>
              )}
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
