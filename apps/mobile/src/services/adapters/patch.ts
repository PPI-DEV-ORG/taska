import { findId, parseTagInput, resolveMemberIds } from "./db-helpers";
import { forPatch } from "./patch-fields";
import { roleFromUi } from "./roles";
import { toEnum } from "./status-maps";

export function buildPatchBody(
  module: string,
  patch: Record<string, any>,
  db?: Record<string, any>,
): Record<string, any> {
  const num = (v: any) => Number(String(v ?? 0).replace(/[^\d.-]/g, "")) || 0;
  const out: Record<string, any> = {};

  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v;
  }

  if (patch.nama !== undefined) out.name = patch.nama;
  if (patch.kota !== undefined) out.city = patch.kota;
  if (patch.kontak !== undefined) {
    if (module === "leads") out.contactName = patch.kontak;
    else out.pic = patch.kontak;
  }
  if (patch.telepon !== undefined) out.phone = patch.telepon;
  if (patch.catatan !== undefined) {
    if (module === "receiving") out.conditionNote = patch.catatan;
    else if (module === "purchase-requests") out.otherNote = patch.catatan;
    else out.notes = patch.catatan;
  }
  if (patch.catatanTeknis !== undefined) out.notes = patch.catatanTeknis;
  if (patch.deskripsi !== undefined) out.description = patch.deskripsi;
  if (patch.keterangan !== undefined) out.description = patch.keterangan;
  if (patch.alasan !== undefined && module === "expenses")
    out.description = patch.alasan;
  if (patch.tujuan !== undefined && module === "purchase-requests")
    out.purpose = patch.tujuan;
  if (patch.nomor !== undefined) out.number = patch.nomor;
  if (patch.tanggal !== undefined) out.date = patch.tanggal;
  if (patch.jadwal !== undefined) out.scheduleAt = patch.jadwal;
  if (patch.lokasi !== undefined) out.location = patch.lokasi;
  if (patch.biaya !== undefined) out.cost = num(patch.biaya);
  if (patch.nominal !== undefined) out.amount = num(patch.nominal);
  if (patch.satuan !== undefined) out.unit = patch.satuan;
  if (patch.merk !== undefined) out.brand = patch.merk;
  if (patch.brand !== undefined) out.brand = patch.brand;
  if (patch.berSN !== undefined) out.hasSerial = !!patch.berSN;
  if (patch.min !== undefined) out.minStock = num(patch.min);
  if (patch.minStock !== undefined) out.minStock = num(patch.minStock);
  if (patch.hargaBeli !== undefined) out.purchasePrice = num(patch.hargaBeli);
  if (patch.hargaJual !== undefined && module === "products") {
    const sellPriceVal = num(patch.hargaJual);
    let desc =
      patch.deskripsi ||
      patch.description ||
      (db?.products
        ? (db.products.find(
            (p: any) => p.id === patch.id || String(p.id) === String(patch.id),
          )?.description ?? "")
        : "") ||
      "";
    if (/SELL:[^;]+/i.test(desc)) {
      desc = desc.replace(/SELL:[^;]+/i, `SELL:${sellPriceVal}`);
    } else {
      desc = desc.trim()
        ? `${desc};SELL:${sellPriceVal}`
        : `SELL:${sellPriceVal}`;
    }
    out.description = desc;
  }
  if (patch.garansi !== undefined) {
    const rawG = String(patch.garansi).toLowerCase();
    if (rawG.includes("tahun") || rawG.includes("thn") || rawG.includes("yr")) {
      out.warrantyMonths = (parseInt(rawG, 10) || 1) * 12;
    } else if (rawG.includes("tanpa") || rawG === "-" || rawG === "0") {
      out.warrantyMonths = undefined;
    } else {
      out.warrantyMonths = parseInt(rawG, 10) || undefined;
    }
  }
  if (patch.warrantyMonths !== undefined)
    out.warrantyMonths = Number(patch.warrantyMonths) || undefined;
  if (patch.categoryId !== undefined)
    out.categoryId = patch.categoryId ? Number(patch.categoryId) : undefined;
  else if (patch.kategori !== undefined && module === "products") {
    const matchCat = (db?.productCategories ?? []).find(
      (c: any) => c.nama === patch.kategori || c.name === patch.kategori,
    );
    if (matchCat?.id) out.categoryId = Number(matchCat.id);
  }
  if (patch.payment !== undefined) out.paymentTerms = patch.payment;

  if (patch.fileId !== undefined) {
    if (module === "expenses")
      out.receiptFileId = patch.fileId ? Number(patch.fileId) : null;
    else if (module === "purchase-requests")
      out.evidenceFileId = patch.fileId ? Number(patch.fileId) : null;
    else if (module === "receiving")
      out.receiptFileId = patch.fileId ? Number(patch.fileId) : null;
    else if (module === "delivery-notes")
      out.scanFileId = patch.fileId ? Number(patch.fileId) : null;
    else out.fileId = patch.fileId ? Number(patch.fileId) : null;
  }
  if (patch.receiptFileId !== undefined)
    out.receiptFileId = patch.receiptFileId
      ? Number(patch.receiptFileId)
      : null;
  if (patch.paidFileId !== undefined)
    out.paidFileId = patch.paidFileId ? Number(patch.paidFileId) : null;
  if (patch.evidenceFileId !== undefined)
    out.evidenceFileId = patch.evidenceFileId
      ? Number(patch.evidenceFileId)
      : null;
  if (patch.documentFileId !== undefined)
    out.documentFileId = patch.documentFileId
      ? Number(patch.documentFileId)
      : null;
  if (patch.scanFileId !== undefined)
    out.scanFileId = patch.scanFileId ? Number(patch.scanFileId) : null;
  if (patch.reportFileId !== undefined)
    out.reportFileId = patch.reportFileId ? Number(patch.reportFileId) : null;
  if (patch.doFileId !== undefined)
    out.doFileId = patch.doFileId ? Number(patch.doFileId) : null;
  if (patch.soFileId !== undefined)
    out.soFileId = patch.soFileId ? Number(patch.soFileId) : null;
  if (patch.prdFileId !== undefined)
    out.prdFileId = patch.prdFileId ? Number(patch.prdFileId) : null;
  if (patch.bahpFileId !== undefined)
    out.bahpFileId = patch.bahpFileId ? Number(patch.bahpFileId) : null;
  if (patch.bastFileId !== undefined)
    out.bastFileId = patch.bastFileId ? Number(patch.bastFileId) : null;
  if (patch.boqFileId !== undefined)
    out.boqFileId = patch.boqFileId ? Number(patch.boqFileId) : null;
  if (patch.photoFileId !== undefined)
    out.photoFileId = patch.photoFileId ? Number(patch.photoFileId) : null;
  if (patch.latestFileId !== undefined && module === "quotations")
    out.fileId = patch.latestFileId ? Number(patch.latestFileId) : null;

  if (module === "expenses") {
    if (patch.kategori !== undefined)
      out.categoryId = findId(db?.expenseCategories, patch.kategori);
    if (patch.project !== undefined)
      out.projectId = findId(db?.projects, patch.project);
    if (patch.survey !== undefined) {
      out.surveyId =
        patch.survey === "-" || !patch.survey
          ? null
          : Number(String(patch.survey).match(/#(\d+)/)?.[1]) || null;
    }
    if (patch.surveyId !== undefined)
      out.surveyId = patch.surveyId ? Number(patch.surveyId) : null;
    if (patch.pocReport !== undefined) {
      out.pocReportId =
        patch.pocReport === "-" || !patch.pocReport
          ? null
          : Number(
              String(patch.pocReport).match(/#(\d+)/)?.[1] ||
                (db?.["poc-reports"] ?? []).find(
                  (p: any) =>
                    `POC ${p.nomor || p.number} - ${p.judul || p.title}` ===
                      patch.pocReport ||
                    p.nomor === patch.pocReport ||
                    p.number === patch.pocReport ||
                    p.judul === patch.pocReport,
                )?.id ||
                findId(db?.["poc-reports"], patch.pocReport),
            ) || null;
    }
    if (patch.pocReportId !== undefined)
      out.pocReportId = patch.pocReportId ? Number(patch.pocReportId) : null;
    if (patch.visitReport !== undefined) {
      out.visitReportId =
        patch.visitReport === "-" || !patch.visitReport
          ? null
          : Number(
              String(patch.visitReport).match(/#(\d+)/)?.[1] ||
                (db?.["visit-reports"] ?? []).find(
                  (p: any) =>
                    `VISIT ${p.nomor || p.number} - ${p.judul || p.title}` ===
                      patch.visitReport ||
                    p.nomor === patch.visitReport ||
                    p.number === patch.visitReport ||
                    p.judul === patch.visitReport,
                )?.id ||
                findId(db?.["visit-reports"], patch.visitReport),
            ) || null;
    }
    if (patch.visitReportId !== undefined)
      out.visitReportId = patch.visitReportId
        ? Number(patch.visitReportId)
        : null;
    if (patch.maintenanceReport !== undefined) {
      out.maintenanceReportId =
        patch.maintenanceReport === "-" || !patch.maintenanceReport
          ? null
          : Number(
              String(patch.maintenanceReport).match(/#(\d+)/)?.[1] ||
                (db?.["maintenance-reports"] ?? []).find(
                  (p: any) =>
                    `MTN ${p.nomor || p.number} - ${p.judul || p.title}` ===
                      patch.maintenanceReport ||
                    p.nomor === patch.maintenanceReport ||
                    p.number === patch.maintenanceReport ||
                    p.judul === patch.maintenanceReport,
                )?.id ||
                findId(db?.["maintenance-reports"], patch.maintenanceReport),
            ) || null;
    }
    if (patch.maintenanceReportId !== undefined)
      out.maintenanceReportId = patch.maintenanceReportId
        ? Number(patch.maintenanceReportId)
        : null;
    if (patch.sumberDana !== undefined) {
      out.fundingSource = String(patch.sumberDana)
        .toLowerCase()
        .includes("talangan")
        ? "TALANGAN_PRIBADI"
        : String(patch.sumberDana).toLowerCase().includes("petty")
          ? "PETTY_CASH"
          : "PERUSAHAAN";
    }
    if (patch.fundingSource !== undefined)
      out.fundingSource = patch.fundingSource;
    if (patch.paymentMethod !== undefined)
      out.paymentMethod = patch.paymentMethod;
    if (patch.accountCode !== undefined) out.accountCode = patch.accountCode;
    if (patch.paidAccountCode !== undefined)
      out.paidAccountCode = patch.paidAccountCode;
    if (patch.paymentMethod && !out.paidAccountCode) {
      out.paidAccountCode = String(patch.paymentMethod)
        .toLowerCase()
        .includes("kecil")
        ? "1000.01"
        : "1000.02";
    }
    if (patch.costCenter !== undefined)
      out.costCenterId = findId(db?.costCenters, patch.costCenter);
  }

  if (module === "leads") {
    if (patch.perusahaan !== undefined)
      out.customerId = findId(db?.customers, patch.perusahaan);
    if (patch.sumber !== undefined)
      out.sourceId = findId(db?.leadSources, patch.sumber);
    if (patch.pemilik !== undefined)
      out.ownerId = findId(db?.users, patch.pemilik);
    if (patch.nilai !== undefined) out.estimatedValue = num(patch.nilai);
    if (patch.peluang !== undefined) out.probability = num(patch.peluang);
    if (patch.closing !== undefined) out.targetClosing = patch.closing;
    if (patch.tipe !== undefined)
      out.clientType = toEnum("clientType", patch.tipe);
    if (patch.status !== undefined) out.stage = toEnum("leads", patch.status);
    if (patch.jenisTransaksi !== undefined || patch.need !== undefined) {
      const existingLead = (db?.leads ?? []).find(
        (l: any) => String(l.id) === String(patch.id || out.id),
      );
      const currentNeed =
        patch.need !== undefined ? patch.need : existingLead?.need || "";
      const currentJenis =
        patch.jenisTransaksi !== undefined
          ? patch.jenisTransaksi
          : existingLead?.jenisTransaksi || "Proyek (Instalasi & Jasa)";
      const cleaned = (currentNeed || "").replace(/\[JENIS:[^\]]+\]\s*/gi, "");
      out.need = `[JENIS:${currentJenis.trim()}] ${cleaned}`.trim();
    }
    if (patch.alasanLost !== undefined) {
      out.lostNote = patch.alasanLost;
      const lrId = findId(db?.lostReasons, patch.alasanLost);
      if (lrId) out.lostReasonId = lrId;
    }
  } else if (module === "quotations") {
    if (patch.nilai !== undefined && patch.total === undefined)
      out.total = num(patch.nilai);
    if (patch.total !== undefined) out.total = num(patch.total);
    if (patch.disc !== undefined) out.discount = num(patch.disc);
    if (patch.ppn !== undefined) out.ppn = num(patch.ppn);
    if (patch.pph !== undefined) out.pph = num(patch.pph);
    if (patch.pphMode !== undefined) out.pphMode = patch.pphMode;
    if (patch.tipePph !== undefined) out.tipePph = patch.tipePph;
    if (patch.totalAfterDisc !== undefined)
      out.grandTotal = num(patch.totalAfterDisc);
    if (patch.berlaku !== undefined) {
      const v = String(patch.berlaku).trim();
      out.validUntil = v && v !== "-" ? new Date(v).toISOString() : undefined;
      delete out.berlaku;
    }
    if (patch.validUntil !== undefined) {
      const v = String(patch.validUntil).trim();
      out.validUntil = v && v !== "-" ? new Date(v).toISOString() : undefined;
    }
    if (patch.status !== undefined)
      out.status = toEnum("quotations", patch.status) || patch.status;
    if (patch.items !== undefined) out.items = patch.items;
    if (patch.subject !== undefined) out.subject = patch.subject;
    if (patch.intro !== undefined) out.intro = patch.intro;
    if (patch.notesList !== undefined) out.notesList = patch.notesList;
    if (patch.city !== undefined) out.city = patch.city;
    if (patch.kopText !== undefined) out.kopText = patch.kopText;
    if (patch.customerAddress !== undefined)
      out.customerAddress = patch.customerAddress;
    if (patch.signerName !== undefined) out.signerName = patch.signerName;
    if (patch.signerTitle !== undefined) out.signerTitle = patch.signerTitle;
  } else if (module === "surveys") {
    if (patch.status !== undefined)
      out.status = toEnum("surveys", patch.status) || patch.status;
    if (patch.tim !== undefined) out.memberIds = resolveMemberIds(patch, db);
    if (patch.leadId !== undefined)
      out.leadId = patch.leadId ? Number(patch.leadId) : undefined;
    if (patch.lead !== undefined) {
      const lId =
        patch.lead && patch.lead !== "-" ? findId(db?.leads, patch.lead) : null;
      if (lId) out.leadId = lId;
    }
  } else if (module === "projects") {
    if (patch.jenis !== undefined)
      out.type = toEnum("projectType", patch.jenis);
    if (patch.customer !== undefined)
      out.customerId = findId(db?.customers, patch.customer);
    if (patch.lead !== undefined) {
      if (patch.lead === "-" || !patch.lead) {
        out.quotationId = null;
      } else {
        const selName = (String(patch.lead).split(" · ")[0] ?? "")
          .trim()
          .toLowerCase();
        const leadObj = (db?.leads ?? []).find(
          (l: any) =>
            l.nama?.toLowerCase() === selName ||
            l.name?.toLowerCase() === selName,
        );
        const qObj = leadObj
          ? (db?.quotations ?? []).find(
              (q: any) =>
                (q.leadId && String(q.leadId) === String(leadObj.id)) ||
                (q.lead &&
                  q.lead.toLowerCase() === leadObj.nama?.toLowerCase()),
            )
          : null;
        if (qObj?.id) out.quotationId = Number(qObj.id);
        if (leadObj?.customerId && out.customerId === undefined)
          out.customerId = Number(leadObj.customerId);
      }
    }
    if (patch.penawaran !== undefined) {
      out.quotationId =
        patch.penawaran === "-" || !patch.penawaran
          ? null
          : (findId(db?.quotations, patch.penawaran) ?? null);
    }
    if (patch.quotationId !== undefined)
      out.quotationId = patch.quotationId ? Number(patch.quotationId) : null;
    if (patch.pmId !== undefined)
      out.picId = patch.pmId ? Number(patch.pmId) : null;
    else if (patch.pm !== undefined) {
      const foundPic = findId(db?.users, patch.pm);
      if (foundPic !== undefined) out.picId = foundPic;
    }
    if (patch.mulai !== undefined) out.startDate = patch.mulai;
    if (patch.selesai !== undefined) out.endDate = patch.selesai;
    if (patch.progres !== undefined) out.progress = num(patch.progres);
    if (patch.status !== undefined) {
      out.status = toEnum("projects", patch.status) || patch.status;
      if (out.status === "SELESAI" || patch.status === "Selesai") {
        out.progress = 100;
      }
    }
    if (Array.isArray(patch.memberIds)) out.memberIds = patch.memberIds;
    else if (patch.tim !== undefined)
      out.memberIds = resolveMemberIds(patch, db);
    if (patch.prdFileId !== undefined)
      out.prdFileId = patch.prdFileId ? Number(patch.prdFileId) : null;
    if (patch.bahpFileId !== undefined)
      out.bahpFileId = patch.bahpFileId ? Number(patch.bahpFileId) : null;
    if (patch.bastFileId !== undefined)
      out.bastFileId = patch.bastFileId ? Number(patch.bastFileId) : null;
    if (patch.doFileId !== undefined)
      out.doFileId = patch.doFileId ? Number(patch.doFileId) : null;
    if (patch.boqFileId !== undefined)
      out.boqFileId = patch.boqFileId ? Number(patch.boqFileId) : null;
  } else if (module === "tasks") {
    if (patch.pic !== undefined) out.assigneeId = findId(db?.users, patch.pic);
    if (patch.tenggat !== undefined) out.dueDate = patch.tenggat;
    if (patch.progres !== undefined) out.progress = num(patch.progres);
    if (patch.perluBarang !== undefined)
      out.needsPurchase = !!patch.perluBarang;
    if (patch.status !== undefined)
      out.status =
        toEnum("tasks", patch.status) || String(patch.status).replace(" ", "_");
    if (patch.proofFileId !== undefined)
      out.proofFileId = patch.proofFileId ? Number(patch.proofFileId) : null;
    if (patch.bastFileId !== undefined)
      out.bastFileId = patch.bastFileId ? Number(patch.bastFileId) : null;
    if (patch.fileId !== undefined && patch.proofFileId === undefined)
      out.proofFileId = patch.fileId ? Number(patch.fileId) : null;
  } else if (module === "po-client") {
    if (patch.customer !== undefined) {
      out.customerId =
        patch.customer && patch.customer !== "-"
          ? findId(db?.customers, patch.customer)
          : null;
    }
    if (patch.supplier !== undefined) {
      out.supplierId =
        patch.supplier && patch.supplier !== "-"
          ? findId(db?.suppliers, patch.supplier)
          : null;
    }
    if (patch.penawaran !== undefined) {
      out.quotationId =
        patch.penawaran && patch.penawaran !== "-"
          ? findId(db?.quotations, patch.penawaran)
          : null;
    }
    if (patch.quotationId !== undefined)
      out.quotationId = patch.quotationId ? Number(patch.quotationId) : null;
    if (patch.leadId !== undefined)
      out.leadId = patch.leadId ? Number(patch.leadId) : null;
    if (patch.lead !== undefined)
      out.leadId =
        patch.lead && patch.lead !== "-" ? findId(db?.leads, patch.lead) : null;
    if (patch.projectId !== undefined)
      out.projectId = patch.projectId ? Number(patch.projectId) : null;
    if (patch.project !== undefined)
      out.projectId =
        patch.project && patch.project !== "-"
          ? findId(db?.projects, patch.project)
          : null;
    if (patch.nilai !== undefined) out.amount = num(patch.nilai);
    if (patch.nomorSo !== undefined) out.soNumber = patch.nomorSo;
    if (patch.nomorPoClient !== undefined) {
      out.poClientNumber = patch.nomorPoClient;
      out.number = patch.nomorPoClient;
    }
    if (patch.items !== undefined) out.items = patch.items;
  } else if (module === "supplier-pos") {
    if (patch.nomorSoSupplier !== undefined)
      out.supplierSoNumber = patch.nomorSoSupplier;
    const poStatusList = [
      "MENUNGGU_PERSETUJUAN",
      "DISETUJUI",
      "DITOLAK",
      "DIBATALKAN",
    ];
    const shipStatusList = [
      "DI_SUPPLIER",
      "DIKIRIM",
      "SAMPAI",
      "BELUM_DIKIRIM",
      "DALAM_PERJALANAN",
    ];
    if (patch.status !== undefined) {
      const mapped = toEnum("supplier-pos", patch.status) || patch.status;
      if (poStatusList.includes(mapped)) {
        out.status = mapped;
      } else if (shipStatusList.includes(mapped)) {
        out.shipmentStatus =
          mapped === "BELUM_DIKIRIM"
            ? "DI_SUPPLIER"
            : mapped === "DALAM_PERJALANAN"
              ? "DIKIRIM"
              : mapped;
      }
    }
    if (patch.pengiriman !== undefined || patch.shipmentStatus !== undefined) {
      const shipVal = patch.pengiriman ?? patch.shipmentStatus;
      const mappedShip = toEnum("supplier-pos", shipVal) || shipVal;
      out.shipmentStatus =
        mappedShip === "BELUM_DIKIRIM"
          ? "DI_SUPPLIER"
          : mappedShip === "DALAM_PERJALANAN"
            ? "DIKIRIM"
            : mappedShip;
    }
  } else if (module === "invoices") {
    if (patch.customer !== undefined)
      out.customerId = findId(db?.customers, patch.customer);
    if (patch.po !== undefined) {
      out.clientPoId =
        patch.po && patch.po !== "-"
          ? findId(db?.["po-client"], patch.po)
          : null;
    }
    if (patch.clientPoId !== undefined)
      out.clientPoId = patch.clientPoId ? Number(patch.clientPoId) : null;
    if (patch.penawaran !== undefined || patch.quotation !== undefined) {
      const qVal = patch.penawaran ?? patch.quotation;
      out.quotationId =
        qVal && qVal !== "-" ? findId(db?.quotations, qVal) : null;
    }
    if (patch.quotationId !== undefined)
      out.quotationId = patch.quotationId ? Number(patch.quotationId) : null;
    if (patch.project !== undefined) {
      out.projectId =
        patch.project && patch.project !== "-"
          ? findId(db?.projects, patch.project)
          : null;
    }
    if (patch.projectId !== undefined)
      out.projectId = patch.projectId ? Number(patch.projectId) : null;
    if (patch.nilai !== undefined) out.amount = num(patch.nilai);
    if (patch.ppn !== undefined) out.ppn = num(patch.ppn);
    if (patch.pph !== undefined) out.pph = num(patch.pph);
    if (patch.pphMode !== undefined) out.pphMode = patch.pphMode;
    if (patch.tipePph !== undefined) out.tipePph = patch.tipePph;
    if (patch.total !== undefined) out.total = num(patch.total);
    if (patch.jatuhTempo !== undefined) out.dueDate = patch.jatuhTempo;
    if (patch.jenis !== undefined) {
      const mapped = toEnum("invoiceType", patch.jenis);
      out.type =
        mapped === "DP" || mapped === "TERMIN" || mapped === "PELUNASAN"
          ? mapped
          : /penuh|lunas/i.test(String(patch.jenis))
            ? "PELUNASAN"
            : "TERMIN";
    }
    if (patch.status !== undefined)
      out.status = toEnum("invoices", patch.status) || patch.status;
    if (patch.items !== undefined) out.items = patch.items;
    if (patch.subject !== undefined) out.subject = patch.subject;
    if (patch.intro !== undefined) out.intro = patch.intro;
    if (patch.notesList !== undefined) out.notesList = patch.notesList;
    if (patch.city !== undefined) out.city = patch.city;
    if (patch.kopText !== undefined) out.kopText = patch.kopText;
    if (patch.kopLogoUrl !== undefined) out.kopLogoUrl = patch.kopLogoUrl;
    if (patch.customerAddress !== undefined)
      out.customerAddress = patch.customerAddress;
    if (patch.signerName !== undefined) out.signerName = patch.signerName;
    if (patch.signerTitle !== undefined) out.signerTitle = patch.signerTitle;
    if (patch.dpLabel !== undefined) out.dpLabel = patch.dpLabel;
    if (patch.dpAmount !== undefined) out.dpAmount = num(patch.dpAmount);
  } else if (module === "invoiceIn") {
    if (patch.nilai !== undefined) out.amount = num(patch.nilai);
    if (patch.amount !== undefined) out.amount = num(patch.amount);
    if (patch.ppn !== undefined) out.ppn = num(patch.ppn);
    if (patch.pph !== undefined) out.pph = num(patch.pph);
    if (patch.total !== undefined) out.total = num(patch.total);
    if (patch.jatuhTempo !== undefined) out.dueDate = patch.jatuhTempo;
    if (patch.supplier !== undefined) {
      out.supplierName = String(patch.supplier).trim();
      const foundSupp = findId(db?.suppliers, patch.supplier);
      if (foundSupp !== undefined) out.supplierId = foundSupp;
    }
    if (patch.supplierId !== undefined)
      out.supplierId = patch.supplierId ? Number(patch.supplierId) : undefined;
    if (patch.supplierPoId !== undefined)
      out.supplierPoId = patch.supplierPoId
        ? Number(patch.supplierPoId)
        : undefined;
    if (patch.transferFileId !== undefined)
      out.transferFileId = patch.transferFileId
        ? Number(patch.transferFileId)
        : undefined;
    if (patch.paymentFileId !== undefined)
      out.paymentFileId = patch.paymentFileId
        ? Number(patch.paymentFileId)
        : undefined;
  } else if (module === "delivery-notes") {
    if (patch.status !== undefined) {
      out.status = toEnum("delivery-notes", patch.status) || patch.status;
    }
    if (patch.locations !== undefined) {
      out.locations = patch.locations;
    } else if (
      patch.tujuan !== undefined ||
      patch.alasan !== undefined ||
      patch.projectId !== undefined ||
      patch.project !== undefined
    ) {
      out.locations = [
        {
          destination: patch.tujuan || "-",
          reason: patch.alasan || "Dinas luar",
          projectId:
            patch.projectId != null
              ? Number(patch.projectId)
              : findId(db?.projects, patch.project),
        },
      ];
    }
    if (patch.items !== undefined && Array.isArray(patch.items)) {
      out.items = patch.items.map((i: any) => ({
        productId: Number(i.productId || i.product?.id),
        qty: Number(i.qty) || 1,
        serials: Array.isArray(i.serials)
          ? i.serials.join(", ")
          : i.serials
            ? String(i.serials)
            : undefined,
        note: i.note ? String(i.note) : undefined,
      }));
    }
    if (patch.withGoods !== undefined) {
      out.withGoods = patch.withGoods === true || patch.withGoods === "true";
    }
    // Tanda terima lapangan: simpan juga ke kolom penerima (dipakai cetak surat jalan)
    if (patch.penerimaNama !== undefined)
      out.recipientName = patch.penerimaNama || null;
    if (patch.penerimaJabatan !== undefined)
      out.recipientTitle = patch.penerimaJabatan || null;
    if (patch.penerimaKontak !== undefined)
      out.recipientPhone = patch.penerimaKontak || null;
    if (
      patch.penerimaNama ||
      patch.catatanSerahTerima ||
      patch.penerimaJabatan ||
      patch.penerimaKontak
    ) {
      out.reportText = [
        patch.penerimaNama ? `Penerima: ${patch.penerimaNama}` : "",
        patch.penerimaJabatan ? `(${patch.penerimaJabatan})` : "",
        patch.penerimaKontak ? `[Kontak: ${patch.penerimaKontak}]` : "",
        patch.catatanSerahTerima ? `- ${patch.catatanSerahTerima}` : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
  } else if (module === "users") {
    if (patch.roleLabel !== undefined || patch.role !== undefined) {
      out.role = roleFromUi(patch.role ?? patch.roleLabel);
    }
    if (patch.gudang !== undefined)
      out.warehouseId = findId(db?.warehouses, patch.gudang);
    if (patch.status !== undefined)
      out.status = toEnum("users", patch.status) || patch.status;
  } else if (module === "damage-reports") {
    if (patch.produk !== undefined)
      out.productId = findId(db?.products, patch.produk);
    const jenisStr = String(patch.jenis || "");
    const isReturSales = /retur\s*penjualan/i.test(jenisStr);
    const isReturPurchase = /retur\s*pembelian/i.test(jenisStr);
    if (patch.jenis !== undefined) {
      out.type =
        isReturSales || isReturPurchase
          ? "RUSAK"
          : toEnum("damageType", patch.jenis) || "RUSAK";
    }
    if (patch.qty !== undefined) out.qty = num(patch.qty);
    if (patch.serialUnitId !== undefined)
      out.serialUnitId = patch.serialUnitId ? Number(patch.serialUnitId) : null;
    else if (patch.sn !== undefined) {
      const snClean = (String(patch.sn).split(" (")[0] ?? "").trim();
      const matchedSn = snClean
        ? (db?.serials ?? []).find(
            (s: any) =>
              String(s.sn || "")
                .trim()
                .toLowerCase() === snClean.toLowerCase(),
          )
        : null;
      if (matchedSn?.id != null) out.serialUnitId = Number(matchedSn.id);
    }
    // Jenis & PO asal disimpan di kolom sendiri (dulu tag "[RETUR-..]" / "[PO: ..]" di deskripsi).
    if (patch.jenis !== undefined) {
      out.category = isReturSales
        ? "RETUR_PENJUALAN"
        : isReturPurchase
          ? "RETUR_PEMBELIAN"
          : "KERUSAKAN";
    }
    if (patch.supplierPoId !== undefined) {
      out.supplierPoId = patch.supplierPoId ? Number(patch.supplierPoId) : null;
    } else if (patch.po !== undefined) {
      const p =
        patch.po && patch.po !== "-"
          ? (String(patch.po).split(" - ")[0] ?? "").trim()
          : "";
      const po = p
        ? (db?.["supplier-pos"] ?? []).find(
            (x: any) => String(x.nomor || "").toLowerCase() === p.toLowerCase(),
          )
        : null;
      out.supplierPoId = po?.id != null ? Number(po.id) : null;
    }
    if (patch.keterangan !== undefined)
      out.description = patch.keterangan || "-";
    delete out.po;
    delete out.sn;
    delete out.keterangan;
  } else if (
    [
      "customers",
      "suppliers",
      "products",
      "productCategories",
      "warehouses",
      "leadSources",
      "lostReasons",
      "expenseCategories",
      "costCenters",
      "dealTypes",
    ].includes(module)
  ) {
    if (patch.status !== undefined)
      out.status = toEnum("users", patch.status) || patch.status;
    if (module === "suppliers") {
      if (patch.taxStatus !== undefined) out.taxStatus = patch.taxStatus;
      if (patch.jenisUsaha !== undefined)
        out.taxStatus = patch.jenisUsaha === "PKP" ? "PKP" : "NON_PKP";
      if (patch.tags !== undefined) out.tags = patch.tags;
      else if (patch.tagInput !== undefined)
        out.tags = parseTagInput(patch.tagInput);
    }
    if (module === "products") {
      if (patch.hargaBeli !== undefined)
        out.purchasePrice = num(patch.hargaBeli);
      delete out.hargaBeli;
      delete out.nama;
      delete out.kategori;
      delete out.merk;
      delete out.satuan;
      delete out.berSN;
      delete out.min;
      delete out.deskripsi;
      delete out.keterangan;
      delete out.tipeSN;
      delete out.jenisItem;
      delete out.garansi;
      if (patch.kategori !== undefined)
        out.categoryId = findId(db?.productCategories, patch.kategori);
      if (patch.jenisItem !== undefined || patch.type !== undefined) {
        const isJasa = String(patch.type || patch.jenisItem || "")
          .toUpperCase()
          .includes("JASA");
        out.type = isJasa ? "JASA" : "BARANG";
        if (isJasa) out.hasSerial = false;
      }
    }
  } else if (module === "purchase-requests") {
    if (patch.jenisBiaya !== undefined || patch.costType !== undefined) {
      out.costType = String(
        toEnum("costType", patch.costType || patch.jenisBiaya) ||
          patch.costType ||
          patch.jenisBiaya ||
          "STOK",
      ).toUpperCase();
    }
    if (patch.project !== undefined)
      out.projectId = findId(db?.projects, patch.project);
    if (patch.supplier !== undefined)
      out.supplierId = findId(db?.suppliers, patch.supplier);
    if (patch.status !== undefined)
      out.status = toEnum("purchase-requests", patch.status) || patch.status;
    if (patch.doFileId !== undefined)
      out.doFileId = patch.doFileId ? Number(patch.doFileId) : null;
    if (patch.paymentProofFileId !== undefined)
      out.paymentProofFileId = patch.paymentProofFileId
        ? Number(patch.paymentProofFileId)
        : null;
    if (patch.fundingSource !== undefined)
      out.fundingSource = patch.fundingSource;
    if (patch.paymentStatus !== undefined)
      out.paymentStatus = patch.paymentStatus;
    if (patch.jatuhTempo !== undefined || patch.dueDate !== undefined) {
      out.dueDate = patch.jatuhTempo ?? patch.dueDate;
    }
  } else if (module === "receiving") {
    if (patch.status !== undefined)
      out.status = toEnum("receiving", patch.status) || patch.status;
    if (patch.requestId !== undefined)
      out.requestId = patch.requestId ? Number(patch.requestId) : null;
    if (patch.supplierPoId !== undefined)
      out.supplierPoId = patch.supplierPoId ? Number(patch.supplierPoId) : null;
    // Form edit memilih PO / gudang berdasarkan nama/nomor (field "po" & "warehouse"),
    // sedangkan API hanya menerima ID. Dulu nilainya terbuang sehingga pilihan tidak tersimpan.
    else if (patch.po !== undefined) {
      const poId = findId(db?.["supplier-pos"], patch.po);
      if (poId) out.supplierPoId = poId;
    }
    if (patch.warehouseId !== undefined)
      out.warehouseId = patch.warehouseId ? Number(patch.warehouseId) : null;
    else if (patch.warehouse !== undefined || patch.gudang !== undefined) {
      const whId = findId(db?.warehouses, patch.warehouse ?? patch.gudang);
      if (whId) out.warehouseId = whId;
    }
    if (patch.items !== undefined && Array.isArray(patch.items)) {
      out.items = patch.items.map((i: any) => ({
        productId: Number(i.productId),
        qtyReceived: Number(i.qtyReceived ?? i.qty ?? 1),
        serials: Array.isArray(i.serials)
          ? i.serials.join(",")
          : i.serials
            ? String(i.serials)
            : undefined,
        note: i.note,
      }));
    }
  } else if (module === "supplier-pos") {
    if (patch.requestId !== undefined)
      out.requestId = patch.requestId ? Number(patch.requestId) : null;
    if (patch.projectId !== undefined)
      out.projectId = patch.projectId ? Number(patch.projectId) : null;
    if (
      patch.supplierId !== undefined &&
      patch.supplierId !== "" &&
      patch.supplierId !== null
    ) {
      out.supplierId = Number(patch.supplierId);
    } else if (patch.supplier !== undefined) {
      out.supplierId = findId(db?.suppliers, patch.supplier);
    }
    if (patch.total !== undefined) out.total = num(patch.total);
    if (patch.eta !== undefined)
      out.eta = patch.eta ? new Date(patch.eta).toISOString() : undefined;
    if (patch.item !== undefined) {
      const cleanItem = String(patch.item || "")
        .replace(/\s*x\s*\d+.*$/, "")
        .trim()
        .toLowerCase();
      const prod = (db?.products ?? []).find(
        (p: any) =>
          String(p.nama || p.name || "")
            .trim()
            .toLowerCase() === cleanItem ||
          String(p.sku || "")
            .trim()
            .toLowerCase() === cleanItem,
      );
      if (prod) {
        out.items = [
          {
            productId: Number(prod.id),
            qty: 1,
            price:
              num(patch.total) ||
              Number(prod.purchasePrice || prod.hargaBeli || 0),
          },
        ];
      }
    }
    if (patch.items !== undefined && Array.isArray(patch.items)) {
      out.items = patch.items;
    }
  } else if (module === "poc-reports") {
    if (
      patch.type !== undefined ||
      patch.tipe !== undefined ||
      patch.tipeLabel !== undefined
    ) {
      const rawType = String(
        patch.type || patch.tipe || patch.tipeLabel || "",
      ).trim();
      if (rawType === "EXPO_EXHIBITION" || /pameran|expo/i.test(rawType)) {
        out.type = "EXPO_EXHIBITION";
      } else if (rawType === "INTERNAL_POC" || /internal/i.test(rawType)) {
        out.type = "INTERNAL_POC";
      } else if (
        rawType === "DEMO_CLIENT" ||
        /klien|client|demo/i.test(rawType)
      ) {
        out.type = "DEMO_CLIENT";
      }
    }
    if (patch.title !== undefined || patch.judul !== undefined)
      out.title = patch.title || patch.judul;
    if (patch.description !== undefined || patch.deskripsi !== undefined)
      out.description = patch.description ?? patch.deskripsi;
    if (patch.date !== undefined || patch.tanggal !== undefined)
      out.date = patch.date || patch.tanggal;
    if (patch.endDate !== undefined || patch.tanggalSelesai !== undefined)
      out.endDate = patch.endDate ?? patch.tanggalSelesai;
    if (patch.location !== undefined || patch.lokasi !== undefined)
      out.location = patch.location ?? patch.lokasi;
    if (patch.clientName !== undefined || patch.klien !== undefined)
      out.clientName = patch.clientName ?? patch.klien;
    if (patch.budget !== undefined || patch.anggaran !== undefined)
      out.budget = num(patch.budget ?? patch.anggaran);
    if (patch.project !== undefined)
      out.projectId = findId(db?.projects, patch.project);
    if (patch.customer !== undefined)
      out.customerId = findId(db?.customers, patch.customer);
    if (patch.lead !== undefined) {
      out.leadId =
        patch.lead === "-" || !patch.lead
          ? null
          : findId(db?.leads, patch.lead) || null;
    }
    if (patch.leadId !== undefined)
      out.leadId = patch.leadId ? Number(patch.leadId) : null;
    if (patch.tim !== undefined)
      out.memberUserIds = resolveMemberIds(patch, db);
  } else if (module === "visit-reports") {
    if (patch.title !== undefined || patch.judul !== undefined)
      out.title = patch.title || patch.judul;
    if (patch.tipe !== undefined || patch.activityType !== undefined) {
      const actId = findId(
        db?.["visit-activity-types"],
        patch.tipe || patch.activityType,
      );
      if (actId) out.activityTypeId = actId;
      out.activityTypeName = patch.tipe || patch.activityType;
    }
    if (patch.activityTypeId !== undefined)
      out.activityTypeId = patch.activityTypeId
        ? Number(patch.activityTypeId)
        : null;
    if (patch.date !== undefined || patch.tanggal !== undefined)
      out.date = patch.date || patch.tanggal;
    if (patch.endDate !== undefined || patch.tanggalSelesai !== undefined)
      out.endDate = patch.endDate ?? patch.tanggalSelesai;
    if (patch.location !== undefined || patch.lokasi !== undefined)
      out.location = patch.location ?? patch.lokasi;
    if (patch.clientName !== undefined || patch.klien !== undefined)
      out.clientName = patch.clientName ?? patch.klien;
    if (patch.clientContact !== undefined || patch.kontakKlien !== undefined)
      out.clientContact = patch.clientContact ?? patch.kontakKlien;
    if (patch.purpose !== undefined || patch.tujuan !== undefined)
      out.purpose = patch.purpose ?? patch.tujuan;
    if (patch.description !== undefined || patch.deskripsi !== undefined)
      out.description = patch.description ?? patch.deskripsi;
    if (patch.summary !== undefined) out.summary = patch.summary;
    if (patch.clientNeeds !== undefined) out.clientNeeds = patch.clientNeeds;
    if (patch.productsIntroduced !== undefined)
      out.productsIntroduced = patch.productsIntroduced;
    if (patch.clientFeedback !== undefined)
      out.clientFeedback = patch.clientFeedback;
    if (patch.agreements !== undefined) out.agreements = patch.agreements;
    if (patch.potentialOpportunities !== undefined)
      out.potentialOpportunities = patch.potentialOpportunities;
    if (patch.obstacles !== undefined) out.obstacles = patch.obstacles;
    if (patch.conclusion !== undefined) out.conclusion = patch.conclusion;
    if (patch.companyHeader !== undefined)
      out.companyHeader = patch.companyHeader;
    if (patch.logoFileId !== undefined)
      out.logoFileId = patch.logoFileId ? Number(patch.logoFileId) : null;
    if (patch.project !== undefined)
      out.projectId = findId(db?.projects, patch.project);
    if (patch.customer !== undefined)
      out.customerId = findId(db?.customers, patch.customer);
    if (patch.lead !== undefined) {
      out.leadId =
        patch.lead === "-" || !patch.lead
          ? null
          : findId(db?.leads, patch.lead) || null;
    }
    if (patch.leadId !== undefined)
      out.leadId = patch.leadId ? Number(patch.leadId) : null;
    if (patch.tim !== undefined)
      out.memberUserIds = resolveMemberIds(patch, db);
  } else if (module === "maintenance-reports") {
    if (patch.title !== undefined || patch.judul !== undefined)
      out.title = patch.title || patch.judul;
    if (patch.tipe !== undefined || patch.maintenanceType !== undefined)
      out.maintenanceType = patch.tipe || patch.maintenanceType;
    if (
      patch.date !== undefined ||
      patch.tanggal !== undefined ||
      patch.startDate !== undefined
    )
      out.startDate = patch.startDate || patch.date || patch.tanggal;
    if (patch.endDate !== undefined || patch.tanggalSelesai !== undefined)
      out.endDate = patch.endDate ?? patch.tanggalSelesai;
    if (patch.location !== undefined || patch.lokasi !== undefined)
      out.location = patch.location ?? patch.lokasi;
    if (patch.clientName !== undefined || patch.klien !== undefined)
      out.clientName = patch.clientName ?? patch.klien;
    if (patch.clientContact !== undefined || patch.kontakKlien !== undefined)
      out.clientContact = patch.clientContact ?? patch.kontakKlien;
    if (patch.purpose !== undefined || patch.tujuan !== undefined)
      out.purpose = patch.purpose ?? patch.tujuan;
    if (patch.description !== undefined || patch.deskripsi !== undefined)
      out.description = patch.description ?? patch.deskripsi;
    if (patch.findings !== undefined) out.findings = patch.findings;
    if (patch.actionsTaken !== undefined) out.actionsTaken = patch.actionsTaken;
    if (patch.recommendations !== undefined)
      out.recommendations = patch.recommendations;
    if (patch.conclusion !== undefined) out.conclusion = patch.conclusion;
    if (patch.companyHeader !== undefined)
      out.companyHeader = patch.companyHeader;
    if (patch.logoFileId !== undefined)
      out.logoFileId = patch.logoFileId ? Number(patch.logoFileId) : null;
    if (patch.project !== undefined)
      out.projectId = findId(db?.projects, patch.project);
    if (patch.customer !== undefined)
      out.customerId = findId(db?.customers, patch.customer);
    if (patch.lead !== undefined) {
      out.leadId =
        patch.lead === "-" || !patch.lead
          ? null
          : findId(db?.leads, patch.lead) || null;
    }
    if (patch.leadId !== undefined)
      out.leadId = patch.leadId ? Number(patch.leadId) : null;
    if (patch.tim !== undefined)
      out.memberUserIds = resolveMemberIds(patch, db);
  }

  return forPatch(module, out);
}

/** Modul yang DTO status-nya memakai `reason`, bukan `note`. */
