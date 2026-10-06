# Android Guru Agent · MCP & 插件枢纽 — Worklog

项目：基于 Web 的 MCP & 插件管理枢纽（对应 Android-Guru-Agent / apex-agent 生态）
Next.js 16 App Router · TypeScript · Tailwind 4 · shadcn/ui · Prisma(SQLite)
用户唯一可见路由：`/`（src/app/page.tsx）

---

Task ID: 1
Agent: main (Z.ai Code)
Task: 基础层 — 调研 Android-Guru-Agent 仓库格式、Prisma schema、共享类型、MCP 多格式库、种子数据

Work Log:
- 克隆并深度调研 /home/z/android-guru-ref（Android-Guru-Agent，Kotlin Android 全设备自主 Agent）
- 确认 MCP 配置格式兼容矩阵（McpConfigImport.kt 推断规则）：
  * mcpServers 包装 = Claude Desktop / Cursor / Cline / Operit mcp_config.json 通用格式（Anthropic 官方）
  * apex 数组 = mcp_servers.json（List<McpServerConfig>）
  * hub index = apex-mcp-hub index.json {"servers":[...]}
  * 裸服务器对象自动包装
  * 传输推断：command→STDIO；type=streamable_http|http→HTTP；type=sse→SSE；仅 url→HTTP
  * Operit 约定：STDIO 强制 runInSandbox=true + enabled=false（安装≠启动）
- 确认插件格式：Operit（GitHub repo + mcp_config.json）、Anthropic marketplace.json（plugins 数组）、Anthropic Agent Skills（SKILL.md YAML frontmatter）
- 写入 prisma/schema.prisma（McpServer / Plugin / ImportLog 三模型）并 bun run db:push 成功
- 写入 src/lib/types.ts（McpServerDto / PluginDto / ImportFormat 等全部共享类型）
- 写入 src/lib/mcp-formats.ts（detectFormat / parseMcpText / toClaudeFormat / toApexFormat / toHubFormat / toOperitFormat / parseMarketplaceJson / parseSkillMd）
- 写入 src/lib/seed-data.ts（30 个 MCP：16 编程 + 14 逆向；9 个插件：4 Operit + 2 Anthropic marketplace + 3 Agent Skills）
- 写入 src/lib/seed.ts（ensureSeeded 幂等种子）
- tsc 全项目类型检查通过（仅遗留 examples/skills 旧文件报错，与本项目无关）

Stage Summary:
- 基础层就绪。所有格式处理逻辑在 src/lib/mcp-formats.ts，可被 API 路由直接复用
- 关键约定：DB 中 args/env/headers/tags 以 JSON 字符串存储，API 层负责序列化/反序列化
- 安装≠启动：所有 enabled 默认 false
- 数据库：SQLite db/custom.db，`import { db } from '@/lib/db'`

============================================================================
API CONTRACT（Task 3-a 后端 & Task 3-b 前端共同遵守）
============================================================================

【类型】见 src/lib/types.ts（McpServerDto / PluginDto / ImportResponse / IMPORT_FORMAT_LABELS / TRANSPORT_LABELS / SCOPE_LABELS / CATEGORY_LABELS / PLUGIN_FORMAT_LABELS）

【路由】全部在 src/app/api/ 下：

1. GET /api/stats
   → { servers: { total, installed, enabled, programming, reverse }, plugins: { total, operit, anthropic }, logs: [{id,kind,format,total,success,failed,createdAt}] (最近10条) }
   内部先调 ensureSeeded()

2. GET /api/mcp?q=&category=all|programming|reverse&filter=all|installed|enabled
   → { servers: McpServerDto[] }（ensureSeeded 后查询；多条件模糊匹配 name/description/tags）
   POST /api/mcp body: McpServerConfig（手工新增，source=manual, installed=true）
   → { ok, server: McpServerDto } | { ok:false, error }

3. PATCH /api/mcp/[id] body: 部分字段（enabled/runInSandbox/args/env/name/description/...均可）
   DELETE /api/mcp/[id]
   → { ok: true } | { ok:false, error }

4. POST /api/mcp/install body: { ids: string[] }（目录批量安装：installed=true, enabled=false；已存在同名 import 条目跳过）
   → { ok, installed: number }

