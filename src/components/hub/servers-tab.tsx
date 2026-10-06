"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Eye,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  ServerOff,
  Settings2,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { McpServerDto, McpTransport } from "@/lib/types";
import {
  errorMessage,
  hubApi,
  type McpListResponse,
  type McpServerPayload,
} from "@/components/hub/api";
import type { HubTab } from "@/components/hub/nav";
import { SandboxBadge, ScopeBadge, TransportBadge } from "@/components/hub/badges";
import { CommandLine } from "@/components/hub/command-line";
import { McpDetailDialog } from "@/components/hub/mcp-detail-dialog";

/** Tab 3 · 我的服务器：仅已安装，启用开关 / 编辑 / 删除 */
export function ServersTab({ onNavigate }: { onNavigate: (tab: HubTab) => void }) {
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<McpServerDto | null>(null);
  const [editTarget, setEditTarget] = useState<McpServerDto | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<McpServerDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState<"enable" | "disable" | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const queryParams = useMemo(
    () => ({ q: "", category: "all" as const, filter: "installed" as const }),
    [],
  );
  const queryKey = ["mcp", queryParams];
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => hubApi.mcp(queryParams),
  });

  const servers = data?.servers ?? [];
  const enabledCount = servers.filter((s) => s.enabled).length;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["mcp"] });
    await queryClient.invalidateQueries({ queryKey: ["stats"] });
  }

  /** 启用/停用（乐观更新，失败回滚） */
  async function toggleEnabled(server: McpServerDto, next: boolean) {
    setPendingIds((prev) => new Set(prev).add(server.id));
    // 乐观更新本地缓存
    queryClient.setQueryData<McpListResponse>(queryKey, (old) =>
      old
        ? { servers: old.servers.map((s) => (s.id === server.id ? { ...s, enabled: next } : s)) }
        : old,
    );
    try {
      await hubApi.patchMcp(server.id, { enabled: next });
      toast.success(`${server.name} ${next ? "已启用" : "已停用"}`);
      await refresh();
    } catch (e) {
      toast.error(`${server.name} ${next ? "启用" : "停用"}失败`, { description: errorMessage(e) });
      await refetch();
    } finally {
      setPendingIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(server.id);
        return nextSet;
      });
    }
  }

  /** 批量启用 / 停用 */
  async function bulkToggle(enable: boolean) {
    const targets = servers.filter((s) => s.enabled !== enable);
    if (targets.length === 0) {
      toast.info(enable ? "所有已安装服务器均已启用" : "所有服务器均已停用");
      return;
    }
    setBulkBusy(enable ? "enable" : "disable");
    try {
      const results = await Promise.allSettled(
        targets.map((s) => hubApi.patchMcp(s.id, { enabled: enable })),
      );
      const okCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.length - okCount;
      if (failCount === 0) {
        toast.success(`已${enable ? "启用" : "停用"} ${okCount} 个服务器`);
      } else {
        toast.warning(`部分操作失败：成功 ${okCount} · 失败 ${failCount}`);
      }
      await refresh();
    } finally {
      setBulkBusy(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await hubApi.deleteMcp(deleteTarget.id);
      toast.success(`已删除 ${deleteTarget.name}`);
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      toast.error("删除失败", { description: errorMessage(e) });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作条 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-sm">
            已安装 <span className="text-emerald-600 dark:text-emerald-400">{servers.length}</span>{" "}
            个 · 启用中 {enabledCount} 个
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            安装 ≠ 启动：默认停用，确认配置后再启用
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            手动添加
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkBusy !== null || servers.length === 0}
            onClick={() => void bulkToggle(true)}
          >
            {bulkBusy === "enable" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            启用全部已安装
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkBusy !== null || servers.length === 0}
            onClick={() => void bulkToggle(false)}
          >
            {bulkBusy === "disable" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Pause className="size-4" />
            )}
            全部停用
          </Button>
        </div>
      </div>

      {/* 服务器列表（Card 行） */}
      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-6 w-10" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              加载已安装服务器失败：{errorMessage(error)}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </CardContent>
        </Card>
      ) : servers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <ServerOff className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">还没有安装任何 MCP 服务器</p>
            <Button
              size="sm"
              onClick={() => onNavigate("market")}
              className="bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
            >
              去市场安装
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {servers.map((server, index) => (
            <motion.div
              key={server.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
            >
              <Card
                onClick={() => setDetail(server)}
                className="cursor-pointer border-border/70 py-0 transition-colors hover:border-emerald-500/40"
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-all font-mono text-sm font-bold">{server.name}</h3>
                      <TransportBadge transport={server.transport} />
                      {server.runInSandbox ? <SandboxBadge /> : null}
                      <ScopeBadge scope={server.scope} />
                      {server.enabled ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                        >
                          运行中
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                          已停用
                        </Badge>
                      )}
                    </div>
                    <CommandLine server={server} className="max-w-full sm:max-w-xl" />
                  </div>
                  <div
                    className="flex shrink-0 items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={server.enabled}
                      disabled={pendingIds.has(server.id)}
                      onCheckedChange={(checked) => void toggleEnabled(server, checked)}
                      aria-label={`启用 ${server.name}`}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="服务器操作">
                          <Settings2 className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => setDetail(server)}>
                          <Eye />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditTarget(server)}>
                          <Pencil />
                          编辑配置
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(server)}
                        >
                          <Trash2 />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* 详情弹窗 */}
      <McpDetailDialog
        server={detail}
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      />

      {/* 编辑弹窗 */}
      <ServerFormDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        mode="edit"
        server={editTarget}
        onDone={() => void refresh()}
      />

      {/* 手动添加弹窗 */}
      <ServerFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="add"
        server={null}
        onDone={() => void refresh()}
      />

      {/* 删除确认 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该服务器？</AlertDialogTitle>
            <AlertDialogDescription>
              即将从本地移除 <span className="font-mono">{deleteTarget?.name}</span>{" "}
              的配置，此操作不可撤销。目录条目可在市场重新安装。
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
// 新增 / 编辑表单弹窗
// ---------------------------------------------------------------------------

interface ServerFormState {
  name: string;
  description: string;
  transport: McpTransport;
  command: string;
  url: string;
  argsText: string;
  envText: string;
}

function stateFromServer(server: McpServerDto | null): ServerFormState {
  if (!server) {
    return {
      name: "",
      description: "",
      transport: "STDIO",
      command: "npx",
      url: "",
      argsText: "",
      envText: "",
    };
  }
  return {
    name: server.name,
    description: server.description,
    transport: server.transport,
    command: server.command ?? "",
    url: server.url ?? "",
    argsText: server.args.join("\n"),
    envText: Object.entries(server.env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
  };
}

function parseEnv(text: string): { env: Record<string, string>; badLines: number[] } {
  const env: Record<string, string> = {};
  const badLines: number[] = [];
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .forEach((line, i) => {
      const eq = line.indexOf("=");
      if (eq <= 0) {
        badLines.push(i + 1);
      } else {
        env[line.slice(0, eq).trim()] = line.slice(eq + 1);
      }
    });
  return { env, badLines };
}

function ServerFormDialog({
  open,
  onOpenChange,
  mode,
  server,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  server: McpServerDto | null;
  onDone: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<ServerFormState>(() => stateFromServer(server));
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState("");

  // 打开时重置表单（用 key 变化识别目标切换）
  const targetKey = `${mode}:${server?.id ?? "new"}:${open}`;
  if (open && targetKey !== formKey) {
    setFormKey(targetKey);
    setForm(stateFromServer(server));
  }

  function set<K extends keyof ServerFormState>(key: K, value: ServerFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error("请填写服务器名称");
      return;
    }
    if (form.transport === "STDIO" && !form.command.trim()) {
      toast.error("STDIO 服务器需要填写启动命令（command）");
      return;
    }
    if (form.transport !== "STDIO" && !/^https?:\/\//i.test(form.url.trim())) {
      toast.error("远程服务器需要填写以 http(s):// 开头的 URL");
      return;
    }
    const { env, badLines } = parseEnv(form.envText);
    if (badLines.length > 0) {
      toast.error(`环境变量格式有误（第 ${badLines.join("、")} 行缺少 =），请检查`);
      return;
    }
    const args = form.argsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      if (mode === "add") {
        const payload: McpServerPayload = {
          name,
          description: form.description.trim(),
          transport: form.transport,
          ...(form.transport === "STDIO"
            ? { command: form.command.trim(), url: undefined }
            : { command: undefined, url: form.url.trim() }),
          args,
          env,
          headers: {},
          enabled: false,
          runInSandbox: form.transport === "STDIO",
          scope: "all",
          tags: [],
        };
        const res = await hubApi.addMcp(payload);
        if (!res.ok) throw new Error(res.error ?? "添加失败");
        toast.success(`已添加 ${name}`, { description: "默认停用，确认配置后启用" });
      } else if (server) {
        await hubApi.patchMcp(server.id, {
          name,
          description: form.description.trim(),
          transport: form.transport,
          ...(form.transport === "STDIO"
            ? { command: form.command.trim(), url: form.url.trim() || undefined }
            : { command: form.command.trim() || undefined, url: form.url.trim() }),
          args,
          env,
        });
        toast.success(`已保存 ${name} 的配置`);
      }
      onOpenChange(false);
      await onDone();
    } catch (e) {
      toast.error(mode === "add" ? "添加失败" : "保存失败", { description: errorMessage(e) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hub-scroll max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {mode === "add" ? "手动添加 MCP 服务器" : `编辑 · ${server?.name ?? ""}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "以 apex 内部格式新增一个服务器（source=manual，安装后默认停用）"
              : "修改后立即生效，格式约定与 apex McpConfigImport 一致"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="server-name">名称 *</Label>
            <Input
              id="server-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="my-server"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="server-desc">描述</Label>
            <Textarea
              id="server-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="这个服务器做什么…"
              className="min-h-16 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label>传输层</Label>
            <Select
              value={form.transport}
              onValueChange={(v) => set("transport", v as McpTransport)}
            >
              <SelectTrigger className="w-full font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STDIO">STDIO（本地进程，沙箱内执行）</SelectItem>
                <SelectItem value="HTTP">HTTP / Streamable HTTP</SelectItem>
                <SelectItem value="SSE">SSE（远程）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.transport === "STDIO" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="server-command">启动命令（command）*</Label>
                <Input
                  id="server-command"
                  value={form.command}
                  onChange={(e) => set("command", e.target.value)}
                  placeholder="npx / uvx / python …"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="server-args">参数（args，每行一个）</Label>
                <Textarea
                  id="server-args"
                  value={form.argsText}
                  onChange={(e) => set("argsText", e.target.value)}
                  placeholder={"-y\n@modelcontextprotocol/server-everything"}
                  className="min-h-20 font-mono text-xs"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="server-url">服务端点（URL）*</Label>
              <Input
                id="server-url"
                value={form.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder="https://mcp.example.com/sse"
                className="font-mono text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="server-env">环境变量（每行一条 KEY=value）</Label>
            <Textarea
              id="server-env"
              value={form.envText}
              onChange={(e) => set("envText", e.target.value)}
              placeholder="GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx"
              className="min-h-20 font-mono text-xs"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
            >
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {mode === "add" ? "添加服务器" : "保存配置"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
