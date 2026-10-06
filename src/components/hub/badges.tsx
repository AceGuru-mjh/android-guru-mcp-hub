"use client";

import { Shield, Terminal, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { McpCategory, McpScope, McpTransport, PluginFormat } from "@/lib/types";
import {
  CATEGORY_LABELS,
  PLUGIN_FORMAT_LABELS,
  SCOPE_LABELS,
  TRANSPORT_LABELS,
} from "@/lib/types";

/** 传输层徽章：STDIO=zinc / HTTP=emerald / SSE=amber */
export function TransportBadge({ transport, className }: { transport: McpTransport; className?: string }) {
  if (transport === "HTTP") {
    return (
      <Badge
        variant="outline"
        title={TRANSPORT_LABELS.HTTP}
        className={cn(
          "border-emerald-500/40 bg-emerald-500/10 font-mono text-[10px] text-emerald-600 dark:text-emerald-400",
          className,
        )}
      >
        <Wifi className="size-3" /> HTTP
      </Badge>
    );
  }
  if (transport === "SSE") {
    return (
      <Badge
        variant="outline"
        title={TRANSPORT_LABELS.SSE}
        className={cn(
          "border-amber-500/40 bg-amber-500/10 font-mono text-[10px] text-amber-600 dark:text-amber-400",
          className,
        )}
      >
        <Wifi className="size-3" /> SSE
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      title={TRANSPORT_LABELS.STDIO}
      className={cn(
        "border-border bg-secondary font-mono text-[10px] text-muted-foreground",
        className,
      )}
    >
      <Terminal className="size-3" /> STDIO
    </Badge>
  );
}

/** 厂商标签：官方（Anthropic）= emerald 描边，社区/第三方 = zinc */
export function VendorBadge({ vendor, className }: { vendor: string | null; className?: string }) {
  if (!vendor) return null;
  const official = vendor === "Anthropic";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[10px]",
        official
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-secondary text-muted-foreground",
        className,
      )}
    >
      {official ? "官方" : vendor}
    </Badge>
  );
}

/** 分类徽章：编程开发=emerald / 逆向工程=amber */
export function CategoryBadge({ category, className }: { category: McpCategory; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px]",
        category === "programming"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}

/** 作用域徽章 */
export function ScopeBadge({ scope, className }: { scope: McpScope; className?: string }) {
  return (
    <span
      title={SCOPE_LABELS[scope]}
      className={cn("text-[10px] text-muted-foreground/80", className)}
    >
      {SCOPE_LABELS[scope]}
    </span>
  );
}

/** 沙箱徽章（PRoot 内执行） */
export function SandboxBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      title="在 PRoot 沙箱内执行"
      className={cn(
        "border-border bg-secondary font-mono text-[10px] text-muted-foreground",
        className,
      )}
    >
      <Shield className="size-3" /> 沙箱
    </Badge>
  );
}

/** 插件格式徽章：operit=orange / anthropic-marketplace=emerald / anthropic-skill=amber */
export function PluginFormatBadge({ format, className }: { format: PluginFormat; className?: string }) {
  if (format === "operit") {
    return (
      <Badge
        variant="outline"
        title={PLUGIN_FORMAT_LABELS.operit}
        className={cn(
          "border-orange-500/40 bg-orange-500/10 text-[10px] text-orange-600 dark:text-orange-400",
          className,
        )}
      >
        Operit
      </Badge>
    );
  }
  if (format === "anthropic-marketplace") {
    return (
      <Badge
        variant="outline"
        title={PLUGIN_FORMAT_LABELS["anthropic-marketplace"]}
        className={cn(
          "border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400",
          className,
        )}
      >
        插件市场
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      title={PLUGIN_FORMAT_LABELS["anthropic-skill"]}
      className={cn(
        "border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      Agent Skill
    </Badge>
  );
}

/** 导入日志 kind 徽章：mcp=emerald / plugin=orange */
export function LogKindBadge({ kind, className }: { kind: string; className?: string }) {
  const isMcp = kind === "mcp";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[10px]",
        isMcp
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
        className,
      )}
    >
      {isMcp ? "MCP" : "插件"}
    </Badge>
  );
}
