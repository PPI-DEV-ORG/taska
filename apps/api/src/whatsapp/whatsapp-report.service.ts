import { Injectable } from "@nestjs/common";
import { renderPdf } from "../common/pdf.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { MatchedEntity } from "./whatsapp-conversation.service.js";

@Injectable()
export class WhatsappReportService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCompanyName(): Promise<string> {
    try {
      const s = await this.prisma.main.systemSetting.findUnique({
        where: { key: "nama.perusahaan" },
      });
      if (s?.value?.trim()) return s.value.trim();
    } catch {}
    return "TASKA MINI ERP — LAPORAN OPERASIONAL LAPANGAN";
  }

  async generatePdfReport(params: {
    entity: MatchedEntity;
    user: RequestUser;
    activities?: string[];
    resultNotes?: string;
    photos: Array<{ buffer: Buffer; caption?: string; mimeType?: string }>;
  }): Promise<{ buffer: Buffer; fileName: string }> {
    const companyName = await this.getCompanyName();
    const now = new Date();
    const dateFormatted = now.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const titlePrefix =
      params.entity.type === "survey"
        ? "LAPORAN HASIL SURVEY LAPANGAN"
        : params.entity.type === "project"
          ? "LAPORAN DOKUMENTASI INSTALASI PROJECT"
          : "LAPORAN PENUGASAN & SERAH TERIMA SURAT JALAN";

    const infoRows: Array<[string, string]> = [
      ["Waktu Laporan", dateFormatted],
      ["Petugas / Teknisi", `${params.user.name} (${params.user.role})`],
      [
        "Kategori Laporan",
        params.entity.type === "survey"
          ? "SURVEY LAPANGAN"
          : params.entity.type === "project"
            ? "INSTALASI / PROJECT"
            : "SURAT JALAN / PENGIRIMAN",
      ],
      ["Pekerjaan / Dokumen", params.entity.title],
    ];

    if (params.entity.customerName) {
      infoRows.push(["Customer / Instansi", params.entity.customerName]);
    }
    if (params.entity.location) {
      infoRows.push(["Lokasi Lapangan", params.entity.location]);
    }
    if (params.entity.need) {
      infoRows.push(["Kebutuhan / Lingkup", params.entity.need]);
    }

    const content: any[] = [
      // KOP SURAT
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                stack: [
                  {
                    text: companyName.toUpperCase(),
                    fontSize: 13,
                    bold: true,
                    alignment: "center",
                    color: "#111827",
                  },
                  {
                    text: "DOKUMEN LAPORAN RESMI TEKNISI LAPANGAN",
                    fontSize: 8,
                    alignment: "center",
                    color: "#6b7280",
                    margin: [0, 2, 0, 0],
                  },
                ],
                margin: [0, 8, 0, 8],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => "#9ca3af",
          vLineColor: () => "#9ca3af",
        },
        margin: [0, 0, 0, 12],
      },
      // JUDUL DOKUMEN
      {
        text: titlePrefix,
        fontSize: 14,
        bold: true,
        alignment: "center",
        margin: [0, 0, 0, 3],
      },
      {
        text: params.entity.title,
        fontSize: 10,
        alignment: "center",
        color: "#4b5563",
        margin: [0, 0, 0, 14],
      },
      // TABEL INFORMASI PELAKSANAAN
      {
        table: {
          widths: [130, "*"],
          body: infoRows.map(([label, val]) => [
            { text: label, bold: true, fontSize: 9, color: "#1f2937" },
            { text: val || "-", fontSize: 9, color: "#111827" },
          ]),
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 14],
      },
    ];

    // HASIL LAPANGAN & DESKRIPSI UTAMA
    content.push(
      {
        text:
          params.entity.type === "survey"
            ? "Hasil Survey & Catatan Lapangan:"
            : params.entity.type === "project"
              ? "Hasil Instalasi & Catatan Pekerjaan:"
              : "Keterangan Pengiriman & Serah Terima:",
        fontSize: 11,
        bold: true,
        margin: [0, 0, 0, 4],
      },
      {
        text: params.resultNotes?.trim() || "Pekerjaan telah dilaksanakan dan didokumentasikan dengan baik.",
        fontSize: 9.5,
        lineHeight: 1.3,
        margin: [0, 0, 0, 12],
      },
    );

    // RINCIAN KEGIATAN / CAPTION FOTO JIKA ADA
    const cleanActivities = (params.activities ?? [])
      .map((a) => a.trim())
      .filter((a) => a && a !== params.resultNotes?.trim());

    if (cleanActivities.length > 0) {
      content.push(
        {
          text: "Rincian Catatan / Kegiatan:",
          fontSize: 10.5,
          bold: true,
          margin: [0, 0, 0, 4],
        },
        {
          ol: cleanActivities.map((act) => ({ text: act, fontSize: 9 })),
          margin: [0, 0, 0, 12],
        },
      );
    }

    // GALERI FOTO DOKUMENTASI (GRID 2 KOLOM)
    if (params.photos && params.photos.length > 0) {
      content.push({
        text: `Foto Dokumentasi Lapangan (${params.photos.length} Foto):`,
        fontSize: 11,
        bold: true,
        margin: [0, 2, 0, 8],
      });

      const photoRows: any[] = [];
      for (let i = 0; i < params.photos.length; i += 2) {
        const left = params.photos[i]!;
        const right = params.photos[i + 1];

        const leftMime = left.mimeType === "image/png" ? "image/png" : "image/jpeg";
        const leftCell = [
          {
            image: `data:${leftMime};base64,${left.buffer.toString("base64")}`,
            width: 235,
            alignment: "center",
          },
          {
            text: left.caption ? `Foto #${i + 1}: ${left.caption}` : `Foto #${i + 1}`,
            fontSize: 8,
            alignment: "center",
            margin: [0, 4, 0, 10],
            color: "#374151",
          },
        ];

        const rightMime = right?.mimeType === "image/png" ? "image/png" : "image/jpeg";
        const rightCell = right
          ? [
              {
                image: `data:${rightMime};base64,${right.buffer.toString("base64")}`,
                width: 235,
                alignment: "center",
              },
              {
                text: right.caption ? `Foto #${i + 2}: ${right.caption}` : `Foto #${i + 2}`,
                fontSize: 8,
                alignment: "center",
                margin: [0, 4, 0, 10],
                color: "#374151",
              },
            ]
          : [{ text: "" }];

        photoRows.push([leftCell, rightCell]);
      }

      content.push({
        table: {
          widths: ["50%", "50%"],
          body: photoRows,
        },
        layout: "noBorders",
        margin: [0, 0, 0, 14],
      });
    }

    // TTD / PENGESAHAN
    content.push({
      columns: [
        {
          width: "*",
          stack: [
            { text: "Dilaporkan Oleh,\n\n\n\n", fontSize: 9 },
            { text: params.user.name, bold: true, fontSize: 9, decoration: "underline" },
            { text: params.user.role, fontSize: 8, color: "#6b7280" },
          ],
        },
        {
          width: "*",
          stack: [
            { text: "Mengetahui / Penanggung Jawab,\n\n\n\n", fontSize: 9, alignment: "right" },
            {
              text: "( ........................................ )",
              bold: true,
              fontSize: 9,
              alignment: "right",
            },
          ],
        },
      ],
      margin: [0, 16, 0, 0],
    });

    const docDefinition = {
      pageSize: "A4" as const,
      pageMargins: [35, 30, 35, 30] as [number, number, number, number],
      content,
    };

    let buffer: Buffer;
    try {
      buffer = await renderPdf(docDefinition);
    } catch {
      // Fallback aman bila ada format gambar yang tidak didukung pdfmake
      const contentWithoutImages = content.filter(
        (block) => !(block && typeof block === "object" && "table" in block && block.layout === "noBorders"),
      );
      buffer = await renderPdf({
        pageSize: "A4" as const,
        pageMargins: [35, 30, 35, 30] as [number, number, number, number],
        content: contentWithoutImages,
      });
    }

    const safeEntity = params.entity.title
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 36);
    const fileName = `Laporan-${params.entity.type}-${safeEntity || "Taska"}-${Date.now()}.pdf`;

    return { buffer, fileName };
  }
}
