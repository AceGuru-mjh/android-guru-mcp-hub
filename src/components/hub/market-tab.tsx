"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  PackageSearch,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { McpServerDto, McpTransport } from "@/lib/types";
import { errorMessage, hubApi } from "@/components/hub/api";
import { useDebounce } from "@/components/hub/use-debounce";
import {
  CategoryBadge,
  SandboxBadge,
  ScopeBadge,
  TransportBadge,
  VendorBadge,
} from "@/components/hub/badges";
import { CommandLine } from "@/components/hub/command-line";
import { McpDetailDialog } from "@/components/hub/mcp-detail-dialog";

type CategoryFilter = "all" | "programming" | "reverse";
type TransportFilter = "all" | McpTransport;

/** Tab 2 · MCP 市场：目录浏览 / 搜索 / 筛选 / 安装 */
export function MarketTab() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [transport, setTransport] = useState<TransportFilter>("all");
  const [detail, setDetail] = useState<McpServerDto | null>(null);
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [bulkInstalling, setBulkInstalling] = useState(false);

  const queryParams = useMemo(
    () => ({ q: debouncedQ, category, filter: "all" as const }),
    [debouncedQ, category],
  );
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["mcp", queryParams],
    queryFn: () => hubApi.mcp(queryParams),
  });

  const servers = data?.servers ?? [];
  const filtered = useMemo(
    () => (transport === "all" ? servers : servers.filter((s) => s.transport === transport)),
    [servers, transport],
  );
  const installedCount = filtered.filter((s) => s.installed).length;
  const uninstalledIds = filtered.filter((s) => !s.installed).map((s) => s.id);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["mcp"] });
    await queryClient.invalidateQueries({ queryKey: ["stats"] });
  }

  async function installOne(server: McpServerDto) {
    setInstallingIds((prev) => new Set(prev).add(server.id));
    try {
      await hubApi.installMcp([server.id]);
      toast.success(`已安装 ${server.name}`, {
        description: "默认停用，到「我的服务器」中确认配置后启用",
      });
      setDetail(null);
      await refresh();
    } catch (e) {
      toast.error(`安装 ${server.name} 失败`, { description: errorMessage(e) });
    } finally {
      setInstallingIds((prev) => {
        const next = new Set(prev);
        next.delete(server.id);
        return next;
      });
    }
  }

  async function installAllFiltered() {
    if (uninstalledIds.length === 0) {
      toast.info("筛选结果中的服务器均已安装");
      return;
    }
    setBulkInstalling(true);
    try {
      const res = await hubApi.installMcp(uninstalledIds);
      toast.success(`已安装 ${res.installed} 个 MCP 服务器`);
      await refresh();
    } catch (e) {
      toast.error("批量安装失败", { description: errorMessage(e) });
    } finally {
      setBulkInstalling(false);
    }
  }

  const hasActiveFilter = q.trim() !== "" || category !== "all" || transport !== "all";

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索名称 / 描述 / 标签…"
            className="pl-9 font-mono text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              <SelectItem value="programming">编程开发</SelectItem>
              <SelectItem value="reverse">逆向工程</SelectItem>
            </SelectContent>
          </Select>
          <Select value={transport} onValueChange={(v) => setTransport(v as TransportFilter)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="传输层" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部传输</SelectItem>
              <SelectItem value="STDIO">STDIO</SelectItem>
              <SelectItem value="HTTP">HTTP</SelectItem>
              <SelectItem value="SSE">SSE</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={installAllFiltered}
            disabled={bulkInstalling || uninstalledIds.length === 0}
            className="bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950"
          >
            {bulkInstalling ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            安装全部筛选结果
            {uninstalledIds.length > 0 ? `（${uninstalledIds.length}）` : ""}
          </Button>
        </div>
      </div>

      {/* 结果计数 */}
      <p className="font-mono text-xs text-muted-foreground">
        共 {filtered.length} 个结果 · {installedCount} 个已安装
      </p>

      {/* 列表 */}
      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-7 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              加载 MCP 目录失败：{errorMessage(error)}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <PackageSearch className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">没有匹配的 MCP</p>
            {hasActiveFilter ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQ("");
                  setCategory("all");
                  setTransport("all");
                }}
              >
                清除筛选条件
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((server, index) => {
            const installing = installingIds.has(server.id);
            return (
              <motion.div
                key={server.id}
                layout="position"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
              >
                <Card
                  onClick={() => setDetail(server)}
                  className="group h-full cursor-pointer border-border/70 transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-[0_0_24px_-12px] hover:shadow-emerald-500/40"
                >
                  <CardHeader className="gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 break-all font-mono text-sm font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        {server.name}
                      </h3>
                      {server.installed ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                        >
                          <CheckCircle2 className="size-3" /> 已安装
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            void installOne(server);
                          }}
                          disabled={installing}
                          className="h-7 shrink-0 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                        >
                          {installing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Plus className="size-3.5" />
                          )}
                          安装
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TransportBadge transport={server.transport} />
                      <VendorBadge vendor={server.vendor} />
                      <CategoryBadge category={server.category} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex h-full flex-col gap-2.5">
                    <p className="line-clamp-3 min-h-[3rem] text-xs leading-relaxed text-muted-foreground">
                      {server.description || "（暂无描述）"}
                    </p>
                    <CommandLine server={server} />
                    <div className="mt-auto flex flex-wrap items-center gap-1.5">
                      {server.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px] font-normal text-muted-foreground"
                        >
                          {tag}
                        </Badge>
                      ))}
                      <span className="ml-auto flex items-center gap-1.5">
                        {server.runInSandbox ? <SandboxBadge /> : null}
                        <ScopeBadge scope={server.scope} />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 详情弹窗 */}
      <McpDetailDialog
        server={detail}
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        onInstall={(s) => void installOne(s)}
        installing={detail ? installingIds.has(detail.id) : false}
      />
    </div>
  );
}
