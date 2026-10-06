import { ExternalLink } from "lucide-react";

const REPO_URL = "https://github.com/AceGuru-mjh/Android-Guru-Agent";

/** 底部粘性 Footer */
export function HubFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <p className="font-mono">
          <span className="text-emerald-500">❯</span> MCP 一键导入 · Operit 插件 · Anthropic 生态
        </p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 transition-colors hover:text-emerald-500"
        >
          <ExternalLink className="size-3" />
          github.com/AceGuru-mjh/Android-Guru-Agent
        </a>
      </div>
    </footer>
  );
}
