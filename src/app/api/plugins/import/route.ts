/**
 * POST /api/plugins/import — 一键导入插件（3 类格式）
 *
 * body: { text: string, name?: string }（name 仅 Operit 结构插件需要，缺省自动派生）
 *
 *   - claude-marketplace → parseMarketplaceJson 逐条入库（format=anthropic-marketplace, pluginType=skill）
 *   - skill-md           → parseSkillMd 入库（format=anthropic-skill, pluginType=skill, skillBody=正文）
 *   - mcpServers / apex-array / hub-index / bare-server → Operit 结构插件
 *       （format=operit, pluginType=mcp, config 规整为 mcpServers 形态）
 *
 * 去重：同 format + name 已存在 → skipped（reason=NAME_DUPLICATE）
 * → { ok, format, added, names, skipped } | 400 { ok:false, error }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  detectFormat,
  parseMarketplaceJson,
  parseMcpText,
  parseSkillMd,
  toClaudeFormat,
} from "@/lib/mcp-formats";
import { isWarningError } from "@/lib/serialize";

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
    }
    const b = body as { text?: unknown; name?: unknown } | null;
    const text = typeof b?.text === "string" ? b.text : "";
    if (!text.trim()) {
      return NextResponse.json({ ok: false, error: "text 不能为空" }, { status: 400 });
    }
    const customName = typeof b?.name === "string" ? b.name.trim() : "";

    const format = detectFormat(text);
    if (format === "unknown") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "无法识别的插件格式：支持 Operit mcp_config.json（mcpServers / apex 数组 / hub index / 裸服务器）、Anthropic marketplace.json、Agent Skills SKILL.md",
        },
        { status: 400 },
      );
    }

    const skipped: { name: string; reason: string }[] = [];
    const names: string[] = [];
    const errors: string[] = [];
    let total = 0;
    let success = 0;

    if (format === "claude-marketplace") {
      // ---- Anthropic 插件市场 ----
      let parsed;
      try {
        parsed = parseMarketplaceJson(text);
      } catch (e) {
        return NextResponse.json(
          { ok: false, error: e instanceof Error ? e.message : "marketplace.json 解析失败" },
          { status: 400 },
        );
      }
      if (parsed.length === 0) {
        return NextResponse.json(
          { ok: false, error: "marketplace.json 中没有有效插件条目（缺少 name 或 source）" },
          { status: 400 },
        );
      }
      total = parsed.length;

      const existing = await db.plugin.findMany({
        where: { format: "anthropic-marketplace", name: { in: parsed.map((p) => p.name) } },
        select: { name: true },
      });
      const existingNames = new Set(existing.map((r) => r.name));

      for (const p of parsed) {
        if (existingNames.has(p.name)) {
          skipped.push({ name: p.name, reason: "NAME_DUPLICATE：同名插件已存在" });
          continue;
        }
        await db.plugin.create({
          data: {
            name: p.name,
            description: p.description,
            version: p.version,
            author: p.author, // 来自 marketplace.json 的 owner.name
            format: "anthropic-marketplace",
            pluginType: "skill",
            config: JSON.stringify(p.config),
            skillBody: null,
            enabled: false,
            installed: true,
            sourceUrl: p.sourceUrl,
            repo: null,
            tags: JSON.stringify(p.tags),
          },
        });
        existingNames.add(p.name);
        names.push(p.name);
        success += 1;
      }
    } else if (format === "skill-md") {
      // ---- Anthropic Agent Skills（SKILL.md）----
      let skill;
      try {
        skill = parseSkillMd(text);
      } catch (e) {
        return NextResponse.json(
          { ok: false, error: e instanceof Error ? e.message : "SKILL.md 解析失败" },
          { status: 400 },
        );
      }
      total = 1;

      const existing = await db.plugin.findFirst({
        where: { format: "anthropic-skill", name: skill.name },
        select: { id: true },
      });
      if (existing) {
        skipped.push({ name: skill.name, reason: "NAME_DUPLICATE：同名插件已存在" });
      } else {
        await db.plugin.create({
          data: {
            name: skill.name,
            description: skill.description,
            version: "1.0.0",
            author: "",
            format: "anthropic-skill",
            pluginType: "skill",
            config: JSON.stringify({
              name: skill.name,
              description: skill.description,
              license: skill.license,
            }),
            skillBody: skill.body,
            enabled: false,
            installed: true,
            sourceUrl: null,
            repo: null,
            tags: JSON.stringify([]),
          },
        });
        names.push(skill.name);
        success += 1;
      }
    } else {
      // ---- Operit 结构插件（mcpServers / apex-array / hub-index / bare-server）----
      total = 1;

      const { entries } = parseMcpText(text);
      if (entries.length === 0) {
        return NextResponse.json(
          { ok: false, error: "未从配置中解析到任何 MCP 服务器条目" },
          { status: 400 },
        );
      }

      // config 统一规整为 mcpServers 形态（与 Operit mcp_config.json 一致）
      let configObj: Record<string, unknown>;
      try {
        const raw = JSON.parse(text.trim()) as unknown;
        if (format === "mcpServers" && raw && typeof raw === "object" && !Array.isArray(raw)) {
          configObj = raw as Record<string, unknown>;
        } else {
          const valid = entries
            .filter((e) => !e.error || isWarningError(e.error))
            .map((e) => e.server);
          configObj = JSON.parse(toClaudeFormat(valid)) as Record<string, unknown>;
        }
      } catch {
        return NextResponse.json({ ok: false, error: "配置 JSON 解析失败" }, { status: 400 });
      }

      for (const e of entries) {
        if (e.error && !isWarningError(e.error)) errors.push(`${e.server.name || "(未命名)"}：${e.error}`);
      }

      const pluginName = customName || `operit-${Date.now()}`;
      const serverCount = entries.length;

      const existing = await db.plugin.findFirst({
        where: { format: "operit", name: pluginName },
        select: { id: true },
      });
      if (existing) {
        skipped.push({ name: pluginName, reason: "NAME_DUPLICATE：同名插件已存在" });
      } else {
        await db.plugin.create({
          data: {
            name: pluginName,
            description: `Operit 结构插件（含 ${serverCount} 个 MCP 服务器配置）`,
            version: "1.0.0",
            author: "",
            format: "operit",
            pluginType: "mcp",
            config: JSON.stringify(configObj),
            skillBody: null,
            enabled: false,
            installed: true,
            sourceUrl: null,
            repo: null,
            tags: JSON.stringify(["Operit", "mcp_config"]),
          },
        });
        names.push(pluginName);
        success += 1;
      }
    }

    await db.importLog.create({
      data: {
        kind: "plugin",
        format,
        total,
        success,
        failed: skipped.length,
        errors: JSON.stringify(errors),
      },
    });

    return NextResponse.json({ ok: true, format, added: success, names, skipped });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "插件导入失败" },
      { status: 500 },
    );
  }
}
