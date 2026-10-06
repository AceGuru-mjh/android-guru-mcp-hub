"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 轻量 JSON 语法着色块：key=emerald / string=amber / number=lime / bool=null=orange
 * （终端风格，无外部高亮库）
 */

const TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function renderJson(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    if (match[1] !== undefined) {
      if (match[2] !== undefined) {
        nodes.push(
          <span key={key++} className="text-emerald-600 dark:text-emerald-400">
            {match[1]}
          </span>,
        );
        nodes.push(<span key={key++}>{match[2]}</span>);
      } else {
        nodes.push(
          <span key={key++} className="text-amber-700 dark:text-amber-300/90">
            {match[1]}
          </span>,
        );
      }
    } else if (match[3] !== undefined) {
      nodes.push(
        <span key={key++} className="text-orange-600 dark:text-orange-400">
          {match[3]}
        </span>,
      );
    } else if (match[4] !== undefined) {
      nodes.push(
        <span key={key++} className="text-lime-700 dark:text-lime-300">
          {match[4]}
        </span>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function JsonBlock({
  value,
  className,
}: {
  value: string | Record<string, unknown> | unknown[];
  className?: string;
}) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <pre
      className={cn(
        "hub-scroll overflow-auto rounded-lg border border-border/70 bg-muted/40 p-3 font-mono text-xs leading-relaxed dark:bg-zinc-950/70",
        className,
      )}
    >
      {renderJson(text)}
    </pre>
  );
}
