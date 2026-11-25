import { describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { LlmProviderService } from "./llm-provider.service.js";
import { AgentToolsService } from "./agent-tools.service.js";
import { AiAgentService } from "./ai-agent.service.js";

function makeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

const superAdminUser: RequestUser = {
  id: 1,
  name: "Super Admin",
  email: "admin@test.local",
  role: "SUPER_ADMIN",
};

const salesUser: RequestUser = {
  id: 2,
  name: "Budi Sales",
  email: "sales@test.local",
  role: "SALES",
};

const pmUser: RequestUser = {
  id: 3,
  name: "Rina PM",
  email: "pm@test.local",
  role: "PM",
};

const gudangUser: RequestUser = {
  id: 4,
  name: "Dedi Gudang",
  email: "gudang@test.local",
  role: "GUDANG",
};

describe("LlmProviderService", () => {
  it("melaporkan belum terkonfigurasi jika Gemini tanpa API key, dan siap jika ada API key", () => {
    const unconfigured = new LlmProviderService(makeConfig({}));
    expect(unconfigured.getStatus()).toEqual({
      configured: false,
      model: "gemini-3.8-flash",
      providerLabel: "Google Gemini API",
    });

    const configured = new LlmProviderService(
      makeConfig({ LLM_API_KEY: "test-key", LLM_MODEL: "gemini-3.8-flash" }),
    );
    expect(configured.getStatus().configured).toBe(true);
    expect(configured.getStatus().providerLabel).toBe("Google Gemini API");
  });

  it("melaporkan siap untuk Local LLM Ollama tanpa API key", () => {
    const local = new LlmProviderService(
      makeConfig({
        LLM_BASE_URL: "http://192.168.1.50:11434/v1",
        LLM_MODEL: "qwen2.5:7b",
      }),
    );
    expect(local.getStatus()).toEqual({
      configured: true,
      model: "qwen2.5:7b",
      providerLabel: "Local LLM (On-Premise)",
    });
  });
});

describe("AgentToolsService RBAC & Redaction", () => {
  const reportsMock = {
    build: vi.fn(),
  };
  const dashboardMock = {
    summary: vi.fn(),
  };
  const prismaMock = {
    main: {
      ctrContract: { findMany: vi.fn() },
    },
  };

  function createService() {
    reportsMock.build.mockReset();
    dashboardMock.summary.mockReset();
    return new AgentToolsService(
      reportsMock as never,
      dashboardMock as never,
      prismaMock as never,
    );
  }

  it("menyembunyikan tool laporan keuangan untuk role SALES dan menolak eksekusi langsung", async () => {
    const svc = createService();
    const salesTools = svc.getAllowedTools(salesUser).map((t) => t.function.name);
    expect(salesTools).toContain("get_leads_overview");
    expect(salesTools).not.toContain("get_financial_report");

    const res = await svc.executeTool(
      "get_financial_report",
      { reportType: "profit-loss" },
      salesUser,
    );
    expect(res.allowed).toBe(false);
    expect(reportsMock.build).not.toHaveBeenCalled();
  });

  it("meredaksi kolom Nilai proyek untuk role PM tanpa hak lihat harga proyek", async () => {
    const svc = createService();
    reportsMock.build.mockResolvedValue({
      title: "Laporan Project",
      columns: ["Nama", "Customer", "PIC", "Status", "Progres", "Nilai"],
      rows: [["CCTV Kantor", "PT ABC", "Rina PM", "BERJALAN", "60%", 150000000]],
    });

    const res = await svc.executeTool("get_projects_overview", {}, pmUser);
    expect(res.allowed).toBe(true);
    const data = res.data as { items: Record<string, unknown>[] };
    expect(data.items[0]).not.toHaveProperty("Nilai");
    expect(data.items[0]?.Nama).toBe("CCTV Kantor");
  });

  it("memfilter stok di bawah minimum saat lowStockOnly=true untuk role GUDANG", async () => {
    const svc = createService();
    reportsMock.build.mockResolvedValue({
      title: "Laporan Stok",
      columns: ["SKU", "Produk", "Gudang", "Saldo", "Min. Stok", "Stok Menipis"],
      rows: [
        ["SKU-1", "Kabel UTP", "Gudang Utama", 2, 10, "Ya"],
        ["SKU-2", "Switch 8P", "Gudang Utama", 25, 5, "Tidak"],
      ],
    });

    const res = await svc.executeTool(
      "get_stock_overview",
      { lowStockOnly: true },
      gudangUser,
    );
    expect(res.allowed).toBe(true);
    const data = res.data as { totalRows: number; items: Record<string, unknown>[] };
    expect(data.totalRows).toBe(1);
    expect(data.items[0]?.SKU).toBe("SKU-1");
  });

  it("menormalkan sinonim enum dari LLM (PENDING -> MENUNGGU, QUALIFIED -> QUALIFICATION)", async () => {
    const svc = createService();
    reportsMock.build.mockResolvedValue({ title: "OK", columns: ["A"], rows: [] });

    await svc.executeTool("get_pending_approvals", { status: "PENDING" }, superAdminUser);
    expect(reportsMock.build).toHaveBeenLastCalledWith(
      "approvals",
      expect.objectContaining({ status: "MENUNGGU" }),
    );

    await svc.executeTool("get_leads_overview", { stage: "QUALIFIED" }, salesUser);
    expect(reportsMock.build).toHaveBeenLastCalledWith(
      "leads",
      expect.objectContaining({ stage: "QUALIFICATION" }),
    );
  });

  it("menggunakan income-statement (Buku Besar) untuk Laba Rugi perusahaan dan tidak memotong baris total Neraca/Arus Kas", async () => {
    const svc = createService();
    reportsMock.build.mockResolvedValue({
      title: "Laporan Laba Rugi Standar Akuntansi",
      columns: ["Kode Akun", "Komponen", "Kelompok", "Nominal (Rp)"],
      note: "Laba Bersih: Rp 10.000.000",
      rows: [["=", "LABA BERSIH", "Total Akhir", "Rp 10.000.000"]],
    });

    const res = await svc.executeTool(
      "get_financial_report",
      { reportType: "profit-loss", period: "this_month" },
      superAdminUser,
    );
    expect(res.allowed).toBe(true);
    expect(res.label).toBe("Laporan Laba Rugi (Akuntansi)");
    expect(reportsMock.build).toHaveBeenCalledWith("income-statement", expect.any(Object));
  });
});

describe("AiAgentService", () => {
  it("menjalankan tool-calling loop, menyimpan pesan ke DB, dan mencatat audit log", async () => {
    const createdMsgs: Array<{ id: number; role: string; content: string; toolsUsedJson: string | null; createdAt: Date }> = [];
    const prismaMock = {
      main: {
        aiChatSession: {
          create: vi.fn().mockResolvedValue({ id: 10, title: "Cek stok menipis" }),
          update: vi.fn().mockResolvedValue({ id: 10 }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        aiChatMessage: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockImplementation(async ({ data }) => {
            const row = {
              id: createdMsgs.length + 1,
              role: data.role,
              content: data.content,
              toolsUsedJson: data.toolsUsedJson ?? null,
              createdAt: new Date("2026-11-25T02:00:00.000Z"),
            };
            createdMsgs.push(row);
            return row;
          }),
        },
      },
    };

    const llmMock = {
      getStatus: vi.fn().mockReturnValue({
        configured: true,
        model: "gemini-2.5-flash",
        providerLabel: "Google Gemini API",
      }),
      complete: vi
        .fn()
        .mockResolvedValueOnce({
          content: null,
          finishReason: "tool_calls",
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "get_stock_overview",
                arguments: JSON.stringify({ lowStockOnly: true }),
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Ada 1 barang di bawah stok minimum: Kabel UTP (saldo 2, minimum 10).",
          finishReason: "stop",
          toolCalls: [],
        }),
    };

    const toolsMock = {
      getAllowedTools: vi.fn().mockReturnValue([
        {
          type: "function",
          function: {
            name: "get_stock_overview",
            description: "Stok",
            parameters: { type: "object", properties: {} },
          },
        },
      ]),
      getSuggestedPrompts: vi.fn().mockReturnValue([]),
      executeTool: vi.fn().mockResolvedValue({
        label: "Stok Di Bawah Minimum",
        allowed: true,
        data: { totalRows: 1, items: [{ SKU: "SKU-1", Produk: "Kabel UTP", Saldo: 2 }] },
      }),
    };

    const auditMock = { log: vi.fn().mockResolvedValue(undefined) };

    const svc = new AiAgentService(
      prismaMock as never,
      llmMock as never,
      toolsMock as never,
      auditMock as never,
    );

    const res = await svc.chat(superAdminUser, { message: "Cek stok menipis" });
    expect(res.sessionId).toBe(10);
    expect(res.toolsUsed).toEqual(["Stok Di Bawah Minimum"]);
    expect(res.assistantMessage.content).toContain("Kabel UTP");
    expect(auditMock.log).toHaveBeenCalledTimes(1);

    await expect(svc.getSession(salesUser, 10)).rejects.toThrow(NotFoundException);
  });
});
