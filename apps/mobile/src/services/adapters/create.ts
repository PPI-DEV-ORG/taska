import { findId, parseTagInput, resolveMemberIds } from "./db-helpers";
import { roleFromUi } from "./roles";
import { toEnum } from "./status-maps";

export function buildCreateBody(
  module: string,
  row: Record<string, any>,
  db?: Record<string, any>,
): Record<string, any> {
  const num = (v: any) => Number(String(v ?? 0).replace(/[^\d.-]/g, "")) || 0;
  const today = new Date().toISOString().slice(0, 10);
  switch (module) {
    case "leads": {
      const jenis = (row.jenisTransaksi || "Proyek (Instalasi & Jasa)").trim();
      const tag = `[JENIS:${jenis}] `;
      const baseNeed = row.need || row.catatan || "";
      const cleanedBase = baseNeed.replace(/\[JENIS:[^\]]+\]\s*/gi, "");
      const fullNeed = `${tag}${cleanedBase}`.trim();

      return {
        name: row.nama ?? row.name ?? "Lead Baru",
        customerId:
          row.customerId != null && row.customerId !== ""
            ? Number(row.customerId)
            : findId(db?.customers, row.perusahaan ?? row.customer),
        sourceId:
          row.sourceId != null && row.sourceId !== ""
            ? Number(row.sourceId)
            : findId(db?.leadSources, row.sumber),
        clientType: row.tipe
          ? toEnum("clientType", row.tipe) || "END_USER"
          : "END_USER",
        estimatedValue: num(row.nilai ?? row.estimatedValue),
        probability: num(row.peluang ?? row.probability) || 20,
        targetClosing: row.closing || row.targetClosing || undefined,
        contactName: row.kontak && row.kontak !== "-" ? row.kontak : undefined,
        need: fullNeed || undefined,
        ownerId:
          row.ownerId != null && row.ownerId !== ""
            ? Number(row.ownerId)
            : findId(db?.users, row.pemilik),
        stage: row.status
          ? toEnum("leads", row.status) || "PROSPECTING"
          : "PROSPECTING",
        fileId:
          row.fileId != null && row.fileId !== ""
            ? Number(row.fileId)
            : undefined,
      };
    }
    case "quotations": {
      const tot = num(row.total ?? row.nilai);
      const disc = num(row.disc ?? row.discount);
      const net = Math.max(0, tot - disc);
      const tipe = String(row.tipePpn || "");
      let ppn: number;
      let grand: number;
      if (
        tipe.toLowerCase().includes("no") ||
        tipe.toLowerCase().includes("tanpa")
      ) {
        ppn = 0;
        grand = net;
      } else if (tipe.toLowerCase().includes("include")) {
        ppn = Math.round(net - net / 1.11);
        grand = net;
      } else {
        ppn = row.ppn != null ? num(row.ppn) : Math.round(net * 0.11);
        grand = net + ppn;
      }
      // grandTotal = DPP + PPN (nilai penawaran). PPh disimpan terpisah: dipotong customer saat membayar.
      const pph = row.pph != null ? num(row.pph) : 0;
      return {
        leadId:
          row.leadId != null && row.leadId !== ""
            ? Number(row.leadId)
            : (findId(db?.leads, row.lead) ?? null),
        customerId:
          row.customerId != null && row.customerId !== ""
            ? Number(row.customerId)
            : findId(db?.customers, row.customer ?? row.perusahaan),
        total: tot,
        ppn,
        pph,
        pphMode: row.pphMode || "none",
        tipePph: row.tipePph || "Tanpa PPh",
        discount: disc,
        grandTotal: grand,
        validUntil: row.berlaku || row.validUntil || undefined,
        fileId: row.fileId ? Number(row.fileId) : undefined,
        notes: row.notes ?? row.catatan ?? undefined,
        status: row.status
          ? toEnum("quotations", row.status) || "DRAFT"
          : "DRAFT",
        items: Array.isArray(row.items) ? row.items : undefined,
        subject: row.subject || undefined,
        intro: row.intro || undefined,
        notesList: Array.isArray(row.notesList) ? row.notesList : undefined,
        city: row.city || undefined,
        kopText: row.kopText || undefined,
        customerAddress: row.customerAddress || undefined,
        signerName: row.signerName || undefined,
        signerTitle: row.signerTitle || undefined,
      };
    }
    case "surveys": {
      const leadId =
        row.leadId != null && row.leadId !== ""
          ? Number(row.leadId)
          : (findId(db?.leads, row.lead) ?? undefined);
      return {
        leadId,
        location: row.lokasi || row.location || "-",
        scheduleAt: row.jadwal || row.scheduleAt || today,
        need: row.need || row.lead || undefined,
        notes: row.catatanTeknis || row.catatan || row.notes || undefined,
        cost: row.biaya != null ? num(row.biaya) : undefined,
        memberIds: resolveMemberIds(row, db),
      };
    }
    case "customers":
      return {
        name: row.nama ?? row.name,
        city: row.kota ?? row.city ?? undefined,
        pic: row.kontak ?? row.pic ?? "-",
        email: row.email && row.email !== "-" ? row.email : undefined,
        phone: row.telepon || row.phone || undefined,
        notes: row.catatan && row.catatan !== "-" ? row.catatan : undefined,
        status: "AKTIF",
      };
    case "suppliers":
      return {
        name: row.nama ?? row.name,
        city: row.kota ?? row.city ?? undefined,
        pic: row.kontak || row.pic || undefined,
        email: row.email || undefined,
        phone: row.telepon || row.phone || undefined,
        paymentTerms: row.payment || row.paymentTerms || undefined,
        notes: row.catatan || row.notes || undefined,
        status: "AKTIF",
        taxStatus:
          row.taxStatus || (row.jenisUsaha === "PKP" ? "PKP" : "NON_PKP"),
        tags:
          Array.isArray(row.tags) && row.tags.length
            ? row.tags
            : row.tagInput
              ? parseTagInput(row.tagInput)
              : undefined,
      };
    case "users":
      return {
        name: row.name ?? row.nama,
        email: row.email,
        password: row.password || "taska123",
        role: roleFromUi(row.role ?? row.roleLabel),
        phone: row.phone || row.telepon || undefined,
        position: row.position || row.jabatan || undefined,
        department: row.department || row.divisi || undefined,
        warehouseId:
          row.warehouseId != null && row.warehouseId !== ""
            ? Number(row.warehouseId)
            : findId(db?.warehouses, row.gudang),
        status: "AKTIF",
      };
    case "projects": {
      const allowedTypes = [
        "CUSTOMER",
        "PRODUCT_RD",
        "INTERNAL",
        "MAINTENANCE",
        "SUPPORT",
        "OTHER",
      ];
      const rawType = row.jenis ?? row.type;
      const mappedType = toEnum("projectType", rawType);
      const safeType = allowedTypes.includes(mappedType)
        ? mappedType
        : "CUSTOMER";

      let leadObj: any = null;
      if (row.leadId) {
        leadObj = (db?.leads ?? []).find(
          (l: any) => Number(l.id) === Number(row.leadId),
        );
      } else if (row.lead && row.lead !== "-") {
        const leadName = (String(row.lead).split(" · ")[0] ?? "")
          .trim()
          .toLowerCase();
        leadObj = (db?.leads ?? []).find(
          (l: any) =>
            l.nama?.toLowerCase() === leadName ||
            l.name?.toLowerCase() === leadName,
        );
      }

      const qObj = leadObj
        ? (db?.quotations ?? []).find(
            (q: any) =>
              (q.leadId && String(q.leadId) === String(leadObj.id)) ||
              (q.lead && q.lead.toLowerCase() === leadObj.nama?.toLowerCase()),
          )
        : null;

      const qId =
        row.quotationId != null && row.quotationId !== ""
          ? Number(row.quotationId)
          : qObj?.id
            ? Number(qObj.id)
            : findId(db?.quotations, row.penawaran);

      const custId =
        row.customerId != null && row.customerId !== ""
          ? Number(row.customerId)
          : leadObj?.customerId
            ? Number(leadObj.customerId)
            : (findId(db?.customers, row.customer ?? row.perusahaan) ??
              (qObj?.customerId != null ? Number(qObj.customerId) : undefined));
      const custObj = db?.customers?.find(
        (c: any) =>
          c.id === custId || c.nama === (row.customer ?? row.perusahaan),
      );
      const custName =
        custObj?.nama ||
        row.customer ||
        row.perusahaan ||
        leadObj?.perusahaan ||
        leadObj?.customer ||
        "Customer";
      const rawProjName = row.nama ?? row.name;
      const projName =
        rawProjName && !String(rawProjName).includes("undefined")
          ? rawProjName
          : `Project ${custName}`;

      return {
        name: projName,
        type: safeType,
        customerId: custId,
        quotationId: qId ?? undefined,
        startDate: row.mulai || row.startDate || today,
        endDate: row.selesai || row.endDate || undefined,
        status: "BERJALAN",
        progress: num(row.progres ?? row.progress),
        picId:
          row.pmId != null && row.pmId !== ""
            ? Number(row.pmId)
            : findId(db?.users, row.pm),
        prdFileId:
          row.prdFileId != null && row.prdFileId !== ""
            ? Number(row.prdFileId)
            : row.fileId
              ? Number(row.fileId)
              : undefined,
        bahpFileId:
          row.bahpFileId != null && row.bahpFileId !== ""
            ? Number(row.bahpFileId)
            : undefined,
        bastFileId:
          row.bastFileId != null && row.bastFileId !== ""
            ? Number(row.bastFileId)
            : undefined,
        doFileId:
          row.doFileId != null && row.doFileId !== ""
            ? Number(row.doFileId)
            : undefined,
        boqFileId:
          row.boqFileId != null && row.boqFileId !== ""
            ? Number(row.boqFileId)
            : undefined,
        memberIds: resolveMemberIds(row, db),
      };
    }
    case "tasks":
      return {
        name: row.nama ?? row.name ?? "Tugas Baru",
        description: row.deskripsi || row.description || undefined,
        parentId:
          row.parentId != null && row.parentId !== ""
            ? Number(row.parentId)
            : undefined,
        assigneeId:
          row.assigneeId != null && row.assigneeId !== ""
            ? Number(row.assigneeId)
            : findId(db?.users, row.pic),
        dueDate: row.tenggat || row.dueDate || undefined,
        priority: row.priority || undefined,
        status: row.status
          ? toEnum("tasks", row.status) || row.status.replace(" ", "_")
          : "TODO",
        progress: num(row.progres ?? row.progress),
        needsPurchase: !!(row.perluBarang ?? row.needsPurchase),
      };
    case "po-client": {
      const mode =
        row.docMode ||
        (row.nomorSo &&
        row.nomorSo !== "-" &&
        row.nomorPoClient &&
        row.nomorPoClient !== "-"
          ? "BOTH"
          : row.nomorPoClient && row.nomorPoClient !== "-"
            ? "PO"
            : "SO");
      const numVal =
        row.nomor ||
        (mode === "PO" ? row.nomorPoClient : row.nomorSo) ||
        undefined;
      return {
        number: numVal,
        soNumber:
          mode !== "PO"
            ? row.nomorSo && row.nomorSo !== "-"
              ? row.nomorSo
              : undefined
            : undefined,
        poClientNumber:
          mode !== "SO"
            ? row.nomorPoClient && row.nomorPoClient !== "-"
              ? row.nomorPoClient
              : undefined
            : undefined,
        docMode: mode,
        customerId:
          row.customerId != null &&
          row.customerId !== "" &&
          row.customerId !== "-"
            ? Number(row.customerId)
            : row.customer && row.customer !== "-"
              ? findId(db?.customers, row.customer)
              : undefined,
        supplierId:
          row.supplierId != null &&
          row.supplierId !== "" &&
          row.supplierId !== "-"
            ? Number(row.supplierId)
            : row.supplier && row.supplier !== "-"
              ? findId(db?.suppliers, row.supplier)
              : undefined,
        amount: num(row.nilai ?? row.amount),
        ppn: num(row.ppn),
        tipePpn: row.tipePpn || undefined,
        ppnMode: row.ppnMode || undefined,
        pph: num(row.pph),
        tipePph: row.tipePph || undefined,
        pphMode: row.pphMode || undefined,
        total: num(
          row.total ||
            num(row.nilai ?? row.amount) + num(row.ppn) - num(row.pph),
        ),
        date: row.tanggal || row.date || today,
        quotationId:
          row.quotationId != null &&
          row.quotationId !== "" &&
          row.quotationId !== "-"
            ? Number(row.quotationId)
            : row.penawaran && row.penawaran !== "-"
              ? findId(db?.quotations, row.penawaran)
              : undefined,
        fileId: row.fileId ? Number(row.fileId) : undefined,
        soFileId: row.soFileId ? Number(row.soFileId) : undefined,
        items: Array.isArray(row.items) ? row.items : undefined,
        notes: row.catatan || row.notes || undefined,
        projectId: row.projectId ? Number(row.projectId) : undefined,
        projectName: row.projectName || undefined,
      };
    }
    case "invoices": {
      const amt = num(row.nilai ?? row.amount);
      const ppn = row.ppn != null ? num(row.ppn) : Math.round(amt * 0.11);
      const pph = row.pph != null ? num(row.pph) : 0; // dipotong customer saat membayar
      const tot = num(row.total) || amt + ppn;
      return {
        number: row.nomor || row.number || undefined,
        customerId:
          row.customerId != null && row.customerId !== ""
            ? Number(row.customerId)
            : row.customer &&
                !/walk-?in|pelanggan umum/i.test(String(row.customer))
              ? (findId(db?.customers, row.customer) ?? null)
              : null,
        customer: row.customer || undefined,
        clientPoId:
          row.clientPoId != null && row.clientPoId !== ""
            ? Number(row.clientPoId)
            : findId(db?.["po-client"], row.po),
        projectId:
          row.projectId != null && row.projectId !== ""
            ? Number(row.projectId)
            : findId(db?.projects, row.project),
        leadId:
          row.leadId != null && row.leadId !== ""
            ? Number(row.leadId)
            : undefined,
        type: (() => {
          const mapped = row.jenis
            ? toEnum("invoiceType", row.jenis)
            : "TERMIN";
          if (mapped === "DP" || mapped === "TERMIN" || mapped === "PELUNASAN")
            return mapped;
          if (/penuh|lunas/i.test(String(row.jenis))) return "PELUNASAN";
          return "TERMIN";
        })(),
        amount: amt,
        discount: row.discount != null ? num(row.discount) : undefined,
        ppn,
        pph,
        pphMode: row.pphMode || "none",
        tipePph: row.tipePph || "Tanpa PPh",
        total: tot,
        date: row.tanggal || row.date || today,
        dueDate:
          row.jatuhTempo ||
          row.dueDate ||
          new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        fileId: row.fileId ? Number(row.fileId) : undefined,
        description: row.catatan || row.description || undefined,
        quotationId:
          row.quotationId != null && row.quotationId !== ""
            ? Number(row.quotationId)
            : undefined,
        quotation: row.quotation || undefined,
        items: Array.isArray(row.items) ? row.items : undefined,
        subject: row.subject || undefined,
        intro: row.intro || undefined,
        notesList: Array.isArray(row.notesList) ? row.notesList : undefined,
        city: row.city || undefined,
        kopText: row.kopText || undefined,
        kopLogoUrl: row.kopLogoUrl || undefined,
        customerAddress: row.customerAddress || undefined,
        signerName: row.signerName || undefined,
        signerTitle: row.signerTitle || undefined,
        dpLabel: row.dpLabel || undefined,
        dpAmount: row.dpAmount != null ? num(row.dpAmount) : undefined,
        // Dulu tidak terkirim: mode PPN hilang (invoice include PPN jadi exclude) & invoice pelunasan tidak tertaut ke DP-nya.
        ppnMode:
          row.ppnMode === "include" ||
          row.ppnMode === "exclude" ||
          row.ppnMode === "none"
            ? row.ppnMode
            : undefined,
        tipePpn: row.tipePpn || undefined,
        isContinuation: row.isContinuation ? true : undefined,
        parentInvoiceId:
          row.parentInvoiceId != null && row.parentInvoiceId !== ""
            ? Number(row.parentInvoiceId)
            : undefined,
        isProforma: row.isProforma ? true : undefined,
        status: row.isProforma && row.status === "Terkirim" ? "SENT" : "DRAFT",
      };
    }
    case "purchase-requests":
      return {
        date: row.tanggal || row.date || today,
        costType: String(
          toEnum("costType", row.costType || row.jenisBiaya) ||
            row.costType ||
            row.jenisBiaya ||
            "STOK",
        ).toUpperCase(),
        procurementSource: row.procurementSource
          ? String(row.procurementSource).toUpperCase()
          : "SUPPLIER",
        paymentMethod: row.paymentMethod
          ? String(row.paymentMethod).toUpperCase()
          : "UTANG",
        ppnMode: row.ppnMode || undefined,
        isProjectConsumable:
          row.isProjectConsumable != null
            ? Boolean(row.isProjectConsumable)
            : undefined,
        // Jatuh tempo pilihan pemohon. Dulu tidak ikut terkirim -> server memakai default "tanggal + 1 bulan",
        // sehingga yang terlihat di Finance berbeda dari yang dipilih Procurement.
        dueDate: (() => {
          const v = row.dueDate || row.jatuhTempo;
          return v && v !== "-" && /^\d{4}-\d{2}-\d{2}/.test(String(v))
            ? String(v).slice(0, 10)
            : undefined;
        })(),
        projectId:
          row.projectId != null && row.projectId !== ""
            ? Number(row.projectId)
            : findId(db?.projects, row.project),
        supplierId:
          row.supplierId != null && row.supplierId !== ""
            ? Number(row.supplierId)
            : findId(db?.suppliers, row.supplier),
        purpose:
          row.purpose || row.tujuan || row.item || "Kebutuhan operasional",
        otherNote: row.otherNote || row.catatan || undefined,
        estimatedCost: row.estimasi != null ? num(row.estimasi) : undefined,
        evidenceFileId:
          row.evidenceFileId ?? (row.fileId ? Number(row.fileId) : undefined),
        items:
          Array.isArray(row.items) && row.items.length
            ? row.items.map((i: any) => ({
                productId:
                  i.productId != null ? Number(i.productId) : undefined,
                customName: i.customName || undefined,
                customUnit: i.customUnit || undefined,
                qty: Number(i.qty) || 1,
                unitCost: Number(i.unitCost ?? i.price ?? 0),
                serials: Array.isArray(i.serials)
                  ? i.serials.join(", ")
                  : i.serials
                    ? String(i.serials)
                    : undefined,
                isConsumable:
                  i.isConsumable != null ? Boolean(i.isConsumable) : undefined,
              }))
            : undefined,
      };
    case "supplier-pos": {
      let items =
        Array.isArray(row.items) && row.items.length ? row.items : undefined;
      if (!items && row.item) {
        const cleanItem = String(row.item || "")
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
          items = [
            {
              productId: Number(prod.id),
              qty: Number(row.qty) || 1,
              price:
                num(row.total) ||
                Number(prod.purchasePrice || prod.hargaBeli || 0),
            },
          ];
        }
      }
      return {
        number: row.nomor || row.number || undefined,
        supplierSoNumber:
          row.nomorSoSupplier && row.nomorSoSupplier !== "-"
            ? row.nomorSoSupplier
            : row.supplierSoNumber || undefined,
        supplierId:
          row.supplierId != null && row.supplierId !== ""
            ? Number(row.supplierId)
            : (findId(db?.suppliers, row.supplier) ?? undefined),
        requestId:
          row.requestId != null && row.requestId !== ""
            ? Number(row.requestId)
            : findId(db?.["purchase-requests"], row.request),
        projectId:
          row.projectId != null && row.projectId !== ""
            ? Number(row.projectId)
            : findId(db?.projects, row.project),
        date: row.tanggal || row.date || today,
        eta: row.eta || undefined,
        paymentTerms: row.payment || row.paymentTerms || undefined,
        total: num(row.total),
        ppnMode: row.ppnMode || undefined,
        ppn: row.ppn != null ? num(row.ppn) : undefined,
        dpp: row.dpp != null ? num(row.dpp) : undefined,
        pphMode: row.pphMode || undefined,
        tipePph: row.tipePph || undefined,
        pph: row.pph != null ? num(row.pph) : undefined,
        fileId: row.fileId ? Number(row.fileId) : undefined,
        soFileId: row.soFileId ? Number(row.soFileId) : undefined,
        items,
      };
    }
    case "receiving":
      return {
        supplierPoId:
          row.supplierPoId != null && row.supplierPoId !== ""
            ? Number(row.supplierPoId)
            : row.po && row.po !== "-"
              ? findId(db?.["supplier-pos"], row.po)
              : undefined,
        requestId:
          row.requestId != null && row.requestId !== ""
            ? Number(row.requestId)
            : undefined,
        supplierName:
          row.supplierName ||
          (row.supplier && row.supplier !== "-" ? row.supplier : undefined),
        warehouseId:
          row.warehouseId != null && row.warehouseId !== ""
            ? Number(row.warehouseId)
            : findId(db?.warehouses, row.gudang ?? row.warehouse),
        date: row.tanggal || row.date || today,
        conditionNote: row.conditionNote || row.catatan || undefined,
        status: row.status ? toEnum("receiving", row.status) : undefined,
        receiptFileId:
          row.receiptFileId ??
          (row.photoFileId
            ? undefined
            : row.fileId
              ? Number(row.fileId)
              : undefined),
        photoFileId: row.photoFileId ? Number(row.photoFileId) : undefined,
        items:
          Array.isArray(row.items) && row.items.length
            ? row.items.map((i: any) => ({
                productId: Number(i.productId),
                qtyReceived: Number(i.qtyReceived ?? i.qty ?? 1),
                serials: Array.isArray(i.serials)
                  ? i.serials.join(",")
                  : i.serials
                    ? String(i.serials)
                    : undefined,
                note: i.note,
              }))
            : undefined,
      };
    case "delivery-notes":
      return {
        number: row.nomor || row.number || undefined,
        date: row.tanggal || row.date || today,
        withGoods: row.withGoods ?? !!(row.barang && row.barang !== "-"),
        locations:
          Array.isArray(row.locations) && row.locations.length
            ? row.locations
            : [
                {
                  destination: row.tujuan || "-",
                  reason: row.alasan || "Dinas luar",
                  projectId:
                    row.projectId != null && row.projectId !== ""
                      ? Number(row.projectId)
                      : findId(db?.projects, row.project),
                },
              ],
        items:
          Array.isArray(row.items) && row.items.length
            ? row.items.map((i: any) => ({
                ...i,
                serials: Array.isArray(i.serials)
                  ? i.serials.join(", ")
                  : i.serials
                    ? String(i.serials)
                    : undefined,
              }))
            : undefined,
        reportText:
          row.reportText ||
          (row.barang && row.barang !== "-" ? String(row.barang) : undefined),
        scanFileId:
          row.scanFileId ?? (row.fileId ? Number(row.fileId) : undefined),
        reportFileId: row.reportFileId ? Number(row.reportFileId) : undefined,
        clientPoId:
          (row.clientPoId ?? row.soId)
            ? Number(row.clientPoId ?? row.soId)
            : undefined,
        invoiceId: row.invoiceId ? Number(row.invoiceId) : undefined,
        senderId: row.senderId ? Number(row.senderId) : undefined,
        senderName: row.senderName || undefined,
        vehicleNo: row.vehicleNo || undefined,
        warehouseId: row.warehouseId ? Number(row.warehouseId) : undefined,
        warehouseStaffId: row.warehouseStaffId
          ? Number(row.warehouseStaffId)
          : undefined,
        recipientUserId: row.recipientUserId
          ? Number(row.recipientUserId)
          : undefined,
        recipientName: row.recipientName || undefined,
        recipientTitle: row.recipientTitle || undefined,
        recipientPhone: row.recipientPhone || undefined,
      };
    case "expenses":
      return {
        date: row.tanggal || row.date || today,
        categoryId:
          row.categoryId != null && row.categoryId !== ""
            ? Number(row.categoryId)
            : findId(db?.expenseCategories, row.kategori),
        amount: num(row.nominal ?? row.amount),
        description: row.alasan || row.description || "Pengeluaran operasional",
        projectId:
          row.projectId != null && row.projectId !== "" && row.projectId !== "-"
            ? Number(row.projectId)
            : row.project && row.project !== "-"
              ? findId(db?.projects, row.project)
              : undefined,
        surveyId:
          row.surveyId != null && row.surveyId !== "" && row.surveyId !== "-"
            ? Number(row.surveyId)
            : row.survey && row.survey !== "-"
              ? Number(
                  String(row.survey).match(/#(\d+)/)?.[1] ||
                    findId(db?.surveys, row.survey),
                ) || undefined
              : undefined,
        pocReportId:
          row.pocReportId != null &&
          row.pocReportId !== "" &&
          row.pocReportId !== "-"
            ? Number(row.pocReportId)
            : row.pocReport && row.pocReport !== "-"
              ? Number(
                  String(row.pocReport).match(/#(\d+)/)?.[1] ||
                    (db?.["poc-reports"] ?? []).find(
                      (p: any) =>
                        `POC ${p.nomor || p.number} - ${p.judul || p.title}` ===
                          row.pocReport ||
                        p.nomor === row.pocReport ||
                        p.number === row.pocReport ||
                        p.judul === row.pocReport,
                    )?.id ||
                    findId(db?.["poc-reports"], row.pocReport),
                ) || undefined
              : undefined,
        visitReportId:
          row.visitReportId != null &&
          row.visitReportId !== "" &&
          row.visitReportId !== "-"
            ? Number(row.visitReportId)
            : row.visitReport && row.visitReport !== "-"
              ? Number(
                  String(row.visitReport).match(/#(\d+)/)?.[1] ||
                    (db?.["visit-reports"] ?? []).find(
                      (p: any) =>
                        `VISIT ${p.nomor || p.number} - ${p.judul || p.title}` ===
                          row.visitReport ||
                        p.nomor === row.visitReport ||
                        p.number === row.visitReport ||
                        p.judul === row.visitReport,
                    )?.id ||
                    findId(db?.["visit-reports"], row.visitReport),
                ) || undefined
              : undefined,
        maintenanceReportId:
          row.maintenanceReportId != null &&
          row.maintenanceReportId !== "" &&
          row.maintenanceReportId !== "-"
            ? Number(row.maintenanceReportId)
            : row.maintenanceReport && row.maintenanceReport !== "-"
              ? Number(
                  String(row.maintenanceReport).match(/#(\d+)/)?.[1] ||
                    (db?.["maintenance-reports"] ?? []).find(
                      (p: any) =>
                        `MTN ${p.nomor || p.number} - ${p.judul || p.title}` ===
                          row.maintenanceReport ||
                        p.nomor === row.maintenanceReport ||
                        p.number === row.maintenanceReport ||
                        p.judul === row.maintenanceReport,
                    )?.id ||
                    findId(db?.["maintenance-reports"], row.maintenanceReport),
                ) || undefined
              : undefined,
        fundingSource:
          row.fundingSource ||
          (row.sumberDana
            ? String(row.sumberDana).toLowerCase().includes("talangan")
              ? "TALANGAN_PRIBADI"
              : String(row.sumberDana).toLowerCase().includes("petty")
                ? "PETTY_CASH"
                : "PERUSAHAAN"
            : "PERUSAHAAN"),
        reimbursementStatus: row.reimbursementStatus || undefined,
        paymentMethod: row.paymentMethod || undefined,
        approvedAmount:
          row.approvedAmount != null ? num(row.approvedAmount) : undefined,
        paidAmount: row.paidAmount != null ? num(row.paidAmount) : undefined,
        costCenterId:
          row.costCenterId != null && row.costCenterId !== ""
            ? Number(row.costCenterId)
            : findId(db?.costCenters, row.costCenter),
        receiptFileId:
          row.receiptFileId ?? (row.fileId ? Number(row.fileId) : undefined),
        receiptFileIds: Array.isArray(row.receiptFileIds)
          ? row.receiptFileIds.map(Number)
          : undefined,
      };
    case "poc-reports": {
      const rawType = String(
        row.type || row.tipe || row.tipeLabel || "",
      ).trim();
      let typeCode = "DEMO_CLIENT";
      if (rawType === "EXPO_EXHIBITION" || /pameran|expo/i.test(rawType)) {
        typeCode = "EXPO_EXHIBITION";
      } else if (rawType === "INTERNAL_POC" || /internal/i.test(rawType)) {
        typeCode = "INTERNAL_POC";
      } else if (
        rawType === "DEMO_CLIENT" ||
        /klien|client|demo/i.test(rawType)
      ) {
        typeCode = "DEMO_CLIENT";
      }

      const memberIds =
        resolveMemberIds(row, db) ||
        (Array.isArray(row.memberUserIds)
          ? row.memberUserIds.map(Number)
          : Array.isArray(row.members)
            ? row.members
                .map((m: any) => Number(m.userId || m.id || m))
                .filter(Boolean)
            : undefined);

      return {
        title: row.title || row.judul || "POC Report",
        description: row.description || row.deskripsi || undefined,
        type: typeCode,
        date: row.date || row.tanggal || today,
        endDate:
          row.endDate ||
          (row.tanggalSelesai && row.tanggalSelesai !== "-"
            ? row.tanggalSelesai
            : undefined),
        location:
          row.location ||
          (row.lokasi && row.lokasi !== "-" ? row.lokasi : undefined),
        status: row.status || "Draft",
        resultStatus: row.resultStatus || row.hasilStatus || undefined,
        clientName:
          row.clientName ||
          (row.klien && row.klien !== "-" ? row.klien : undefined),
        customerId:
          row.customerId != null && row.customerId !== ""
            ? Number(row.customerId)
            : row.customer && row.customer !== "-"
              ? findId(db?.customers, row.customer)
              : undefined,
        projectId:
          row.projectId != null && row.projectId !== ""
            ? Number(row.projectId)
            : row.project && row.project !== "-"
              ? findId(db?.projects, row.project)
              : undefined,
        leadId:
          row.leadId != null && row.leadId !== ""
            ? Number(row.leadId)
            : row.lead && row.lead !== "-"
              ? findId(db?.leads, row.lead)
              : undefined,
        targetCriteria: row.targetCriteria || undefined,
        productsTested: row.productsTested || undefined,
        budget: num(row.budget ?? row.anggaran ?? 0),
        actualExecutionDate: row.actualExecutionDate || undefined,
        actualAttendees: row.actualAttendees || undefined,
        activitiesDone: row.activitiesDone || undefined,
        testResults: row.testResults || undefined,
        issuesFound: row.issuesFound || undefined,
        followUpNeeded: row.followUpNeeded || undefined,
        conclusion: row.conclusion || undefined,
        recommendations: row.recommendations || undefined,
        companyHeader: row.companyHeader || undefined,
        logoFileId: row.logoFileId ? Number(row.logoFileId) : undefined,
        documentFileId: row.documentFileId
          ? Number(row.documentFileId)
          : undefined,
        memberUserIds: memberIds,
      };
    }
    case "visit-reports": {
      const memberIds =
        resolveMemberIds(row, db) ||
        (Array.isArray(row.memberUserIds)
          ? row.memberUserIds.map(Number)
          : Array.isArray(row.members)
            ? row.members
                .map((m: any) => Number(m.userId || m.id || m))
                .filter(Boolean)
            : undefined);

      const actTypeId =
        row.activityTypeId != null && row.activityTypeId !== ""
          ? Number(row.activityTypeId)
          : findId(db?.["visit-activity-types"], row.tipe || row.activityType);

      return {
        title: row.judul || row.title || "Laporan Kunjungan",
        activityTypeId: actTypeId || undefined,
        activityTypeName: row.tipe || row.activityType || undefined,
        status: row.status || "Planned",
        date: row.date || row.tanggal || today,
        endDate:
          row.endDate ||
          (row.tanggalSelesai && row.tanggalSelesai !== "-"
            ? row.tanggalSelesai
            : undefined),
        location:
          row.location ||
          (row.lokasi && row.lokasi !== "-" ? row.lokasi : undefined),
        clientName:
          row.clientName ||
          (row.klien && row.klien !== "-" ? row.klien : undefined),
        clientContact:
          row.clientContact ||
          (row.kontakKlien && row.kontakKlien !== "-"
            ? row.kontakKlien
            : undefined),
        customerId:
          row.customerId != null && row.customerId !== ""
            ? Number(row.customerId)
            : row.customer && row.customer !== "-"
              ? findId(db?.customers, row.customer)
              : undefined,
        projectId:
          row.projectId != null && row.projectId !== ""
            ? Number(row.projectId)
            : row.project && row.project !== "-"
              ? findId(db?.projects, row.project)
              : undefined,
        leadId:
          row.leadId != null && row.leadId !== ""
            ? Number(row.leadId)
            : row.lead && row.lead !== "-"
              ? findId(db?.leads, row.lead)
              : undefined,
        purpose: row.purpose || row.tujuan || undefined,
        description: row.description || row.deskripsi || undefined,
        summary: row.summary || undefined,
        clientNeeds: row.clientNeeds || undefined,
        productsIntroduced: row.productsIntroduced || undefined,
        clientFeedback: row.clientFeedback || undefined,
        agreements: row.agreements || undefined,
        potentialOpportunities: row.potentialOpportunities || undefined,
        obstacles: row.obstacles || undefined,
        conclusion: row.conclusion || undefined,
        companyHeader: row.companyHeader || undefined,
        logoFileId: row.logoFileId ? Number(row.logoFileId) : undefined,
        documentFileId: row.documentFileId
          ? Number(row.documentFileId)
          : undefined,
        memberUserIds: memberIds,
      };
    }
    case "maintenance-reports": {
      const memberIds =
        resolveMemberIds(row, db) ||
        (Array.isArray(row.memberUserIds)
          ? row.memberUserIds.map(Number)
          : Array.isArray(row.members)
            ? row.members
                .map((m: any) => Number(m.userId || m.id || m))
                .filter(Boolean)
            : undefined);

      return {
        title: row.judul || row.title || "Laporan Maintenance",
        maintenanceType: row.tipe || row.maintenanceType || "Preventive",
        status: row.status || "Scheduled",
        startDate: row.startDate || row.tanggal || today,
        endDate:
          row.endDate ||
          (row.tanggalSelesai && row.tanggalSelesai !== "-"
            ? row.tanggalSelesai
            : undefined),
        location:
          row.location ||
          (row.lokasi && row.lokasi !== "-" ? row.lokasi : undefined),
        clientName:
          row.clientName ||
          (row.klien && row.klien !== "-" ? row.klien : undefined),
        clientContact:
          row.clientContact ||
          (row.kontakKlien && row.kontakKlien !== "-"
            ? row.kontakKlien
            : undefined),
        customerId:
          row.customerId != null && row.customerId !== ""
            ? Number(row.customerId)
            : row.customer && row.customer !== "-"
              ? findId(db?.customers, row.customer)
              : undefined,
        projectId:
          row.projectId != null && row.projectId !== ""
            ? Number(row.projectId)
            : row.project && row.project !== "-"
              ? findId(db?.projects, row.project)
              : undefined,
        leadId:
          row.leadId != null && row.leadId !== ""
            ? Number(row.leadId)
            : row.lead && row.lead !== "-"
              ? findId(db?.leads, row.lead)
              : undefined,
        purpose: row.purpose || row.tujuan || undefined,
        description: row.description || row.deskripsi || undefined,
        findings: row.findings || undefined,
        actionsTaken: row.actionsTaken || undefined,
        recommendations: row.recommendations || undefined,
        conclusion: row.conclusion || undefined,
        companyHeader: row.companyHeader || undefined,
        logoFileId: row.logoFileId ? Number(row.logoFileId) : undefined,
        documentFileId: row.documentFileId
          ? Number(row.documentFileId)
          : undefined,
        memberUserIds: memberIds,
      };
    }
    case "damage-reports": {
      const baseDesc = row.keterangan || row.description || "-";
      const poVal =
        row.po && row.po !== "-"
          ? (String(row.po).split(" - ")[0] ?? "").trim()
          : "";
      const snVal =
        row.sn && row.sn !== "-"
          ? (String(row.sn).split(" (")[0] ?? "").trim()
          : "";
      const matchedSn = snVal
        ? (db?.serials ?? []).find(
            (s: any) =>
              String(s.sn || "")
                .trim()
                .toLowerCase() === snVal.toLowerCase(),
          )
        : null;
      const serialUnitId =
        row.serialUnitId != null && row.serialUnitId !== ""
          ? Number(row.serialUnitId)
          : matchedSn?.id != null
            ? Number(matchedSn.id)
            : undefined;
      const jenisStr = String(row.category || row.jenis || "");
      const isReturSales = /retur[\s_]*penjualan/i.test(jenisStr);
      const isReturPurchase = /retur[\s_]*pembelian/i.test(jenisStr);
      const poMatch = poVal
        ? (db?.["supplier-pos"] ?? []).find(
            (po: any) =>
              String(po.nomor || "").toLowerCase() === poVal.toLowerCase(),
          )
        : null;
      const supplierPoId =
        row.supplierPoId != null && row.supplierPoId !== ""
          ? Number(row.supplierPoId)
          : poMatch?.id != null
            ? Number(poMatch.id)
            : undefined;
      const category = isReturSales
        ? "RETUR_PENJUALAN"
        : isReturPurchase
          ? "RETUR_PEMBELIAN"
          : "KERUSAKAN";
      return {
        date: row.tanggal || row.date || today,
        productId:
          row.productId != null && row.productId !== ""
            ? Number(row.productId)
            : findId(db?.products, row.produk),
        serialUnitId,
        type:
          isReturSales || isReturPurchase
            ? "RUSAK"
            : toEnum("damageType", row.jenis) || "RUSAK",
        qty: num(row.qty) || 1,
        category,
        supplierPoId,
        description: baseDesc,
        fileId: row.fileId ? Number(row.fileId) : undefined,
      };
    }
    case "productCategories":
      return {
        name: row.nama ?? row.name,
        description: row.deskripsi || row.description || undefined,
        prefix: row.prefix || undefined,
        status: "AKTIF",
      };
    case "warehouses":
      return {
        name: row.nama ?? row.name,
        city: row.kota || row.city || undefined,
        status: "AKTIF",
      };
    case "products": {
      const isJasa =
        String(row.type || row.jenisItem || "")
          .toUpperCase()
          .includes("JASA") ||
        String(row.tipeSN || "")
          .toUpperCase()
          .includes("JASA");
      const sellPriceVal = num(row.hargaJual ?? row.price ?? row.sellPrice);
      const hasSerial = isJasa
        ? false
        : row.berSN != null
          ? !!row.berSN
          : !!row.hasSerial;
      const initialStock = isJasa ? 0 : num(row.initialStock);
      const warehouseId =
        row.warehouseId != null && row.warehouseId !== ""
          ? Number(row.warehouseId)
          : findId(db?.warehouses, row.gudang);
      const serialNumbers = Array.isArray(row.serialNumbers)
        ? row.serialNumbers.map((sn: any) => String(sn).trim()).filter(Boolean)
        : typeof row.serialNumbers === "string"
          ? row.serialNumbers
              .split(/[\n,;]+/)
              .map((sn) => sn.trim())
              .filter(Boolean)
          : undefined;
      let desc = row.deskripsi || row.description || "";
      if (sellPriceVal > 0) {
        if (/SELL:[^;]+/i.test(desc)) {
          desc = desc.replace(/SELL:[^;]+/i, `SELL:${sellPriceVal}`);
        } else {
          desc = desc.trim()
            ? `${desc};SELL:${sellPriceVal}`
            : `SELL:${sellPriceVal}`;
        }
      }
      return {
        sku: row.sku,
        name: row.nama ?? row.name,
        type: isJasa ? "JASA" : "BARANG",
        brand: row.merk || row.brand || undefined,
        description: desc || undefined,
        unit: row.satuan ?? row.unit ?? (isJasa ? "Jasa" : "Unit"),
        categoryId:
          row.categoryId != null && row.categoryId !== ""
            ? Number(row.categoryId)
            : findId(db?.productCategories, row.kategori),
        hasSerial,
        minStock: isJasa ? 0 : num(row.min ?? row.minStock),
        warrantyMonths: row.garansi
          ? parseInt(String(row.garansi), 10) || undefined
          : undefined,
        purchasePrice: num(row.hargaBeli ?? row.purchasePrice),
        ...(initialStock > 0
          ? {
              initialStock,
              warehouseId,
              ...(hasSerial ? { serialNumbers: serialNumbers ?? [] } : {}),
            }
          : {}),
        status: "AKTIF",
      };
    }
    case "leadSources":
    case "lostReasons":
    case "expenseCategories":
    case "costCenters":
    case "dealTypes":
      return { name: row.nama ?? row.name, status: "AKTIF" };
    case "followups": {
      const mRaw = String(row.method ?? row.metode ?? "WA").toUpperCase();
      const method =
        mRaw.includes("WA") || mRaw.includes("WHATSAPP")
          ? "WA"
          : mRaw.includes("TEL") || mRaw.includes("CALL")
            ? "TELEPON"
            : mRaw.includes("EMAIL")
              ? "EMAIL"
              : "LAINNYA";
      const nextD = row.nextDate ?? row.nextAction ?? row.berikutnya;
      const validNext =
        nextD && /^\d{4}-\d{2}-\d{2}/.test(String(nextD))
          ? String(nextD).slice(0, 10)
          : undefined;
      return {
        leadId:
          row.leadId != null && row.leadId !== ""
            ? Number(row.leadId)
            : undefined,
        quotationId:
          row.quotationId != null && row.quotationId !== ""
            ? Number(row.quotationId)
            : undefined,
        pocReportId:
          row.pocReportId != null && row.pocReportId !== ""
            ? Number(row.pocReportId)
            : undefined,
        visitReportId:
          row.visitReportId != null && row.visitReportId !== ""
            ? Number(row.visitReportId)
            : undefined,
        maintenanceReportId:
          row.maintenanceReportId != null && row.maintenanceReportId !== ""
            ? Number(row.maintenanceReportId)
            : undefined,
        date: row.date || row.tanggal || today,
        method,
        notes: row.notes || row.catatan || "-",
        nextDate: validNext,
        status: row.status || "SELESAI",
      };
    }
    case "invoiceIn": {
      const amt = num(row.nilai ?? row.amount);
      const ppn = row.ppn != null ? num(row.ppn) : Math.round(amt * 0.11);
      const pph = row.pph != null ? num(row.pph) : 0;
      const tot = num(row.total) || Math.max(0, amt + ppn - pph);
      const suppId =
        row.supplierId != null && row.supplierId !== ""
          ? Number(row.supplierId)
          : (findId(db?.suppliers, row.supplier) ?? undefined);
      const suppName =
        String(row.supplier || row.customer || "").trim() || undefined;
      const poId =
        row.supplierPoId != null && row.supplierPoId !== ""
          ? Number(row.supplierPoId)
          : findId(db?.["supplier-pos"], row.po);
      const dueStr =
        row.jatuhTempo ||
        row.dueDate ||
        new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      return {
        number:
          row.nomor ||
          row.number ||
          `INV-IN-${Date.now().toString().slice(-5)}`,
        supplierId: suppId,
        supplierName: suppName,
        supplierPoId: poId || undefined,
        amount: amt,
        ppn,
        pph,
        pphMode: row.pphMode || undefined,
        tipePph: row.tipePph || undefined,
        total: tot,
        date: row.tanggal || row.date || today,
        dueDate:
          dueStr && /^\d{4}-\d{2}-\d{2}/.test(dueStr)
            ? dueStr
            : new Date().toISOString().slice(0, 10),
        notes: row.catatan || row.notes || undefined,
        category: row.category || row.jenis || undefined,
        debitAccount: row.debitAccount || undefined,
        items:
          Array.isArray(row.items) && row.items.length > 0
            ? row.items
            : undefined,
        fileId: row.fileId ? Number(row.fileId) : undefined,
        transferFileId: row.transferFileId
          ? Number(row.transferFileId)
          : row.paymentFileId
            ? Number(row.paymentFileId)
            : undefined,
        paid: !!row.paid,
        paymentMethod: row.paymentMethod || undefined,
        paymentReference: row.paymentReference || undefined,
        coaAccount: row.coaAccount || undefined,
        paymentFileId: row.paymentFileId
          ? Number(row.paymentFileId)
          : row.transferFileId
            ? Number(row.transferFileId)
            : undefined,
        taxInvoiceFileId: row.taxInvoiceFileId
          ? Number(row.taxInvoiceFileId)
          : undefined,
        taxInvoiceNumber: row.taxInvoiceNumber
          ? String(row.taxInvoiceNumber)
          : undefined,
      };
    }
    default:
      return row;
  }
}

/** Kolom yang boleh dikirim saat PATCH — hindari 400 forbidNonWhitelisted
 *  karena field create-only (status AKTIF, progress 0, stage, dll) ikut terkirim. */
