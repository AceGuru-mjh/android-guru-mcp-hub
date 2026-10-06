"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 复制到剪贴板按钮（带 toast 反馈） */
export function CopyButton({
  text,
  label,
  className,
  variant = "outline",
  size = "sm",
}: {
  text: string;
  label?: string;
  className?: string;
  variant?: "outline" | "ghost" | "secondary" | "default";
  size?: "sm" | "default" | "icon";
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("复制失败，请手动选择复制");
    }
  }

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={handleCopy}>
      {copied ? <Check className="text-emerald-500" /> : <Copy />}
      {label ? <span className="ml-1">{copied ? "已复制" : label}</span> : null}
    </Button>
  );
}
