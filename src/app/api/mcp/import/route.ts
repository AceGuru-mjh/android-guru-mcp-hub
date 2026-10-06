/**
 * POST /api/mcp/import — 一键导入 MCP 配置（核心功能）
 *
 * body: { text: string }
 * 流程：detectFormat → parseMcpText → 逐条校验 → 去重入库（source="import", installed=true）
 *   - STDIO 条目强制 runInSandbox=true + enabled=false（Operit/apex 约定，安装 ≠ 启动）
 *   - 同名（库内或本批次）跳过：reason=NAME_DUPLICATE：同名服务器已存在
 *   - 警告级错误（EMPTY_ARGS）仍可导入，计入 errors 提示
 *   - 硬错误条目跳过并计入 failed
 * → ImportResponse | 400 { ok:false, error }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { detectFormat, parseMcpText } from "@/lib/mcp-formats";
import { isWarningError, mcpConfigToDbData } from "@/lib/serialize";
import { IMPORT_FORMAT_LABELS } from "@/lib/types";

const PLUGIN_FORMATS = ["claude-marketplace", "skill-md"] as const;

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
    }
    const text = (body as { text?: unknown } | null)?.text;
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ ok: false, error: "text 不能为空" }, { status: 400 });
    }

    const format = detectFormat(text);
    if (format === "unknown") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "无法识别的配置格式：支持 mcpServers（Claude Desktop / Cursor / Cline / Operit）、apex mcp_servers.json 数组、apex-mcp-hub index.json、单个服务器对象",
        },
        { status: 400 },
      );
    }
    if ((PLUGIN_FORMATS as readonly string[]).includes(format)) {
      return NextResponse.json(
        {
          ok: false,
          error: `检测到 Anthropic 插件格式（${IMPORT_FORMAT_LABELS[format as keyof typeof IMPORT_FORMAT_LABELS]}），请前往「插件中心」导入`,
        },
        { status: 400 },
      );
    }

    const { entries } = parseMcpText(text);
    if (entries.length === 0) {
      return NextResponse.json(
        { ok: false, error: "未从配置中解析到任何服务器条目" },
        { status: 400 },
      );
    }

    // 一次性取出库内同名服务器，避免 N 次查询
    const candidateNames = entries.map((e) => e.server.name).filter((n) => !!n);
    const existingRows = candidateNames.length
      ? await db.mcpServer.findMany({
          where: { name: { in: candidateNames } },
          select: { name: true },
        })
      : [];
    const existingNames = new Set(existingRows.map((r) => r.name));

    const added: { name: string; transport: "STDIO" | "HTTP" | "SSE" }[] = [];
    const skipped: { name: string; reason: string }[] = [];
    const errors: string[] = [];
    const batchNames = new Set<string>();
    let success = 0;
    let failed = 0;

    for (const entry of entries) {
      const name = entry.server.name;
      const label = name || "(未命名)";

      if (entry.error && !isWarningError(entry.error)) {
        failed += 1;
        errors.push(`${label}：${entry.error}`);
        continue;
      }
      if (!name) {
        failed += 1;
        errors.push("(未命名)：服务器名称为空");
        continue;
      }
      if (existingNames.has(name)) {
        skipped.push({ name, reason: "NAME_DUPLICATE：同名服务器已存在" });
        continue;
      }
      if (batchNames.has(name)) {
        skipped.push({ name, reason: "NAME_DUPLICATE：本次导入中存在同名条目" });
        continue;
      }
      if (entry.error) {
        // 警告级（如 EMPTY_ARGS）：仍导入，仅提示
        errors.push(`${label}：${entry.error}（警告，已按原样导入）`);
      }

      const cfg = entry.server;
      // Operit / apex 约定：导入的 STDIO 强制沙箱运行 + 默认停用
      if (cfg.transport === "STDIO") {
        cfg.runInSandbox = true;
        cfg.enabled = false;
      }

      try {
        await db.mcpServer.create({
          data: { ...mcpConfigToDbData(cfg), source: "import", installed: true },
        });
      } catch (e) {
        failed += 1;
        const msg = e instanceof Error ? e.message : "入库失败";
        if (msg.includes("Unique constraint")) {
          skipped.push({ name, reason: "NAME_DUPLICATE：同名服务器已存在" });
          failed -= 1;
        } else {
          errors.push(`${label}：${msg}`);
        }
        continue;
      }

      batchNames.add(name);
      added.push({ name, transport: cfg.transport });
      success += 1;
    }

    await db.importLog.create({
      data: {
        kind: "mcp",
        format,
        total: entries.length,
        success,
        failed,
        errors: JSON.stringify(errors),
      },
    });

    return NextResponse.json({
      ok: true,
      format,
      total: entries.length,
      success,
      failed,
      added,
      skipped,
      errors,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "导入失败" },
      { status: 500 },
    );
  }
}
