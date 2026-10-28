import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentationPhoto } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { UploadService } from "../upload/upload.service.js";
import { AuditService } from "../audit/audit.service.js";
import { renderPdf } from "../common/pdf.js";
import { can, type ModuleKey } from "../rbac/permissions.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { DocKind } from "./documentation.controller.js";

const MODULE_FOR: Record<DocKind, ModuleKey> = {
  survey: "surveys",
  project: "projects",
  "delivery-note": "delivery",
  poc: "pocReports",
};

const TITLE_FOR: Record<DocKind, string> = {
  survey: "Laporan Dokumentasi Survey",
  project: "Laporan Dokumentasi Instalasi",
  "delivery-note": "Laporan Dokumentasi Surat Jalan",
  poc: "Laporan Proof of Concept (POC) / Demo",
};

type PhotoWithFile = DocumentationPhoto & {
  file: { id: number; originalName: string; mimeType: string; path: string; size: number };
};

@Injectable()
export class DocumentationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly upload: UploadService,
    private readonly audit: AuditService,
  ) {}

  private assert(kind: DocKind, user: RequestUser, action: "L" | "C" | "U") {
    const mod = MODULE_FOR[kind];
    if (!can(user.role, mod, action)) {
      throw new ForbiddenException(
        `Akses ditolak: peran ${user.role} tidak memiliki hak ${action} pada modul ${mod}`,
      );
    }
  }

  /** Lampirkan foto: izinkan C atau U pada modul terkait (mis. TEKNISI projects=LU). */
  private assertAttach(kind: DocKind, user: RequestUser) {
    const mod = MODULE_FOR[kind];
    if (!can(user.role, mod, "C") && !can(user.role, mod, "U")) {
      throw new ForbiddenException(
        `Akses ditolak: peran ${user.role} tidak memiliki hak C/U pada modul ${mod}`,
      );
    }
  }

  private async entityExists(kind: DocKind, entityId: number): Promise<{ label: string }> {
    if (kind === "survey") {
      const s = await this.prisma.main.survey.findUnique({
        where: { id: entityId },
        include: { lead: { select: { name: true } } },
      });
      if (!s) throw new NotFoundException("Survey tidak ditemukan");
      return { label: `Survey #${s.id} — ${s.lead.name}` };
    }
    if (kind === "project") {
      const p = await this.prisma.main.project.findUnique({ where: { id: entityId } });
      if (!p) throw new NotFoundException("Project tidak ditemukan");
      return { label: `Project #${p.id} — ${p.name}` };
    }
    if (kind === "poc") {
      const poc = await (this.prisma.main as any).pocReport.findUnique({ where: { id: entityId } });
      if (!poc) throw new NotFoundException("Laporan POC tidak ditemukan");
      return { label: `POC ${poc.number} — ${poc.title}` };
    }
    const d = await this.prisma.main.deliveryNote.findUnique({ where: { id: entityId } });
    if (!d) throw new NotFoundException("Surat jalan tidak ditemukan");
    return { label: `Surat Jalan ${d.number}` };
  }

  private async photosOf(kind: DocKind, entityId: number): Promise<PhotoWithFile[]> {
    return this.prisma.main.documentationPhoto.findMany({
      where: { entityType: kind, entityId },
      include: { file: { select: { id: true, originalName: true, mimeType: true, path: true, size: true } } },
      orderBy: { id: "asc" },
    });
  }

  async list(kind: DocKind, entityId: number, user: RequestUser) {
    this.assert(kind, user, "L");
    const entity = await this.entityExists(kind, entityId);
    const photos = await this.photosOf(kind, entityId);
    return {
      kind,
      entityId,
      entity: entity.label,
      total: photos.length,
      items: photos.map((p) => ({
        id: p.id,
        fileId: p.fileId,
        caption: p.caption,
        url: `/api/files/${p.fileId}`,
        originalName: p.file.originalName,
        mimeType: p.file.mimeType,
        size: p.file.size,
        createdAt: p.createdAt,
      })),
    };
  }

  async attach(kind: DocKind, entityId: number, fileId: number, caption: string | undefined, user: RequestUser) {
    this.assertAttach(kind, user);
    await this.entityExists(kind, entityId);
    const file = await this.prisma.main.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException("File tidak ditemukan");
    if (file.kind !== "FOTO") {
      throw new BadRequestException("Hanya file ber-kind FOTO yang bisa dijadikan foto dokumentasi");
    }

    const row = await this.prisma.main.documentationPhoto.upsert({
      where: {
        entityType_entityId_fileId: { entityType: kind, entityId, fileId },
      },
      create: { entityType: kind, entityId, fileId, caption: caption ?? null },
      update: { caption: caption ?? null },
      include: { file: { select: { id: true, originalName: true, mimeType: true, size: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "LAMPIRKAN_FOTO_DOKUMENTASI",
      entityType: "documentationPhoto",
      entityId: row.id,
      detail: `${kind} #${entityId} — fileId=${fileId}${caption ? ` (${caption})` : ""}`,
    });
    return {
      id: row.id,
      kind,
      entityId,
      fileId: row.fileId,
      caption: row.caption,
      url: `/api/files/${row.fileId}`,
      originalName: row.file.originalName,
      mimeType: row.file.mimeType,
      size: row.file.size,
      createdAt: row.createdAt,
    };
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.documentationPhoto.findUnique({
      where: { id },
      include: { file: { select: { uploadedById: true } } },
    });
    if (!row) throw new NotFoundException("Foto dokumentasi tidak ditemukan");
    const kind = row.entityType as DocKind;
    const isUploader = row.file.uploadedById === user.id;
    if (!isUploader && !["SUPER_ADMIN", "ADMIN", "BOS"].includes(user.role)) {
      this.assert(kind, user, "U");
    }
    await this.prisma.main.documentationPhoto.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "HAPUS_FOTO_DOKUMENTASI",
      entityType: "documentationPhoto",
      entityId: id,
      detail: `${kind} #${row.entityId} — foto fileId=${row.fileId}`,
    });
    return { deleted: true, id };
  }

  async renderPdf(kind: DocKind, entityId: number, user: RequestUser): Promise<{ buffer: Buffer; filename: string }> {
    this.assert(kind, user, "L");
    const photos = await this.photosOf(kind, entityId);
    const images: Record<string, string> = {};
    const content: Record<string, unknown>[] = [];
    let customHeader: string | null = null;

    if (kind === "survey") {
      const s = await this.prisma.main.survey.findUnique({
        where: { id: entityId },
        include: {
          lead: { include: { customer: { select: { name: true, city: true } } } },
          requester: { select: { name: true } },
          members: { include: { user: { select: { name: true, role: true } } } },
        },
      });
      if (!s) throw new NotFoundException("Survey tidak ditemukan");
      content.push(
        this.infoTable([
          ["Nomor", `#${s.id}`],
          ["Lead", s.lead.name],
          ["Customer", s.lead.customer?.name ?? "-"],
          ["Lokasi", s.location],
          ["Kebutuhan", s.need ?? "-"],
          ["Jadwal", s.scheduleAt ? new Date(s.scheduleAt).toLocaleDateString("id-ID") : "-"],
          ["Status", s.status],
          ["Biaya", `Rp${Number(s.cost).toLocaleString("id-ID")}`],
          ["Pemohon", s.requester.name],
          ["Tim", s.members.map((m) => `${m.user.name} (${m.user.role})`).join(", ") || "-"],
        ]),
      );
    } else if (kind === "project") {
      const p = await this.prisma.main.project.findUnique({
        where: { id: entityId },
        include: {
          customer: { select: { name: true } },
          pic: { select: { name: true } },
          tasks: { select: { name: true, status: true } },
        },
      });
      if (!p) throw new NotFoundException("Project tidak ditemukan");
      content.push(
        this.infoTable([
          ["Nomor", `#${p.id}`],
          ["Nama", p.name],
          ["Customer", p.customer?.name ?? "-"],
          ["PIC", p.pic.name],
          ["Mulai", new Date(p.startDate).toLocaleDateString("id-ID")],
          ["Selesai", p.endDate ? new Date(p.endDate).toLocaleDateString("id-ID") : "-"],
          ["Status", p.status],
          ["Progres", `${p.progress}%`],
          ["Pembayaran", p.paymentStatus],
          ["Task", p.tasks.map((t) => `${t.name} (${t.status})`).join("; ") || "-"],
        ]),
      );
    } else if (kind === "poc") {
      const poc = (await (this.prisma.main as any).pocReport.findUnique({
        where: { id: entityId },
        include: {
          customer: { select: { name: true } },
          project: { select: { name: true } },
          lead: { select: { name: true } },
          owner: { select: { name: true } },
          members: { include: { user: { select: { name: true, role: true } } } },
          checklists: { orderBy: { id: "asc" } },
          expenses: { include: { reporter: { select: { name: true } } }, orderBy: { date: "asc" } },
        },
      })) as {
        id: number;
        number: string;
        title: string;
        description?: string | null;
        type: string;
        date: Date;
        endDate?: Date | null;
        location?: string | null;
        status: string;
        resultStatus?: string | null;
        clientName?: string | null;
        targetCriteria?: string | null;
        productsTested?: string | null;
        budget: number | string | Record<string, unknown>;
        actualCost: number | string | Record<string, unknown>;
        companyHeader?: string | null;
        logoFileId?: number | null;
        actualExecutionDate?: Date | null;
        actualAttendees?: string | null;
        activitiesDone?: string | null;
        testResults?: string | null;
        issuesFound?: string | null;
        followUpNeeded?: string | null;
        conclusion?: string | null;
        recommendations?: string | null;
        customer?: { name: string } | null;
        project?: { name: string } | null;
        lead?: { name: string } | null;
        owner: { name: string };
        members: Array<{ user: { name: string; role: string } }>;
        checklists: Array<{ id: number; title: string; isDone: boolean; notes?: string | null }>;
        expenses: Array<{ id: number; amount: number | string | Record<string, unknown>; status: string; fundingSource?: string; reporter?: { name: string } }>;
      } | null;
      if (!poc) throw new NotFoundException("Laporan POC tidak ditemukan");
      customHeader = poc.companyHeader ?? null;

      if (poc.logoFileId) {
        try {
          const logo = await this.upload.read(poc.logoFileId);
          images["headerLogo"] = `data:image/png;base64,${logo.buffer.toString("base64")}`;
        } catch {}
      }

      const clientOrExpo =
        poc.clientName ||
        poc.customer?.name ||
        (poc.lead ? `Lead: ${poc.lead.name}` : "-");

      content.push(
        this.infoTable([
          ["Nomor POC", poc.number],
          ["Judul Kegiatan", poc.title],
          [
            "Tipe POC",
            poc.type === "DEMO_CLIENT"
              ? "Demo ke Klien"
              : poc.type === "EXPO_EXHIBITION"
                ? "Pameran / Expo"
                : "Pengujian Internal",
          ],
          [
            "Tanggal",
            new Date(poc.date).toLocaleDateString("id-ID") +
              (poc.endDate ? ` s/d ${new Date(poc.endDate).toLocaleDateString("id-ID")}` : ""),
          ],
          ["Lokasi", poc.location ?? "-"],
          ["Klien / Partner", clientOrExpo],
          ["Proyek Terkait", poc.project ? poc.project.name : "-"],
          ["Status Alur", poc.status],
          ["Hasil Pengujian", poc.resultStatus ?? "Belum Dievaluasi"],
          ["PIC / Owner", poc.owner.name],
          ["Tim yang Bertugas", poc.members.map((m: { user: { name: string } }) => m.user.name).join(", ") || "-"],
        ]),
      );

      if (poc.targetCriteria || poc.productsTested || poc.description) {
        content.push({ text: "Tujuan & Spesifikasi Uji", fontSize: 11, bold: true, margin: [0, 10, 0, 4] });
        content.push(
          this.infoTable([
            ["Target & Kriteria", poc.targetCriteria ?? "-"],
            ["Perangkat Diuji", poc.productsTested ?? "-"],
            ["Deskripsi", poc.description ?? "-"],
          ]),
        );
      }

      if (
        poc.activitiesDone ||
        poc.testResults ||
        poc.issuesFound ||
        poc.followUpNeeded ||
        poc.conclusion ||
        poc.recommendations
      ) {
        content.push({ text: "Hasil Eksekusi & Evaluasi", fontSize: 11, bold: true, margin: [0, 10, 0, 4] });
        content.push(
          this.infoTable([
            ["Aktivitas Selesai", poc.activitiesDone ?? "-"],
            ["Hasil Pengujian", poc.testResults ?? "-"],
            ["Kendala / Temuan", poc.issuesFound ?? "-"],
            ["Tindak Lanjut", poc.followUpNeeded ?? "-"],
            ["Kesimpulan", poc.conclusion ?? "-"],
            ["Rekomendasi", poc.recommendations ?? "-"],
          ]),
        );
      }

      if (poc.checklists.length) {
        const doneCount = poc.checklists.filter((c: { isDone: boolean }) => c.isDone).length;
        content.push({
          text: `Checklist Persiapan (${doneCount}/${poc.checklists.length} Selesai)`,
          fontSize: 11,
          bold: true,
          margin: [0, 10, 0, 4],
        });
        content.push({
          table: {
            widths: [20, "*", 60],
            body: [
              [{ text: "No", bold: true }, { text: "Item Persiapan", bold: true }, { text: "Status", bold: true }],
              ...poc.checklists.map((c: { title: string; notes?: string | null; isDone: boolean }, idx: number) => [
                String(idx + 1),
                c.title + (c.notes ? ` (${c.notes})` : ""),
                c.isDone ? "SELESAI" : "BELUM",
              ]),
            ],
          },
          layout: "lightHorizontalLines",
          fontSize: 8,
        });
      }

      const validExp = poc.expenses.filter((e: { status: string }) => e.status !== "REJECTED");
      const totalCompany = validExp
        .filter((e: { fundingSource?: string }) => e.fundingSource === "PERUSAHAAN")
        .reduce((s: number, e: { amount: unknown }) => s + Number(e.amount), 0);
      const totalPersonal = validExp
        .filter((e: { fundingSource?: string }) => e.fundingSource === "TALANGAN_PRIBADI")
        .reduce((s: number, e: { amount: unknown }) => s + Number(e.amount), 0);

      content.push({ text: "Ringkasan Biaya Operasional POC", fontSize: 11, bold: true, margin: [0, 10, 0, 4] });
      content.push(
        this.infoTable([
          ["Total Anggaran", `Rp${Number(poc.budget).toLocaleString("id-ID")}`],
          ["Total Biaya Aktual", `Rp${Number(poc.actualCost).toLocaleString("id-ID")}`],
          ["Dana Perusahaan", `Rp${totalCompany.toLocaleString("id-ID")}`],
          ["Talangan Pribadi Karyawan", `Rp${totalPersonal.toLocaleString("id-ID")}`],
        ]),
      );
    } else {
      const d = await this.prisma.main.deliveryNote.findUnique({
        where: { id: entityId },
        include: {
          creator: { select: { name: true } },
          locations: { include: { project: { select: { name: true } } } },
          movements: { include: { serialUnit: { select: { sn: true } }, product: { select: { name: true } } } },
        },
      });
      if (!d) throw new NotFoundException("Surat jalan tidak ditemukan");
      content.push(
        this.infoTable([
          ["Nomor", d.number],
          ["Tanggal", new Date(d.date).toLocaleDateString("id-ID")],
          ["Status", d.status],
          ["Pembuat", d.creator.name],
          ["Bawa Barang", d.withGoods ? "Ya" : "Tidak"],
          [
            "Tujuan",
            d.locations.map((l) => `${l.destination}${l.project ? ` (${l.project.name})` : ""}`).join("; ") || "-",
          ],
          [
            "Barang (SN)",
            d.movements
              .filter((m) => m.serialUnit)
              .map((m) => `${m.serialUnit!.sn} — ${m.product.name}`)
              .join("; ") || "-",
          ],
          ["Laporan Hasil", d.reportText ?? "-"],
        ]),
      );
    }

    content.push({ text: `Foto (${photos.length})`, fontSize: 12, bold: true, margin: [0, 14, 0, 6] });
    if (!photos.length) {
      content.push({ text: "Belum ada foto terlampir.", fontSize: 9, color: "#666666" });
    }
    let i = 0;
    for (const p of photos) {
      const key = `img${i++}`;
      if (p.file.mimeType === "image/png" || p.file.mimeType === "image/jpeg") {
        try {
          const { buffer } = await this.upload.read(p.fileId);
          images[key] = `data:${p.file.mimeType};base64,${buffer.toString("base64")}`;
          content.push({ text: p.caption || p.file.originalName, fontSize: 9, bold: true, margin: [0, 8, 0, 2] });
          content.push({ image: key, width: 400, margin: [0, 0, 0, 4] });
        } catch {
          content.push({ text: `[Foto tidak dapat dimuat: ${p.file.originalName}]`, fontSize: 9, color: "#999999" });
        }
      } else {
        content.push({
          text: `[${p.file.originalName} — format ${p.file.mimeType} tidak mendukung embedding, lihat lampiran asli]`,
          fontSize: 9,
          color: "#999999",
        });
      }
    }

    const entityLabel = await this.entityExists(kind, entityId);
    const build = (imgs: Record<string, string>, items: Record<string, unknown>[]) => ({
      pageSize: "A4" as const,
      pageMargins: [40, 40, 40, 40] as [number, number, number, number],
      images: imgs,
      content: [
        { text: TITLE_FOR[kind], fontSize: 14, bold: true, alignment: "center" },
        ...(imgs["headerLogo"]
          ? [{ image: "headerLogo", width: 90, alignment: "center", margin: [0, 0, 0, 6] }]
          : []),
        { text: customHeader || TITLE_FOR[kind], fontSize: 14, bold: true, alignment: "center" },
        { text: entityLabel.label, fontSize: 10, alignment: "center", margin: [0, 2, 0, 10] },
        ...items,
        {
          text: `Dicetak ${new Date().toLocaleString("id-ID")} oleh ${user.name}`,
          fontSize: 8,
          color: "#666666",
          margin: [0, 14, 0, 0],
        },
      ],
    });

    const contentNoImg = content.filter(
      (c) => !(typeof c === "object" && c !== null && "image" in c),
    );
    let buffer: Buffer;
    try {
      buffer = await renderPdf(build(images, content));
    } catch {
      // Gambar rusak/tidak didukung pdfmake — render tanpa embedding gambar.
      const fallback = contentNoImg.map((c) =>
        typeof c === "object" && c !== null && "text" in c && String((c as { text: unknown }).text).startsWith("[Foto")
          ? c
          : c,
      );
      buffer = await renderPdf(build({}, fallback));
    }

    const safe = entityLabel.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { buffer, filename: `dokumentasi-${kind}-${safe}.pdf` };
  }

  private infoTable(rows: Array<[string, string]>): Record<string, unknown> {
    return {
      table: {
        widths: [120, "auto"],
        body: rows.map(([k, v]) => [{ text: k, bold: true }, { text: v }]),
      },
      layout: "lightHorizontalLines",
      fontSize: 9,
    };
  }
}
