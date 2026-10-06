"use client";

import type { McpServerDto } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 卡片用命令预览：command + 前 2 个参数（截断） */
export function commandLineText(server: McpServerDto): string {
  if (server.transport === "STDIO") {
    const parts = [server.command ?? "", ...server.args.slice(0, 2)].filter(Boolean);
    const text = parts.join(" ");
    const rest = server.args.length - Math.min(server.args.length, 2);
    return rest > 0 ? `${text} …(+${rest})` : text;
  }
  return server.url ?? "";
}

/** 终端风格命令 / 端点展示块 */
export function CommandLine({
  server,
  className,
}: {
  server: McpServerDto;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hub-scroll overflow-x-auto whitespace-nowrap rounded-md border border-border/60 bg-muted/50 px-2.5 py-1.5 font-mono text-[11px] dark:bg-zinc-950/60",
        className,
      )}
    >
      <span className="mr-1.5 select-none text-emerald-500">
        {server.transport === "STDIO" ? "❯" : "↗"}
      </span>
      <span className="text-emerald-700 dark:text-emerald-300">{commandLineText(server)}</span>
    </div>
  );
}
