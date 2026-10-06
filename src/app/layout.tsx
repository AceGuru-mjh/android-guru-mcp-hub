import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/hub/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Android Guru Agent · MCP & 插件枢纽",
  description:
    "Android Guru Agent（apex-agent）的 MCP 服务器与插件管理枢纽：浏览 30 个编程与逆向工程 MCP 目录，一键导入 Claude Desktop / Cursor / Cline / Operit / apex-agent 多格式配置，管理 Operit 插件、Anthropic 插件市场与 Agent Skills。",
  keywords: [
    "MCP",
    "Model Context Protocol",
    "Android Guru Agent",
    "apex-agent",
    "Operit",
    "Anthropic",
    "Claude Desktop",
    "插件管理",
    "逆向工程",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
