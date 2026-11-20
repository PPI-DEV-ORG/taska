import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { can, type Action } from "../rbac/permissions.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type ConnectedDocument = {
  module: string;
  moduleKey: string;
  entity: string;
  id: string | number;
  label: string;
  href?: string;
};

@Injectable()
export class FileAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cek apakah user memiliki hak akses terhadap file ini (PRD §7.1 - §7.3 + ACL).
   * 1. Super Admin: selalu boleh.
   * 2. Pengguna dengan hak 'P' pada modul fileManagement: boleh melihat semua (termasuk file lepas).
   * 3. Jika file lepas (standalone): HANYA Super Admin dan pemegang hak 'P' yang boleh akses.
   * 4. Jika ada ACL eksplisit di tabel FilePermission: periksa kecocokan user ID atau role.
   * 5. Jika file terhubung ke dokumen: periksa RBAC user pada modul dokumen sumber (minimal 1 dokumen cocok).
   */
  async canAccessFile(
    user: RequestUser,
    fileId: number,
    action: "VIEW" | "DOWNLOAD" | "EDIT" | "DELETE" = "VIEW",
  ): Promise<boolean> {
    const role = (user.role || "").toUpperCase();
    if (role === "SUPER_ADMIN" || role === "SUPERADMIN") return true;

    const rbacAction: Action = action === "VIEW" ? "L" : action === "DOWNLOAD" ? "E" : action === "EDIT" ? "U" : "A";

    // Hak kelola penuh file management
    const hasFullFm = can(user.role, "fileManagement", "P");

    // 1. Cek ACL eksplisit di tabel FilePermission
    const explicitAcl = await this.prisma.main.filePermission.findFirst({
      where: {
        fileId,
        OR: [
          { principalType: "USER", principalId: String(user.id) },
          { principalType: "ROLE", principalId: user.role },
        ],
      },
    });

    if (explicitAcl) {
      const allowedActions: Record<string, string[]> = {
        VIEW: ["VIEW", "DOWNLOAD", "EDIT", "DELETE"],
        DOWNLOAD: ["DOWNLOAD", "EDIT", "DELETE"],
        EDIT: ["EDIT", "DELETE"],
        DELETE: ["DELETE"],
      };
      if (allowedActions[action]?.includes(explicitAcl.permission)) {
        return true;
      }
    }

    // 2. Cari semua dokumen yang terhubung
    const connected = await this.resolveConnectedDocuments(fileId);
    const isOrphan = connected.length === 0;

    // File Lepas (Standalone): Hanya Super Admin dan pemegang 'P' (Lihat File Lepas)
    if (isOrphan) {
      return hasFullFm;
    }

    // Pemegang 'P' otomatis dapat melihat dokumen bisnis
    if (hasFullFm) return true;

    // 3. Inheritance dari dokumen bisnis yang terhubung (PRD §7.2 - §7.3)
    // Minimal satu record dokumen yang terhubung boleh diakses oleh user
    for (const doc of connected) {
      if (can(user.role, doc.moduleKey, rbacAction)) {
        return true;
      }
      // Khusus preview/VIEW, jika punya hak 'M' (Menu) atau 'L' (Lihat) di modul dokumen sumber, izinkan
      if (action === "VIEW" && (can(user.role, doc.moduleKey, "M") || can(user.role, doc.moduleKey, "L"))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Temukan seluruh dokumen yang mereferensikan file ini di seluruh sistem ERP.
   */
  async resolveConnectedDocuments(fileId: number): Promise<ConnectedDocument[]> {
    if (!fileId || typeof fileId !== "number" || isNaN(fileId)) return [];

    const idStr = String(fileId);
    const docs: ConnectedDocument[] = [];

    // Cek dulu apakah di baris File sendiri sudah tercatat refType & refId
    const fileRow = await this.prisma.main.file.findUnique({
      where: { id: fileId },
      select: { refType: true, refId: true },
    });

    if (fileRow?.refType && fileRow.refType.trim() !== "") {
      const rt = fileRow.refType.toLowerCase();
      const rid = fileRow.refId || "N/A";
      if (rt.includes("quotation") || rt.includes("penawaran")) {
        docs.push({
          module: "Penawaran",
          moduleKey: "quotations",
          entity: "Quotation",
          id: rid,
          label: `Penawaran #${rid}`,
          href: `/quotations/${rid}`,
        });
      } else if (rt.includes("invoicein")) {
        docs.push({
          module: "Faktur Pembelian",
          moduleKey: "invoices",
          entity: "InvoiceIn",
          id: rid,
          label: `Faktur Masuk #${rid}`,
          href: `/invoices-in/${rid}`,
        });
      } else if (rt.includes("invoice")) {
        docs.push({
          module: "Faktur Penjualan",
          moduleKey: "invoices",
          entity: "InvoiceOut",
          id: rid,
          label: `Faktur #${rid}`,
          href: `/invoices/${rid}`,
        });
      } else if (rt.includes("expense") || rt.includes("struk") || rt.includes("nota")) {
        docs.push({
          module: "Pengeluaran",
          moduleKey: "expenses",
          entity: "Expense",
          id: rid,
          label: `Pengeluaran #${rid}`,
          href: `/expenses/${rid}`,
        });
      } else if (rt.includes("purchaserequest") || rt.includes("request")) {
        docs.push({
          module: "Permintaan Barang",
          moduleKey: "purchase-requests",
          entity: "PurchaseRequest",
          id: rid,
          label: `PR #${rid}`,
          href: `/purchase-requests/${rid}`,
        });
      } else if (rt.includes("supplier") || rt.includes("po-s")) {
        docs.push({
          module: "PO Pemasok",
          moduleKey: "supplier-pos",
          entity: "SupplierPO",
          id: rid,
          label: `PO Pemasok #${rid}`,
          href: `/supplier-pos/${rid}`,
        });
      } else if (rt.includes("delivery") || rt.includes("surat-jalan") || rt.includes("surat_jalan")) {
        docs.push({
          module: "Surat Jalan",
          moduleKey: "delivery-notes",
          entity: "DeliveryNote",
          id: rid,
          label: `Surat Jalan #${rid}`,
          href: `/delivery-notes/${rid}`,
        });
      } else if (rt.includes("receiving") || rt.includes("penerimaan")) {
        docs.push({
          module: "Penerimaan Barang",
          moduleKey: "receiving",
          entity: "Receiving",
          id: rid,
          label: `Penerimaan #${rid}`,
          href: `/receiving/${rid}`,
        });
      } else if (rt.includes("cashadvance") || rt.includes("kasbon") || rt.includes("cash-advance")) {
        docs.push({
          module: "Petty Cash",
          moduleKey: "cash-advances",
          entity: "CashAdvance",
          id: rid,
          label: `Kasbon #${rid}`,
          href: `/cash-advances/${rid}`,
        });
      } else if (rt.includes("project") || rt.includes("proyek")) {
        docs.push({
          module: "Proyek",
          moduleKey: "projects",
          entity: "Project",
          id: rid,
          label: `Proyek #${rid}`,
          href: `/projects/${rid}`,
        });
      } else if (rt.includes("task") || rt.includes("tugas")) {
        docs.push({
          module: "Tugas Proyek",
          moduleKey: "tasks",
          entity: "Task",
          id: rid,
          label: `Tugas #${rid}`,
          href: `/projects/${rid}`,
        });
      } else if (rt.includes("clientpo") || rt.includes("po-client")) {
        docs.push({
          module: "Pesanan Penjualan (SO)",
          moduleKey: "po-client",
          entity: "ClientPO",
          id: rid,
          label: `SO #${rid}`,
          href: `/po-client/${rid}`,
        });
      } else if (rt.includes("damage") || rt.includes("rusak")) {
        docs.push({
          module: "Laporan Kerusakan",
          moduleKey: "damage-reports",
          entity: "DamageReport",
          id: rid,
          label: `Kerusakan #${rid}`,
        });
      } else if (rt.includes("profile") || rt.includes("user") || rt.includes("profil") || rt.includes("avatar")) {
        docs.push({
          module: "Pengguna",
          moduleKey: "users",
          entity: "User",
          id: rid,
          label: `Profil Pengguna #${rid}`,
          href: `/users`,
        });
      } else if (rt.includes("setting") || rt.includes("company") || rt.includes("logo")) {
        docs.push({
          module: "Pengaturan Sistem",
          moduleKey: "settings",
          entity: "SystemSetting",
          id: rid,
          label: `Pengaturan: ${fileRow.refType}`,
          href: `/settings`,
        });
      } else {
        docs.push({
          module: fileRow.refType,
          moduleKey: "documents",
          entity: fileRow.refType,
          id: rid,
          label: `${fileRow.refType} #${rid}`,
        });
      }
    }

    const [
      photos,
      invoiceOuts,
      payments,
      expenses,
      prs,
      supplierPos,
      deliveryNotes,
      projects,
      tasks,
      clientPos,
      invoiceIns,
      quotations,
      quotationVersions,
      receivings,
      issueReports,
      damageReports,
      pocReports,
      visitReports,
      maintReports,
      cashAdvances,
      subDocs,
      faAssets,
      faAssetDocs,
      faAuditItems,
      ctrDocs,
      maintAttachments,
      explicitRelations,
    ] = await Promise.all([
      // 1. DocumentationPhoto
      this.prisma.main.documentationPhoto.findMany({
        where: { fileId },
        select: { id: true, entityType: true, entityId: true },
      }),
      // 2. InvoiceOut
      this.prisma.main.invoiceOut.findMany({
        where: { OR: [{ fileId }, { paidFileId: fileId }, { latestFileId: fileId }] },
        select: { id: true, number: true, subject: true },
      }),
      // 3. Payment
      this.prisma.main.payment.findMany({
        where: { fileId },
        select: { id: true, invoiceOutId: true },
      }),
      // 4. Expense
      this.prisma.main.expense.findMany({
        where: {
          OR: [
            { receiptFileId: fileId },
            { paidFileId: fileId },
            { receiptFileIds: { contains: idStr } },
          ],
        },
        select: { id: true, description: true },
      }),
      // 5. PurchaseRequest
      this.prisma.main.purchaseRequest.findMany({
        where: { OR: [{ evidenceFileId: fileId }, { doFileId: fileId }, { paymentProofFileId: fileId }] },
        select: { id: true, number: true },
      }),
      // 6. SupplierPO
      this.prisma.main.supplierPO.findMany({
        where: { OR: [{ fileId }, { doFileId: fileId }, { soFileId: fileId }] },
        select: { id: true, number: true },
      }),
      // 7. DeliveryNote
      this.prisma.main.deliveryNote.findMany({
        where: { OR: [{ scanFileId: fileId }, { reportFileId: fileId }] },
        select: { id: true, number: true },
      }),
      // 8. Project
      this.prisma.main.project.findMany({
        where: {
          OR: [
            { prdFileId: fileId },
            { bahpFileId: fileId },
            { bastFileId: fileId },
            { doFileId: fileId },
            { boqFileId: fileId },
          ],
        },
        select: { id: true, name: true },
      }),
      // 9. Task
      this.prisma.main.task.findMany({
        where: { OR: [{ bahpFileId: fileId }, { bastFileId: fileId }, { doFileId: fileId }] },
        select: { id: true, name: true, projectId: true },
      }),
      // 10. ClientPO
      this.prisma.main.clientPO.findMany({
        where: { OR: [{ fileId }, { soFileId: fileId }, { paymentProofFileId: fileId }] },
        select: { id: true, number: true, soNumber: true },
      }),
      // 11. InvoiceIn
      this.prisma.main.invoiceIn.findMany({
        where: { OR: [{ fileId }, { transferFileId: fileId }, { taxInvoiceFileId: fileId }] },
        select: { id: true, number: true },
      }),
      // 12. Quotation
      this.prisma.main.quotation.findMany({
        where: { latestFileId: fileId },
        select: { id: true, number: true, subject: true },
      }),
      // 13. QuotationVersion
      this.prisma.main.quotationVersion.findMany({
        where: { fileId },
        select: { id: true, quotationId: true, quotation: { select: { number: true } } },
      }),
      // 14. Receiving
      this.prisma.main.receiving.findMany({
        where: { OR: [{ receiptFileId: fileId }, { photoFileId: fileId }] },
        select: { id: true, number: true },
      }),
      // 15. IssueReport & DamageReport
      this.prisma.main.issueReport.findMany({
        where: { fileId },
        select: { id: true, poNumber: true, description: true },
      }),
      this.prisma.main.damageReport.findMany({
        where: { fileId },
        select: { id: true, description: true },
      }),
      // 16. POC & Visit Reports
      this.prisma.main.pocReport.findMany({
        where: { OR: [{ logoFileId: fileId }, { documentFileId: fileId }] },
        select: { id: true, number: true, title: true },
      }),
      this.prisma.main.visitReport.findMany({
        where: { OR: [{ logoFileId: fileId }, { documentFileId: fileId }] },
        select: { id: true, number: true, title: true },
      }),
      // 17. Maintenance Reports
      this.prisma.main.maintenanceReport.findMany({
        where: { OR: [{ logoFileId: fileId }, { documentFileId: fileId }] },
        select: { id: true, number: true, title: true },
      }),
      // 18. CashAdvance
      this.prisma.main.cashAdvance.findMany({
        where: { OR: [{ disburseFileId: fileId }, { returnFileId: fileId }] },
        select: { id: true, number: true, description: true },
      }),
      // 19. Subscriptions
      this.prisma.main.subDocument.findMany({
        where: { fileUrl: { contains: `/api/files/${fileId}` } },
        select: { id: true, subscriptionId: true, title: true },
      }),
      // 20. Fixed Assets
      this.prisma.main.faAsset.findMany({
        where: {
          OR: [
            { photoUrl: { contains: `/api/files/${fileId}` } },
            { documentUrl: { contains: `/api/files/${fileId}` } },
          ],
        },
        select: { id: true, assetCode: true, name: true },
      }),
      this.prisma.main.faAssetDocument.findMany({
        where: { fileUrl: { contains: `/api/files/${fileId}` } },
        select: { id: true, assetId: true, title: true },
      }),
      this.prisma.main.faAssetAuditItem.findMany({
        where: { photoUrl: { contains: `/api/files/${fileId}` } },
        select: { id: true, auditId: true },
      }),
      // 21. Contracts
      this.prisma.main.ctrDocumentVersion.findMany({
        where: { OR: [{ fileId }, { fileUrl: { contains: `/api/files/${fileId}` } }] },
        select: { id: true, documentId: true, document: { select: { contractId: true, documentTitle: true } } },
      }),
      // 22. Maintenance Attachments
      this.prisma.main.maintAttachment.findMany({
        where: { OR: [{ fileId }, { fileUrl: { contains: `/api/files/${fileId}` } }] },
        select: { id: true, requestId: true, workOrderId: true, title: true },
      }),
      // 23. FileRelation (Tabel relasi polymorphic baru)
      this.prisma.main.fileRelation.findMany({
        where: { fileId },
        select: { id: true, moduleCode: true, entityType: true, entityId: true, relationType: true },
      }),
    ]);

    // Format hasil
    for (const p of photos) {
      docs.push({
        module: "Dokumentasi",
        moduleKey: "documentation",
        entity: p.entityType,
        id: p.entityId,
        label: `Foto ${p.entityType} #${p.entityId}`,
      });
    }

    for (const inv of invoiceOuts) {
      docs.push({
        module: "Faktur Penjualan",
        moduleKey: "invoices",
        entity: "InvoiceOut",
        id: inv.id,
        label: `Faktur ${inv.number}${inv.subject ? ` (${inv.subject})` : ""}`,
        href: `/invoices/${inv.id}`,
      });
    }

    for (const pay of payments) {
      docs.push({
        module: "Pembayaran",
        moduleKey: "invoices",
        entity: "Payment",
        id: pay.id,
        label: `Bukti Bayar Faktur #${pay.invoiceOutId}`,
      });
    }

    for (const exp of expenses) {
      docs.push({
        module: "Pengeluaran",
        moduleKey: "expenses",
        entity: "Expense",
        id: exp.id,
        label: `Pengeluaran #${exp.id}: ${exp.description.slice(0, 40)}`,
        href: `/expenses/${exp.id}`,
      });
    }

    for (const pr of prs) {
      docs.push({
        module: "Permintaan Barang",
        moduleKey: "purchase-requests",
        entity: "PurchaseRequest",
        id: pr.id,
        label: `PR ${pr.number}`,
        href: `/purchase-requests/${pr.id}`,
      });
    }

    for (const po of supplierPos) {
      docs.push({
        module: "PO Pemasok",
        moduleKey: "supplier-pos",
        entity: "SupplierPO",
        id: po.id,
        label: `PO Pemasok ${po.number}`,
        href: `/supplier-pos/${po.id}`,
      });
    }

    for (const dn of deliveryNotes) {
      docs.push({
        module: "Surat Jalan",
        moduleKey: "delivery-notes",
        entity: "DeliveryNote",
        id: dn.id,
        label: `Surat Jalan ${dn.number}`,
        href: `/delivery-notes/${dn.id}`,
      });
    }

    for (const proj of projects) {
      docs.push({
        module: "Proyek",
        moduleKey: "projects",
        entity: "Project",
        id: proj.id,
        label: `Proyek: ${proj.name}`,
        href: `/projects/${proj.id}`,
      });
    }

    for (const t of tasks) {
      docs.push({
        module: "Tugas Proyek",
        moduleKey: "tasks",
        entity: "Task",
        id: t.id,
        label: `Tugas: ${t.name}`,
        href: `/projects/${t.projectId}`,
      });
    }

    for (const cpo of clientPos) {
      docs.push({
        module: "Pesanan Penjualan (SO)",
        moduleKey: "po-client",
        entity: "ClientPO",
        id: cpo.id,
        label: `SO ${cpo.soNumber || cpo.number}`,
        href: `/po-client/${cpo.id}`,
      });
    }

    for (const ii of invoiceIns) {
      docs.push({
        module: "Faktur Pembelian",
        moduleKey: "invoices",
        entity: "InvoiceIn",
        id: ii.id,
        label: `Faktur Masuk ${ii.number}`,
        href: `/invoices-in/${ii.id}`,
      });
    }

    for (const q of quotations) {
      docs.push({
        module: "Penawaran",
        moduleKey: "quotations",
        entity: "Quotation",
        id: q.id,
        label: `Penawaran ${q.number}`,
        href: `/quotations/${q.id}`,
      });
    }

    for (const qv of quotationVersions) {
      docs.push({
        module: "Versi Penawaran",
        moduleKey: "quotations",
        entity: "QuotationVersion",
        id: qv.id,
        label: `Versi Penawaran ${qv.quotation?.number ?? `#${qv.quotationId}`}`,
        href: `/quotations/${qv.quotationId}`,
      });
    }

    for (const rec of receivings) {
      docs.push({
        module: "Penerimaan Barang",
        moduleKey: "receiving",
        entity: "Receiving",
        id: rec.id,
        label: `Penerimaan ${rec.number}`,
        href: `/receiving/${rec.id}`,
      });
    }

    for (const ir of issueReports) {
      docs.push({
        module: "Laporan Kendala",
        moduleKey: "damage-reports",
        entity: "IssueReport",
        id: ir.id,
        label: `Kendala PO ${ir.poNumber}: ${ir.description.slice(0, 30)}`,
      });
    }

    for (const dr of damageReports) {
      docs.push({
        module: "Laporan Kerusakan",
        moduleKey: "damage-reports",
        entity: "DamageReport",
        id: dr.id,
        label: `Kerusakan: ${dr.description.slice(0, 30)}`,
      });
    }

    for (const poc of pocReports) {
      docs.push({
        module: "Laporan POC",
        moduleKey: "poc-reports",
        entity: "PocReport",
        id: poc.id,
        label: `POC ${poc.number}: ${poc.title}`,
        href: `/poc-reports/${poc.id}`,
      });
    }

    for (const vr of visitReports) {
      docs.push({
        module: "Laporan Kunjungan",
        moduleKey: "visit-reports",
        entity: "VisitReport",
        id: vr.id,
        label: `Kunjungan ${vr.number}: ${vr.title}`,
        href: `/visit-reports/${vr.id}`,
      });
    }

    for (const mr of maintReports) {
      docs.push({
        module: "Laporan Maintenance Lapangan",
        moduleKey: "maintenance-reports",
        entity: "MaintenanceReport",
        id: mr.id,
        label: `Servis ${mr.number}: ${mr.title}`,
        href: `/maintenance-reports/${mr.id}`,
      });
    }

    for (const ca of cashAdvances) {
      docs.push({
        module: "Petty Cash",
        moduleKey: "cash-advances",
        entity: "CashAdvance",
        id: ca.id,
        label: `Kasbon ${ca.number}: ${ca.description.slice(0, 30)}`,
        href: `/cash-advances/${ca.id}`,
      });
    }

    for (const sd of subDocs) {
      docs.push({
        module: "Langganan",
        moduleKey: "subscriptions",
        entity: "SubDocument",
        id: sd.subscriptionId,
        label: `Dokumen Langganan: ${sd.title}`,
        href: `/subscriptions`,
      });
    }

    for (const fa of faAssets) {
      docs.push({
        module: "Aset Tetap",
        moduleKey: "fixed-assets",
        entity: "FaAsset",
        id: fa.id,
        label: `Aset [${fa.assetCode}] ${fa.name}`,
        href: `/fixed-assets/${fa.id}`,
      });
    }

    for (const fad of faAssetDocs) {
      docs.push({
        module: "Dokumen Aset",
        moduleKey: "fixed-assets",
        entity: "FaAssetDocument",
        id: fad.assetId,
        label: `Dokumen Aset: ${fad.title}`,
        href: `/fixed-assets/${fad.assetId}`,
      });
    }

    for (const fai of faAuditItems) {
      docs.push({
        module: "Audit Aset",
        moduleKey: "fixed-assets",
        entity: "FaAssetAuditItem",
        id: fai.auditId,
        label: `Audit Aset #${fai.auditId}`,
        href: `/fixed-assets`,
      });
    }

    for (const cd of ctrDocs) {
      docs.push({
        module: "Kontrak",
        moduleKey: "contracts",
        entity: "CtrDocument",
        id: cd.document?.contractId ?? cd.documentId,
        label: `Dokumen Kontrak: ${cd.document?.documentTitle ?? `#${cd.documentId}`}`,
        href: `/contracts/${cd.document?.contractId ?? cd.documentId}`,
      });
    }

    for (const ma of maintAttachments) {
      docs.push({
        module: "Pemeliharaan EAM",
        moduleKey: "maintenance",
        entity: "MaintAttachment",
        id: ma.workOrderId ?? ma.requestId ?? ma.id,
        label: `Attachment Maintenance ${ma.title || `#${ma.id}`}`,
        href: `/maintenance`,
      });
    }

    for (const rel of explicitRelations) {
      docs.push({
        module: rel.moduleCode,
        moduleKey: rel.moduleCode.toLowerCase().replace(/_/g, "-"),
        entity: rel.entityType,
        id: rel.entityId,
        label: `${rel.entityType} #${rel.entityId} (${rel.relationType})`,
      });
    }

    return docs;
  }

  private connectedCache: { set: Set<number>; timestamp: number } | null = null;

  /**
   * Reset cache koneksi dokumen (panggil setelah mutasi file/relasi).
   */
  invalidateConnectedCache() {
    this.connectedCache = null;
  }

  /**
   * Mengambil set seluruh fileId yang sedang terhubung ke dokumen di ERP secara cepat (batch).
   * Dilengkapi in-memory cache 30 detik untuk navigasi & kalkulasi instan (<1ms).
   */
  async getConnectedFileIdSet(forceFresh = false): Promise<Set<number>> {
    const now = Date.now();
    if (!forceFresh && this.connectedCache && now - this.connectedCache.timestamp < 30_000) {
      return this.connectedCache.set;
    }

    const used = new Set<number>();

    const [
      photos,
      invoiceOuts,
      payments,
      expenses,
      prs,
      supplierPos,
      deliveryNotes,
      projects,
      tasks,
      clientPos,
      invoiceIns,
      quotations,
      quotationVersions,
      receivings,
      issueReports,
      damageReports,
      pocReports,
      visitReports,
      maintReports,
      cashAdvances,
      explicitRelations,
    ] = await Promise.all([
      this.prisma.main.documentationPhoto.findMany({ select: { fileId: true } }),
      this.prisma.main.invoiceOut.findMany({ select: { fileId: true, paidFileId: true, latestFileId: true } }),
      this.prisma.main.payment.findMany({ select: { fileId: true } }),
      this.prisma.main.expense.findMany({ select: { receiptFileId: true, paidFileId: true } }),
      this.prisma.main.purchaseRequest.findMany({ select: { evidenceFileId: true, doFileId: true, paymentProofFileId: true } }),
      this.prisma.main.supplierPO.findMany({ select: { fileId: true, doFileId: true, soFileId: true } }),
      this.prisma.main.deliveryNote.findMany({ select: { scanFileId: true, reportFileId: true } }),
      this.prisma.main.project.findMany({ select: { prdFileId: true, bahpFileId: true, bastFileId: true, doFileId: true, boqFileId: true } }),
      this.prisma.main.task.findMany({ select: { bahpFileId: true, bastFileId: true, doFileId: true } }),
      this.prisma.main.clientPO.findMany({ select: { fileId: true, soFileId: true, paymentProofFileId: true } }),
      this.prisma.main.invoiceIn.findMany({ select: { fileId: true, transferFileId: true, taxInvoiceFileId: true } }),
      this.prisma.main.quotation.findMany({ select: { latestFileId: true } }),
      this.prisma.main.quotationVersion.findMany({ select: { fileId: true } }),
      this.prisma.main.receiving.findMany({ select: { receiptFileId: true, photoFileId: true } }),
      this.prisma.main.issueReport.findMany({ select: { fileId: true } }),
      this.prisma.main.damageReport.findMany({ select: { fileId: true } }),
      this.prisma.main.pocReport.findMany({ select: { logoFileId: true, documentFileId: true } }),
      this.prisma.main.visitReport.findMany({ select: { logoFileId: true, documentFileId: true } }),
      this.prisma.main.maintenanceReport.findMany({ select: { logoFileId: true, documentFileId: true } }),
      this.prisma.main.cashAdvance.findMany({ select: { disburseFileId: true, returnFileId: true } }),
      this.prisma.main.fileRelation.findMany({ select: { fileId: true } }),
    ]);

    const add = (id: number | null | undefined) => {
      if (id && typeof id === "number" && !isNaN(id)) used.add(id);
    };

    photos.forEach((r) => add(r.fileId));
    invoiceOuts.forEach((r) => { add(r.fileId); add(r.paidFileId); add(r.latestFileId); });
    payments.forEach((r) => add(r.fileId));
    expenses.forEach((r) => { add(r.receiptFileId); add(r.paidFileId); });
    prs.forEach((r) => { add(r.evidenceFileId); add(r.doFileId); add(r.paymentProofFileId); });
    supplierPos.forEach((r) => { add(r.fileId); add(r.doFileId); add(r.soFileId); });
    deliveryNotes.forEach((r) => { add(r.scanFileId); add(r.reportFileId); });
    projects.forEach((r) => { add(r.prdFileId); add(r.bahpFileId); add(r.bastFileId); add(r.doFileId); add(r.boqFileId); });
    tasks.forEach((r) => { add(r.bahpFileId); add(r.bastFileId); add(r.doFileId); });
    clientPos.forEach((r) => { add(r.fileId); add(r.soFileId); add(r.paymentProofFileId); });
    invoiceIns.forEach((r) => { add(r.fileId); add(r.transferFileId); add(r.taxInvoiceFileId); });
    quotations.forEach((r) => add(r.latestFileId));
    quotationVersions.forEach((r) => add(r.fileId));
    receivings.forEach((r) => { add(r.receiptFileId); add(r.photoFileId); });
    issueReports.forEach((r) => add(r.fileId));
    damageReports.forEach((r) => add(r.fileId));
    pocReports.forEach((r) => { add(r.logoFileId); add(r.documentFileId); });
    visitReports.forEach((r) => { add(r.logoFileId); add(r.documentFileId); });
    maintReports.forEach((r) => { add(r.logoFileId); add(r.documentFileId); });
    cashAdvances.forEach((r) => { add(r.disburseFileId); add(r.returnFileId); });
    explicitRelations.forEach((r) => add(r.fileId));

    this.connectedCache = { set: used, timestamp: now };
    return used;
  }
}