5. POST /api/mcp/import body: { text: string }
   逻辑：detectFormat → parseMcpText → 逐条校验（复用 mcp-formats）→ upsert（同名跳过，reason=NAME_DUPLICATE）→ 写 ImportLog
   STDIO 条目强制 runInSandbox=true, enabled=false（Operit/apex 约定）
   → ImportResponse（见 types.ts：format/total/success/failed/added/skipped/errors）

6. GET /api/mcp/export?format=claude|apex|hub|operit&filter=installed|enabled|all&download=1
   filter=installed（默认）：已安装；enabled：仅启用；all：全目录
   返回 JSON 文本；download=1 时加 Content-Disposition attachment（文件名见 EXPORT_FORMATS.file）
   无 download=1 时返回 { ok, format, filename, content } 供前端预览模态框

7. GET /api/plugins?format=all|operit|anthropic-marketplace|anthropic-skill&q=
   → { plugins: PluginDto[] }（ensureSeeded；config 字段返回解析后的对象）
   PATCH /api/plugins/[id]（enabled 等字段）、DELETE /api/plugins/[id]
   → { ok } | { ok:false, error }

8. POST /api/plugins/import body: { text: string }
   逻辑：detectFormat → claude-marketplace → parseMarketplaceJson 逐条入库；skill-md → parseSkillMd 入库；mcpServers → Operit 插件入库（config=原始 mcpServers JSON）
   → { ok, format, added: number, names: string[] } | { ok:false, error }

【序列化帮助】建议在 src/lib/serialize.ts 放 serverToDto(dbRow) / pluginToDto(dbRow) 供各路由复用（JSON.parse args/env/headers/tags/config，Date→ISO）

【前端契约】（Task 3-b）
- 唯一路由 `/`；src/app/page.tsx 为壳，组件在 src/components/hub/
- 5 个 Tab：总览 / MCP 市场 / 我的服务器 / 导入·导出 / 插件中心
- 布局：sticky header + min-h-screen flex flex-col + footer mt-auto（sticky footer 铁律）
- 主题：next-themes 暗色优先，emerald 主色调，禁用 indigo/blue
- 交互：所有 fetch 走 TanStack Query 或裸 fetch + sonner toast 反馈；安装/启用/删除后乐观刷新
- 所有列表区 max-h + overflow-y-auto 自定义滚动条；卡片 p-4/p-6 对齐

============================================================================

---
Task ID: 3-a
Agent: full-stack-developer (backend)
Task: 后端 API 全量实现 — serialize 帮助 + 10 个路由（stats / mcp CRUD·install·import·export / plugins CRUD·import）

Work Log:
- 新建 src/lib/serialize.ts：safeJsonParse / serverToDto / pluginToDto / rowToConfig / logToDto / mcpConfigToDbData / isWarningError（EMPTY_ARGS 等警告前缀判定），统一处理 JSON 字符串字段的出入库与 Date→ISO
- GET /api/stats：ensureSeeded → 6 组 count（servers.total/installed/enabled/programming/reverse + plugins.total/operit/anthropic）+ 最近 10 条 ImportLog
- /api/mcp：GET 支持 q（name/description/tags 模糊，tags 命中 JSON 字符串 contains）/ category / filter；POST 复用 parseMcpText 裸服务器路径做传输层推断与冲突校验（AMBIGUOUS/STDIO_NO_COMMAND 等 apex 错误码），source=manual、installed=true、enabled 默认 false
- /api/mcp/[id]：PATCH 白名单校验全部可编辑字段（args/env/headers/tags 落库 JSON.stringify，transport/scope/category 枚举校验）、DELETE；404/400 分区清晰
- /api/mcp/install：ids 批量 installed=true + enabled=false（安装≠启动）
- /api/mcp/import（核心）：detectFormat → parseMcpText → 批量预查重（findMany name in [...]）→ 逐条入库；STDIO 强制 runInSandbox=true + enabled=false；同名（库内/本批次）跳过 reason=NAME_DUPLICATE；EMPTY_ARGS 警告级仍导入并计入 errors；marketplace/skill-md 文本误入时 400 引导去插件中心；写 ImportLog(kind=mcp)
- /api/mcp/export：claude|apex|hub|operit × installed|enabled|all（默认 installed）；rowToConfig → EXPORT_FORMATS.make；download=1 返回 Content-Disposition attachment（文件名取 spec.file）+ application/json，否则 { ok, format, filename, content }
- /api/plugins：GET format/q 过滤（config 解析为对象、skillBody 原样返回）；POST 手工建插件（pluginType 按格式缺省推导：operit→mcp，anthropic 两类→skill）
- /api/plugins/[id]：PATCH/DELETE 同 mcp 模式
- /api/plugins/import：claude-marketplace → parseMarketplaceJson 逐条入库（author=owner.name）；skill-md → parseSkillMd（config={name,description,license}，skillBody=正文）；mcpServers/apex-array/hub-index/bare-server → 单个 Operit 结构插件（config 规整为 mcpServers 形态，name 取 body.name 或 operit-<timestamp>）；(format,name) 去重；解析异常 try/catch → 400
- 全端点 curl 验证（详见下方 Stage Summary）；测试产生的 demo 数据全部经 API 删除，目录 install 状态回滚，最终 30 MCP / 9 插件 / 0 installed 的干净种子态
- bun run lint：本人 10 个文件 0 error（项目仅剩 src/components/hub/mcp-detail-dialog.tsx 3 个 error，属 3-b 前端并行文件，不在本任务范围）；tsc --noEmit 仅遗留 examples/skills 旧文件报错（与本项目无关）

