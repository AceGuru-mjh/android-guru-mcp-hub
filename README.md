# Android Guru Agent · MCP & 插件枢纽

> [Android-Guru-Agent](https://github.com/AceGuru-mjh/Android-Guru-Agent)（apex-agent）生态的 Web 管理控制台 —— MCP 服务器目录、多格式一键导入/导出、Operit 结构插件、Anthropic 插件生态一站式管理。

![Next.js](https://img.shields.io/badge/Next.js%2016-App%20Router-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6) ![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-4-38BDF8) ![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748) ![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-emerald)

## ✨ 功能

### 🗂 MCP 市场（30 个精选目录）
- **16 编程开发**：filesystem、GitHub、Git、sequential-thinking、fetch、Playwright、Context7、Serena（LSP 语义分析）、Desktop Commander、Docker、TypeScript、Semgrep（SAST）……
- **14 逆向工程**：**Ghidra、IDA Pro、radare2、Frida、Binary Ninja、jadx、apktool、Android ADB、Shodan、nmap、Burp Suite、YARA、Capstone、Volatility**
- 搜索 / 分类 / 传输层过滤、批量安装、详情弹窗（env 脱敏、完整配置 JSON、一键复制）
- 严守 apex-agent 约定：**安装 ≠ 启动**（所有条目默认 `enabled=false`），STDIO 默认 `runInSandbox=true`

### 📥 一键 JSON 导入（自动格式检测）
| 格式 | 兼容来源 |
|---|---|
| `{"mcpServers":{...}}` | **Claude Desktop / Claude Code / Cursor / Cline / Operit mcp_config.json**（Anthropic 官方格式） |
| `[{...}]` 数组 | apex-agent `mcp_servers.json`（`List<McpServerConfig>`） |
| `{"servers":[...]}` | apex-mcp-hub `index.json` 目录格式 |
| 裸服务器对象 | 单条配置自动包装 |

- 传输层推断与 apex `McpConfigImport.kt` 完全对齐：`command`→STDIO；`type=streamable_http/http`→HTTP；`type=sse`→SSE；仅 `url`→HTTP
- 逐条校验（`STDIO_NO_COMMAND` / `REMOTE_BAD_URL` / `AMBIGUOUS` 等错误码），同名 `NAME_DUPLICATE` 跳过，错误逐条报告不静默丢弃

### 📤 整套下载本地运行（4 种目标格式）
| 格式 | 文件 | 用途 |
|---|---|---|
| Claude / Anthropic | `claude_mcp.json` | Claude Desktop / Cursor / Cline 直接粘贴 |
| apex-agent | `mcp_servers.json` | 推送到设备 `<filesDir>/mcp_config/` 直接加载 |
| apex-mcp-hub | `index.json` | 自建 Hub 目录源，App 内 Hub 源可直接拉取 |
| Operit | `mcp_config.json` | 放入 Operit 插件仓库根目录（STDIO 强制沙箱） |

- 三种导出范围：已安装 / 仅启用 / 全部目录；支持预览、复制、文件下载

### 🧩 插件中心（双生态）
- **Operit 结构**：`mcp_config.json` 约定插件（内置 4 个示例：MCP 桥接、r0capture 抓包、Frida 工具箱、签名绕过）
- **Anthropic 插件市场**：`.claude-plugin/marketplace.json`（`{"owner":{},"plugins":[...]}`）解析入库
- **Anthropic Agent Skills**：`SKILL.md`（YAML frontmatter `name`/`description`）正文完整保留与渲染
- 粘贴导入 + 启用/停用 + 删除，格式徽章区分

## 🚀 快速开始

```bash
bun install          # 安装依赖
bun run db:push      # 初始化 SQLite（首次运行必须）
bun run dev          # 启动 http://localhost:3000
```

> 首次访问任意 API 时自动幂等灌入种子数据（30 MCP + 9 插件），无需手动 seed。

## 🔌 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/stats` | 总览统计 + 最近导入日志 |
| GET/POST | `/api/mcp` | 目录查询（`q`/`category`/`filter`）/ 手工新增 |
| PATCH/DELETE | `/api/mcp/[id]` | 部分更新（enabled/runInSandbox/args/env…）/ 删除 |
| POST | `/api/mcp/install` | 批量安装 `{ids:[...]}` |
| POST | `/api/mcp/import` | **一键导入** `{text:"..."}` → 多格式检测解析 |
| GET | `/api/mcp/export` | 导出 `?format=claude\|apex\|hub\|operit&filter=...&download=1` |
| GET/POST | `/api/plugins` | 插件查询 / 新增 |
| PATCH/DELETE | `/api/plugins/[id]` | 插件更新 / 删除 |
| POST | `/api/plugins/import` | 插件导入（Operit / marketplace.json / SKILL.md） |

## 🏗 技术栈

Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite · TanStack Query · next-themes（暗色优先）· sonner

## 📁 结构

```
prisma/schema.prisma        # McpServer / Plugin / ImportLog 三模型
src/lib/types.ts            # 共享类型（DTO / 格式标签）
src/lib/mcp-formats.ts      # ★ 核心：多格式检测/解析/导出（对齐 apex McpConfigImport）
src/lib/seed-data.ts        # 30 MCP + 9 插件种子目录
src/app/api/                # 10 个 API 路由
src/components/hub/         # 5 Tab 全部 UI 组件
```

## 🔗 相关仓库

- [Android-Guru-Agent](https://github.com/AceGuru-mjh/Android-Guru-Agent) — 主应用（Android 全设备自主 Agent）
- [apex-mcp-hub](https://github.com/AceGuru-mjh/apex-mcp-hub) — 官方 MCP 目录仓库（本枢纽导出的 `index.json` 可作为其数据源）

## 📄 License

MIT
