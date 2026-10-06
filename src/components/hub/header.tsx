"use client";

import { Github, Moon, Sun, Terminal } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const COMPAT_BADGES = [
  "Claude Desktop",
  "Cursor",
  "Cline",
  "Operit",
  "apex-agent",
  "Anthropic",
] as const;

/** 顶部粘性导航：Logo / 标题 / 兼容格式徽章 / GitHub / 主题切换 */
export function HubHeader() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="hub-dots-bg">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-500 shadow-[0_0_16px_-4px] shadow-emerald-500/40">
                <Terminal className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-mono text-sm font-bold tracking-tight sm:text-base">
                  Android Guru Agent
                </h1>
                <p className="truncate text-xs text-muted-foreground">
                  MCP &amp; 插件枢纽 · on-device AI Agent 控制台
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                <a
                  href="https://github.com/AceGuru-mjh/Android-Guru-Agent"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Github className="size-4" />
                  GitHub
                </a>
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="切换亮暗主题"
                title="切换亮暗主题"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                <Sun className="size-4 dark:hidden" />
                <Moon className="hidden size-4 dark:block" />
              </Button>
            </div>
          </div>

          {/* 格式兼容徽章 */}
          <div className="hub-scroll -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
              {"// 兼容格式"}
            </span>
            {COMPAT_BADGES.map((badge) => (
              <span
                key={badge}
                className="shrink-0 rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
