/**
 * PATCH  /api/mcp/[id] — 部分更新任意可编辑字段（enabled/runInSandbox/args/env/name/...）
 * DELETE /api/mcp/[id] — 删除
 *
 * args/env/headers/tags 仍以 JSON 字符串落库。→ { ok: true } | 404 { ok:false, error }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serverToDto } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

const TRANSPORTS = ["STDIO", "HTTP", "SSE"] as const;
const SCOPES = ["agent", "coding", "all"] as const;
const CATEGORIES = ["programming", "reverse"] as const;

function bad(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return bad("请求体不是合法 JSON");
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return bad("请求体必须是对象");
    }
    const b = body as Record<string, unknown>;

    const data: Record<string, unknown> = {};

    if ("name" in b) {
      if (typeof b.name !== "string" || !b.name.trim()) return bad("name 不能为空");
      data.name = b.name.trim();
    }
    if ("description" in b) {
      if (typeof b.description !== "string") return bad("description 必须是字符串");
      data.description = b.description;
    }
    if ("transport" in b) {
      const t = typeof b.transport === "string" ? b.transport.trim().toUpperCase() : "";
      if (!(TRANSPORTS as readonly string[]).includes(t)) {
        return bad("transport 必须是 STDIO | HTTP | SSE");
      }
      data.transport = t;
    }
    if ("url" in b) {
      if (b.url !== null && typeof b.url !== "string") return bad("url 必须是字符串或 null");
      data.url = b.url === "" ? null : b.url;
    }
    if ("command" in b) {
      if (b.command !== null && typeof b.command !== "string") return bad("command 必须是字符串或 null");
      data.command = b.command === "" ? null : b.command;
    }
    if ("args" in b) {
      if (!Array.isArray(b.args) || !b.args.every((x) => typeof x === "string")) {
        return bad("args 必须是字符串数组");
      }
      data.args = JSON.stringify(b.args);
    }
    if ("env" in b || "headers" in b) {
      for (const key of ["env", "headers"] as const) {
        if (!(key in b)) continue;
        const v = b[key];
        if (typeof v !== "object" || v === null || Array.isArray(v)) {
          return bad(`${key} 必须是 Record<string, string>`);
        }
        const rec: Record<string, string> = {};
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
          if (typeof val === "string") rec[k] = val;
          else if (typeof val === "number" || typeof val === "boolean") rec[k] = String(val);
          else return bad(`${key}.${k} 必须是字符串`);
        }
        data[key] = JSON.stringify(rec);
      }
    }
    if ("tags" in b) {
      if (!Array.isArray(b.tags) || !b.tags.every((x) => typeof x === "string")) {
        return bad("tags 必须是字符串数组");
      }
      data.tags = JSON.stringify(b.tags);
    }
    if ("apiKey" in b) {
      if (b.apiKey !== null && typeof b.apiKey !== "string") return bad("apiKey 必须是字符串或 null");
      data.apiKey = b.apiKey === "" ? null : b.apiKey;
    }
    if ("vendor" in b) {
      if (b.vendor !== null && typeof b.vendor !== "string") return bad("vendor 必须是字符串或 null");
      data.vendor = b.vendor === "" ? null : b.vendor;
    }
    if ("homepage" in b) {
      if (b.homepage !== null && typeof b.homepage !== "string") return bad("homepage 必须是字符串或 null");
      data.homepage = b.homepage === "" ? null : b.homepage;
    }
    for (const key of ["enabled", "runInSandbox", "installed"] as const) {
      if (key in b) {
        if (typeof b[key] !== "boolean") return bad(`${key} 必须是布尔值`);
        data[key] = b[key];
      }
    }
    if ("scope" in b) {
      if (!(SCOPES as readonly string[]).includes(b.scope as string)) return bad("scope 必须是 agent | coding | all");
      data.scope = b.scope;
    }
    if ("category" in b) {
      if (!(CATEGORIES as readonly string[]).includes(b.category as string)) {
        return bad("category 必须是 programming | reverse");
      }
      data.category = b.category;
    }

    if (Object.keys(data).length === 0) return bad("没有可更新的字段");

    const existing = await db.mcpServer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "服务器不存在" }, { status: 404 });
    }

    try {
      const row = await db.mcpServer.update({ where: { id }, data });
      return NextResponse.json({ ok: true, server: serverToDto(row) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Unique constraint")) {
        return bad(`NAME_DUPLICATE：同名服务器已存在（${String(data.name)}）`);
      }
      throw e;
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "更新失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await db.mcpServer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "服务器不存在" }, { status: 404 });
    }
    await db.mcpServer.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "删除失败" },
      { status: 500 },
    );
  }
}
