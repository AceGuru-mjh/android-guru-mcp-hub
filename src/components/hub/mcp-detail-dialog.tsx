"use client";

import { CheckCircle2, ExternalLink, KeyRound, Plus, ServerCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { McpServerDto } from "@/lib/types";
import { CategoryBadge, SandboxBadge, ScopeBadge, TransportBadge, VendorBadge } from "@/components/hub/badges";
import { CopyButton } from "@/components/hub/copy-button";
import { JsonBlock } from "@/components/hub/json-block";

/** 环境变量值脱敏：占位符（<your-token>）原样展示，真实值打码 */
function maskEnvValue(value: string): string {
  if (!value) return "<空>";
  if (value.startsWith("<") && value.endsWith(">")) return value;
  return "●●●●●●●●";
}

/** 生成完整配置 JSON（apex 内部规范格式） */
function toFullConfig(server: McpServerDto) {
  return {
    name: server.name,
    description: server.description,
    transport: server.transport,
    ...(server.url ? { url: server.url } : {}),
    ...(server.command ? { command: server.command } : {}),
    args: server.args,
    env: server.env,
    headers: server.headers,
    enabled: server.enabled,
    runInSandbox: server.runInSandbox,
    scope: server.scope,
    tags: server.tags,
  };
}

export function McpDetailDialog({
  server,
  open,
  onOpenChange,
  onInstall,
  installing = false,
}: {
  server: McpServerDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall?: (server: McpServerDto) => void;
  installing?: boolean;
}) {
  if (!server) return null;

  const envKeys = Object.entries(server.env);
  const headerEntries = Object.entries(server.headers);
  const fullCommand =
    server.transport === "STDIO"
      ? [server.command ?? "", ...server.args].filter(Boolean).join(" ")
      : (server.url ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hub-scroll max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-mono">
            <span className="break-all">{server.name}</span>
            <TransportBadge transport={server.transport} />
            <VendorBadge vendor={server.vendor} />
            <CategoryBadge category={server.category} />
          </DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            {server.description || "（暂无描述）"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 启动命令 / 端点 */}
          <section>
            <h4 className="mb-1.5 font-mono text-xs font-semibold text-muted-foreground">
              {server.transport === "STDIO" ? "// 启动命令" : "// 服务端点"}
            </h4>
            <div className="hub-scroll overflow-x-auto rounded-lg border border-border/70 bg-muted/40 px-3 py-2 font-mono text-xs dark:bg-zinc-950/70">
              <span className="mr-2 select-none text-emerald-500">❯</span>
              <span className="text-emerald-700 dark:text-emerald-300">{fullCommand}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ScopeBadge scope={server.scope} />
              {server.runInSandbox ? <SandboxBadge /> : null}
              <span className="font-mono text-[10px] text-muted-foreground/70">
                source: {server.source}
              </span>
            </div>
          </section>

          <Separator />

          {/* 环境变量 */}
          <section>
            <h4 className="mb-1.5 font-mono text-xs font-semibold text-muted-foreground">
              {`// 环境变量（${envKeys.length}）`}
            </h4>
            {envKeys.length === 0 ? (
              <p className="text-xs text-muted-foreground">无环境变量</p>
            ) : (
              <ul className="space-y-1">
                {envKeys.map(([key, value]) => (
                  <li
                    key={key}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1.5 font-mono text-xs"
                  >
                    <KeyRound className="size-3 shrink-0 text-amber-500" />
                    <span className="shrink-0 text-emerald-700 dark:text-emerald-400">{key}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="truncate text-muted-foreground">{maskEnvValue(value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 请求头 */}
          {headerEntries.length > 0 ? (
            <section>
              <h4 className="mb-1.5 font-mono text-xs font-semibold text-muted-foreground">
                {`// 请求头（${headerEntries.length}）`}
              </h4>
              <ul className="space-y-1">
                {headerEntries.map(([key, value]) => (
                  <li
                    key={key}
                    className="rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1.5 font-mono text-xs"
                  >
                    <span className="text-emerald-700 dark:text-emerald-400">{key}</span>
                    <span className="text-muted-foreground">: {maskEnvValue(value)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Separator />

          {/* 主页 */}
          {server.homepage ? (
            <a
              href={server.homepage}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:underline dark:text-emerald-400"
            >
              <ExternalLink className="size-3.5" />
              {server.homepage}
            </a>
          ) : null}

          {/* 完整配置 JSON */}
          <section>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h4 className="font-mono text-xs font-semibold text-muted-foreground">
                {"// 完整配置 JSON"}
              </h4>
              <CopyButton text={JSON.stringify(toFullConfig(server), null, 2)} label="复制 JSON" />
            </div>
            <JsonBlock value={toFullConfig(server)} className="max-h-72" />
          </section>

          {/* 底部操作 */}
          {onInstall ? (
            server.installed ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                已安装 · 到「我的服务器」中启用
              </div>
            ) : (
              <Button
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950"
                onClick={() => onInstall(server)}
                disabled={installing}
              >
                <Plus />
                {installing ? "正在安装…" : "安装此服务器"}
              </Button>
            )
          ) : (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ServerCog className="size-3.5" />
              在「我的服务器」列表中启用 / 编辑此服务器
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
