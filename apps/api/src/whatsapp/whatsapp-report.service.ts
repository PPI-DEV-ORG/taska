import { Injectable } from "@nestjs/common";
import { renderPdf } from "../common/pdf.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { MatchedEntity } from "./whatsapp-conversation.service.js";

@Injectable()
export class WhatsappReportService {
  async generatePdfReport(params: {
    entity: MatchedEntity;
    user: RequestUser;
    activities: string[];
    resultNotes?: string;
    photos: Array<{ buffer: Buffer; caption?: string }>;
  }): Promise<{ buffer: Buffer; fileName: string }> {
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
          : "LAPORAN PENUGASAN SURAT JALAN";

    const content: any[] = [
      // KOP SURAT
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "KOP SURAT / DOKUMEN LAPORAN RESMI",
                fontSize: 14,
                bold: true,
                alignment: "center",
                margin: [0, 10, 0, 10],
                color: "#111827",
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
        fontSize: 15,
        bold: true,
        alignment: "center",
        margin: [0, 0, 0, 4],
      },
      {
        text: `Target: ${params.entity.title}`,
        fontSize: 10,
        alignment: "center",
        color: "#4b5563",
        margin: [0, 0, 0, 14],
      },
      // TABEL INFORMASI PELAKSANAAN
      {
        table: {
          widths: [130, "*"],
          body: [
            [
              { text: "Waktu Laporan", bold: true, fontSize: 9 },
              { text: dateFormatted, fontSize: 9 },
            ],
            [
              { text: "Teknisi Pelaksana", bold: true, fontSize: 9 },
              { text: `${params.user.name} (${params.user.role})`, fontSize: 9 },
            ],
            [
              { text: "Kategori Penugasan", bold: true, fontSize: 9 },
              { text: params.entity.type.toUpperCase(), fontSize: 9 },
            ],
            [
              { text: "Customer / Pekerjaan", bold: true, fontSize: 9 },
              { text: params.entity.title, fontSize: 9 },
            ],
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 14],
      },
      // RINGKASAN AKTIVITAS / PEKERJAAN
      {
        text: "Daftar Kegiatan & Pekerjaan di Lapangan:",
        fontSize: 11,
        bold: true,
        margin: [0, 0, 0, 4],
      },
    ];

    if (params.activities && params.activities.length > 0) {
      content.push({
        ol: params.activities.map((act) => ({ text: act, fontSize: 9 })),
        margin: [0, 0, 0, 12],
      });
    } else {
      content.push({
        text: "Pekerjaan instalasi / survey sesuai penugasan.",
        fontSize: 9,
        italics: true,
        margin: [0, 0, 0, 12],
      });
    }

    // HASIL LAPANGAN & CATATAN
    content.push(
      {
        text: "Hasil Akhir & Catatan Teknis Lapangan:",
        fontSize: 11,
        bold: true,
        margin: [0, 0, 0, 4],
      },
      {
        text: params.resultNotes || "Pekerjaan telah diselesaikan dengan baik.",
        fontSize: 9,
        margin: [0, 0, 0, 16],
      },
    );

    // GALERI FOTO DOKUMENTASI (GRID 2 KOLOM)
    if (params.photos && params.photos.length > 0) {
      content.push({
        text: `Foto Dokumentasi Lapangan (${params.photos.length} Foto):`,
        fontSize: 11,
        bold: true,
        margin: [0, 0, 0, 8],
      });

      const photoRows: any[] = [];
      for (let i = 0; i < params.photos.length; i += 2) {
        const left = params.photos[i];
        const right = params.photos[i + 1];

        const leftCell = [
          {
            image: `data:image/jpeg;base64,${left.buffer.toString("base64")}`,
            width: 240,
            alignment: "center",
          },
          {
            text: left.caption || `Foto #${i + 1}`,
            fontSize: 8,
            alignment: "center",
            margin: [0, 4, 0, 8],
            color: "#374151",
          },
        ];

        const rightCell = right
          ? [
              {
                image: `data:image/jpeg;base64,${right.buffer.toString("base64")}`,
                width: 240,
                alignment: "center",
              },
              {
                text: right.caption || `Foto #${i + 2}`,
                fontSize: 8,
                alignment: "center",
                margin: [0, 4, 0, 8],
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
            { text: "Teknisi Lapangan,\n\n\n\n", fontSize: 9 },
            { text: params.user.name, bold: true, fontSize: 9, decoration: "underline" },
          ],
        },
        {
          width: "*",
          stack: [
            { text: "Mengetahui / Supervisor,\n\n\n\n", fontSize: 9, alignment: "right" },
            {
              text: "( ........................................ )",
              bold: true,
              fontSize: 9,
              alignment: "right",
            },
          ],
        },
      ],
      margin: [0, 20, 0, 0],
    });

    const docDefinition = {
      pageSize: "A4",
      pageMargins: [35, 30, 35, 30],
      content,
    };

    const buffer = await renderPdf(docDefinition);
    const safeEntity = params.entity.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const fileName = `Laporan-${params.entity.type}-${safeEntity}-${Date.now()}.pdf`;

    return { buffer, fileName };
  }
}

