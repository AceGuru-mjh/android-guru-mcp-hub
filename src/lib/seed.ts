/**
 * 幂等种子：数据库为空时自动灌入目录数据（30 MCP + 插件生态）。
 * API 层调用 ensureSeeded() 保证首屏即有内容。
 */

import { db } from "./db";
import { SEED_MCP_SERVERS, SEED_PLUGINS } from "./seed-data";

let seeding: Promise<void> | null = null;

async function doSeed() {
  const serverCount = await db.mcpServer.count();
  if (serverCount === 0) {
    await db.mcpServer.createMany({
      data: SEED_MCP_SERVERS.map((s) => ({
        name: s.name,
        description: s.description ?? "",
        transport: s.transport,
        url: s.url ?? null,
        command: s.command ?? null,
        args: JSON.stringify(s.args ?? []),
        env: JSON.stringify(s.env ?? {}),
        headers: JSON.stringify(s.headers ?? {}),
        enabled: false, // 安装 ≠ 启动
        runInSandbox: s.runInSandbox ?? false,
        scope: s.scope ?? "all",
        category: s.category ?? "programming",
        tags: JSON.stringify(s.tags ?? []),
        vendor: s.vendor ?? null,
        homepage: s.homepage ?? null,
        source: "catalog",
        installed: false,
      })),
    });
  }

  const pluginCount = await db.plugin.count();
  if (pluginCount === 0) {
    await db.plugin.createMany({
      data: SEED_PLUGINS.map((p) => ({
        name: p.name,
        description: p.description,
        version: p.version,
        author: p.author,
        format: p.format,
        pluginType: p.pluginType,
        config: JSON.stringify(p.config),
        skillBody: p.skillBody ?? null,
        enabled: p.enabled,
        installed: p.installed,
        sourceUrl: p.sourceUrl ?? null,
        repo: p.repo ?? null,
        tags: JSON.stringify(p.tags),
      })),
    });
  }
}

export async function ensureSeeded(): Promise<void> {
  if (!seeding) {
    seeding = doSeed().catch((e) => {
      seeding = null; // 失败允许下次重试
      throw e;
    });
  }
  return seeding;
}