Stage Summary:
- 文件清单：src/lib/serialize.ts；src/app/api/stats/route.ts；src/app/api/mcp/route.ts；src/app/api/mcp/[id]/route.ts；src/app/api/mcp/install/route.ts；src/app/api/mcp/import/route.ts；src/app/api/mcp/export/route.ts；src/app/api/plugins/route.ts；src/app/api/plugins/[id]/route.ts；src/app/api/plugins/import/route.ts
- curl 验证（全部通过）：GET /api/stats 200（30/16/14、9/4/5、logs 数组）；GET /api/mcp?q=frida→[frida]、q=抓包→[burp-suite,playwright]、category=reverse→14、filter=installed→计数正确；POST /api/mcp 200（manual+installed=true+enabled=false）／缺 name 400／AMBIGUOUS 400／重名 400／仅 url 推断 HTTP 200；PATCH 改 enabled/tags/args/env 200（JSON 往返正确）／transport=QUIC 400／404 正确；DELETE 200/404 正确；POST /api/mcp/install {ids:[3]}→{ok,installed:3} 且 enabled 全 false；POST /api/mcp/import 任务样例 {"mcpServers":{"demo":{"command":"npx","args":["-y","foo"]}}}→{ok,format:mcpServers,total:1,success:1,added:[{name:demo,transport:STDIO}]}，demo 落库 source=import/runInSandbox=true/enabled=false；重复导入→skipped NAME_DUPLICATE；混合导入（无 command→failed、npx 空 args→警告仍导入、SSE 远程→成功）全部符合预期；apex-array/hub-index/bare-server 三格式导入通过；marketplace 误入→400 引导；未知格式/空 text→400；export 四格式 preview 200（filename=claude_mcp.json/mcp_servers.json/index.json/mcp_config.json）+ download=1 头部正确（Content-Disposition attachment + application/json）+ 非法 format 400；plugins GET 过滤/skillBody/config 解析正确；POST/PATCH/DELETE 200/400/404 正确；plugins/import 三格式（operit 含自定义名与派生名、SKILL.md、marketplace 2 条）+ 去重 + 坏文本 400 全通过
- 与契约的偏差/解释（均为超集或边界加固，不破坏 3-b 调用）：
  1) PATCH /api/mcp/[id] 与 /api/plugins/[id] 返回 { ok:true, server|plugin: Dto }（契约只要求 { ok:true }，附加字段便于前端乐观刷新）
  2) POST /api/mcp 的 enabled 尊重 body 显式 true（默认 false），source/installed 按契约强制
  3) MCP 导入的警告级错误（EMPTY_ARGS，库注释"警告，仍可导入"）仍入库并在 errors 提示；AMBIGUOUS/NAME_BLANK/STDIO_NO_COMMAND/REMOTE_* 为硬错误跳过计入 failed；警告仅在条目真正入库时记录（避免与 NAME_DUPLICATE 跳过混淆）
  4) marketplace/skill-md 文本进入 /api/mcp/import → 400 附"请前往插件中心导入"提示；合法格式但 0 条目（如 {"mcpServers":{}}）→ 400
  5) plugins/import 请求体支持可选 name 字段（Operit 插件命名）；响应在 { ok, format, added, names } 基础上附加 skipped；operit config 统一 mcpServers 形态（apex-array/hub-index/bare-server 经 toClaudeFormat 规整）
  6) GET /api/plugins 非法 format 值按 all 处理（宽松）；stats.plugins.anthropic = marketplace + skill 之和
  7) ImportLog 为审计记录无删除 API，测试导入的日志保留（总览页"最近导入"有真实数据可展示）；测试产生的服务器/插件已全部清理，种子目录回到初始状态
