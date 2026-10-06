"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, Layers, Puzzle, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hubApi } from "@/components/hub/api";
import { cn } from "@/lib/utils";

const CARDS = [
  {
    key: "total",
    label: "MCP 目录总数",
    desc: "16 编程开发 + 14 逆向工程",
    icon: Layers,
    iconClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  },
  {
    key: "installed",
    label: "已安装",
    desc: "已加入本地配置",
    icon: Download,
    iconClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  },
  {
    key: "enabled",
    label: "已启用",
    desc: "随 Agent 启动加载",
    icon: Zap,
    iconClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  },
  {
    key: "plugins",
    label: "插件数",
    desc: "Operit + Anthropic 生态",
    icon: Puzzle,
    iconClass: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  },
] as const;

/** 顶部 4 张统计卡片（GET /api/stats） */
export function StatsCards() {
  const { data, isPending } = useQuery({ queryKey: ["stats"], queryFn: hubApi.stats });

  const values: Record<(typeof CARDS)[number]["key"], number | undefined> = {
    total: data?.servers.total,
    installed: data?.servers.installed,
    enabled: data?.servers.enabled,
    plugins: data?.plugins.total,
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {CARDS.map((card, index) => {
        const Icon = card.icon;
        const value = values[card.key];
        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.06 }}
          >
            <Card className="border-border/70 bg-card/70 backdrop-blur-sm transition-colors hover:border-emerald-500/30">
              <CardContent className="flex items-start gap-3 p-4 sm:p-5">
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                    card.iconClass,
                  )}
                >
                  <Icon className="size-4.5" />
                </div>
                <div className="min-w-0">
                  {isPending || value === undefined ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <div className="font-mono text-2xl font-bold leading-none tabular-nums sm:text-3xl">
                      {value}
                    </div>
                  )}
                  <div className="mt-1.5 truncate text-xs font-medium sm:text-sm">{card.label}</div>
                  <div className="mt-0.5 hidden truncate text-[11px] text-muted-foreground sm:block">
                    {card.desc}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
