"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  Download,
  FileJson,
  History,
  Loader2,
  Puzzle,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IMPORT_FORMAT_LABELS } from "@/lib/types";
import { asImportFormat, downloadExport, errorMessage, hubApi } from "@/components/hub/api";
import type { HubTab } from "@/components/hub/nav";
import { LogKindBadge } from "@/components/hub/badges";

/** Tab 1 · 总览：分类分布 / 最近导入 / 快捷操作 */
export function OverviewTab({ onNavigate }: { onNavigate: (tab: HubTab) => void }) {
  const { data, isPending, isError } = useQuery({ queryKey: ["stats"], queryFn: hubApi.stats });
  const [downloading, setDownloading] = useState(false);

  async function downloadCollection() {
    setDownloading(true);
    try {
      const filename = await downloadExport("claude", "installed");
      toast.success("已开始下载完整 MCP 集合", {
        description: `${filename} · Claude Desktop 通用格式（已安装）`,
      });
    } catch (e) {
      toast.error("下载失败", { description: errorMessage(e) });
    } finally {
      setDownloading(false);
    }
  }

  const servers = data?.servers;
  const programming = servers?.programming ?? 0;
  const reverse = servers?.reverse ?? 0;
  const total = servers?.total ?? 0;
  const logs = data?.logs ?? [];

  const quickActions: {
    key: HubTab | "download";
    title: string;
    desc: string;
    icon: typeof Store;
    action: () => void;
    loading?: boolean;
  }[] = [
    {
      key: "market",
      title: "浏览市场",
      desc: "30 个编程 / 逆向 MCP 目录",
      icon: Store,
      action: () => onNavigate("market"),
    },
    {
      key: "import",
      title: "一键导入配置",
      desc: "粘贴 mcpServers / apex / Hub JSON",
      icon: FileJson,
      action: () => onNavigate("import"),
    },
    {
      key: "download",
      title: "下载完整 MCP 集合",
      desc: "claude_mcp.json（已安装）",
      icon: Download,
      action: () => void downloadCollection(),
      loading: downloading,
    },
    {
      key: "plugins",
      title: "管理插件",
      desc: "Operit · Anthropic 生态",
      icon: Puzzle,
      action: () => onNavigate("plugins"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 快捷操作 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.div
              key={action.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
            >
              <Card
                onClick={action.loading ? undefined : action.action}
                className="group h-full cursor-pointer border-border/70 py-0 transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-[0_0_24px_-12px] hover:shadow-emerald-500/40"
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 transition-colors group-hover:bg-emerald-500/20">
                    {action.loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Icon className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{action.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{action.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 分类分布 */}
        <Card className="py-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="font-mono text-xs text-emerald-500">❯</span>
              目录分类分布
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isPending ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : isError ? (
              <p className="text-sm text-muted-foreground">统计加载失败，请刷新重试</p>
            ) : (
              <>
                <CategoryBar
                  label="编程开发"
                  value={programming}
                  total={total}
                  barClass="bg-emerald-500"
                  textClass="text-emerald-600 dark:text-emerald-400"
                />
                <CategoryBar
                  label="逆向工程"
                  value={reverse}
                  total={total}
                  barClass="bg-amber-500"
                  textClass="text-amber-600 dark:text-amber-400"
                />
                <p className="font-mono text-[11px] text-muted-foreground/70">
                  {"// 编程开发覆盖文件系统 / Git / 代码搜索；逆向工程覆盖静态分析 / 动态 Hook / 抓包"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 最近导入记录 */}
        <Card className="py-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-emerald-500" />
              最近导入记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <ArrowLeftRight className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">暂无导入记录，去导入页试试</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate("import")}
                  className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                >
                  前往导入 / 导出
                </Button>
              </div>
            ) : (
              <ul className="hub-scroll max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5"
                  >
                    <LogKindBadge kind={log.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs">
                        {IMPORT_FORMAT_LABELS[asImportFormat(log.format)] ?? log.format}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(log.createdAt), {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </p>
                    </div>
                    <div className="shrink-0 font-mono text-[11px]">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        成功 {log.success}
                      </span>
                      <span className="mx-1 text-muted-foreground/50">·</span>
                      <span className="text-amber-600 dark:text-amber-400">跳过 {log.total - log.success - log.failed}</span>
                      <span className="mx-1 text-muted-foreground/50">·</span>
                      <span className="text-destructive">失败 {log.failed}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CategoryBar({
  label,
  value,
  total,
  barClass,
  textClass,
}: {
  label: string;
  value: number;
  total: number;
  barClass: string;
  textClass: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`font-mono text-xs font-semibold tabular-nums ${textClass}`}>
          {value}/{total}（{pct}%）
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <motion.div
          className={`h-full rounded-full ${barClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