- 后端就绪，3-b 前端可直接按上方契约联调；所有路由 5xx 兜底 { ok:false, error }，动态路由参数按 Next.js 16 异步约定 await ctx.params

---
Task ID: 3-b
Agent: frontend-styling-expert
Task: 构建完整前端 — MCP & 插件管理枢纽单页应用（5 Tab：总览 / MCP 市场 / 我的服务器 / 导入·导出 / 插件中心）

Work Log:
- 通读 worklog API 契约、src/lib/types.ts、seed-data、mcp-formats、prisma schema，确认 DTO 形状与格式约定
- globals.css 追加 hub 样式：.hub-scroll（emerald 细滚动条）、.hub-grid-bg（网格背景）、.hub-dots-bg（点阵背景）、emerald 选中文本色
- 基础设施：providers.tsx（QueryClient + next-themes defaultTheme=dark）、api.ts（类型化 fetch 封装 + 全部端点 + downloadExport blob 下载 + errorMessage/formatLabel 工具）、use-debounce.ts、nav.ts（HubTab 类型）
- 共享组件：badges.tsx（Transport/Vendor/Category/Scope/Sandbox/PluginFormat/LogKind 徽章）、json-block.tsx（轻量 JSON 语法着色：key=emerald/string=amber/number=lime）、copy-button.tsx、command-line.tsx（终端风命令预览）、mcp-detail-dialog.tsx（详情弹窗：全参数命令、env 值脱敏、headers、homepage、完整配置 JSON + 复制、安装按钮）
- header.tsx（sticky + emerald Terminal 图标 + 6 个兼容格式 mono 徽章 + GitHub + 主题切换）、footer.tsx（mt-auto + 仓库链接）、stats-cards.tsx（4 张统计卡 + 骨架屏）
- overview-tab.tsx：分类分布双进度条（emerald/amber + 动画）、最近导入日志（date-fns zhCN 相对时间）、4 张快捷操作卡（含 claude/installed 下载集合）
- market-tab.tsx：搜索（300ms 防抖）+ 分类/传输 Select + 安装全部筛选结果 + 1/2/3 列响应式卡片网格（motion 入场）+ 详情弹窗 + 空态/骨架/错误态
- servers-tab.tsx：仅已安装列表行 + 启用 Switch（乐观更新+回滚）+ 启用全部/全部停用（Promise.allSettled）+ DropdownMenu（详情/编辑/删除）+ ServerFormDialog（新增+编辑，args 每行一条、env KEY=value 校验）+ AlertDialog 删除确认 + 空态去市场
- import-export-tab.tsx：终端窗口风 textarea（红黄绿圆点）+ 4 个示例 chip（Claude/apex/Hub/裸服务器，各异名避免重复跳过）+ 一键导入结果面板（格式徽章/成功·跳过·失败/added/skipped/errors 滚动列表）+ 6 格式支持说明 + 导出区（范围 Select + 4 格式卡各带预览弹窗与下载按钮）+ 下载后如何使用三步说明
- plugins-tab.tsx：插件导入区（Operit 示例 + SKILL.md 示例 chip）+ 格式 Select + 搜索 + 1/2/3 列卡片（Switch 乐观更新 + 删除确认）+ 详情弹窗按格式差异化（operit→config JSON+复制+repo 链接 / marketplace→元数据 dl / skill→SKILL.md 正文 mono 滚动块）
- layout.tsx：lang=zh-CN、中文 metadata、Providers 包裹 + sonner Toaster（top-center richColors）；page.tsx 重写为客户端壳（min-h-screen flex-col + hub-grid-bg + 5 Tab，activeTab 状态提升支持跨 Tab 跳转）
- ESLint 0 错误（修复 mcp-detail-dialog 3 处 react/jsx-no-comment-textnodes）、tsc 仅剩遗留 examples/skills 报错
- 浏览器端到端验证（agent-browser）：安装/启用 Switch/编辑弹窗/导入成功+NAME_DUPLICATE 跳过/导出预览/插件导入 SKILL.md/主题切换 light/dark/移动端 390px，全程无 console 错误；测试数据已全部清理还原（30 服务器 / 0 安装 / 9 插件）

Stage Summary:
- 新建 17 个文件于 src/components/hub/ + 重写 src/app/page.tsx + 更新 src/app/layout.tsx + 追加 globals.css 样式（未触碰 api/lib/prisma）
- 设计：emerald 主色暗色优先、终端美学（❯ 提示符、// 注释标题、红黄绿窗口圆点、mono 命令块、网格/点阵背景）、framer-motion 轻量入场动画、hub-scroll 自定义滚动条、全中文 UI（技术词保留英文）
- 状态管理：TanStack Query（["stats"]/["mcp",params]/["plugins",params] 前缀失效），Switch/启用走乐观更新；所有异步操作有 loading + sonner toast，所有删除有 AlertDialog 确认
- API 契约验证全部通过（后端 3-a 已就位）：stats/mcp 查询/install/PATCH(enabled,installed)/import(mcpServers 含 HTTP+SSE 条目)/export 预览与 Content-Disposition 下载/plugins import(SKILL.md + Operit mcpServers)
- 契约备注：① Operit mcpServers 插件导入后插件名由后端自动生成（如 operit-<timestamp>），前端以响应 names[] 展示，无影响；② PATCH /api/mcp/[id] 支持 installed 字段（用于还原目录状态）；③ 导入日志 kind∈{mcp,plugin}、format 为宽松 string，前端已做 asImportFormat 收窄

---
Task ID: 4
Agent: main (Z.ai Code)
Task: 集成验证 — lint / dev.log / agent-browser 端到端全流程自测

Work Log:
- bun run lint 全项目 0 错误；tsc 仅遗留 examples/skills 旧文件报错（与本项目无关）
- dev.log 全程无编译/运行错误，所有 API 200
- agent-browser 端到端验证（桌面 1280x900 + 移动 390x844）：
  * 首屏渲染：暗色主题、4 统计卡（30/0/0/9）、6 兼容格式徽章、5 Tab 全部就位（VLM 复核确认）
  * MCP 市场：30 卡片全渲染（DOM 校验含完整描述/命令/标签），搜索 "ghidra" 正确过滤到 1 条，单卡安装成功（installed=true, enabled=false）
  * 我的服务器：ghidra 出现，启用 Switch 切换 → API 确认 enabled=true
  * 一键导入：粘贴双服务器 mcpServers JSON（STDIO + streamable_http 远程）→ 检测格式 Claude Desktop/Cursor/Cline/Operit，成功 2 跳过 0；重复导入 → 成功 0 跳过 2（NAME_DUPLICATE 原因逐条展示）
  * 导出：Claude 格式预览弹窗内容正确（含 runInSandbox/scope 扩展字段）；下载按钮 → blob 下载 + toast「已下载 claude_mcp.json」
  * 插件中心：9 个种子插件全部展示；SKILL.md 示例导入 → demo-skill 创建（含正文）；Operit 示例导入 → operit-<ts> 创建（含 mcpServers 配置）；插件详情弹窗按格式差异化渲染（SKILL.md 正文 / mcpServers JSON）
  * 主题切换：暗↔亮 均正常（VLM 确认 light 主题无白底白字）
  * 移动端 390px：5 Tab 可见、无横向溢出
  * 粘性页脚：短内容时 footerBottom=viewportH（0 间隙贴底），长内容时自然下推（footerBottom=docH）
- 控制台 0 错误、0 警告；页面 0 error
- 测试数据清理：删除 everything-claude/my-remote/demo-skill/operit-*，ghidra 还原为未安装未启用 → 回归种子态（30 MCP / 0 安装 / 9 插件）
- VLM 终审 9/10：3 项「缺陷」均为误报（N 圆点=Next.js dev 指示器仅开发态；导入日志为历史审计记录；破折号截断=中文标点 line-clamp）

Stage Summary:
- 全功能端到端验证通过：30 MCP 目录（16 编程 + 14 逆向）、多格式一键导入、4 格式导出下载、Operit/Anthropic 插件双生态、暗亮主题、响应式、粘性页脚
- 项目达到可交付状态；测试数据已清理，用户首屏为纯净种子态
