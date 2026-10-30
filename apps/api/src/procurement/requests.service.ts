import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { StockService } from "../stock/stock.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { RequestDto, RequestListQuery, RequestStatusDto } from "./dto.js";

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly docnum: DocumentNumberService,
    private readonly approvals: ApprovalsService,
    private readonly stock: StockService,
  ) {
    this.approvals.onChange("PURCHASE_REQUEST", (entityId, status) =>
      this.onApproval(entityId, status),
    );
  }

  private async onApproval(entityId: number, status: "MENUNGGU" | "DISETUJUI" | "DITOLAK") {
    const row = await this.prisma.main.purchaseRequest.findUnique({ where: { id: entityId } });
    if (!row) return;
    if (row.status !== "DIAJUKAN" && row.status !== "CEK_STOK") return;
    if (status === "DISETUJUI") {
      await this.prisma.main.purchaseRequest.update({
        where: { id: entityId },
        data: { status: "DISETUJUI" },
      });
    } else if (status === "DITOLAK") {
      await this.prisma.main.purchaseRequest.update({
        where: { id: entityId },
        data: { status: "DITOLAK" },
      });
    }
  }

  private scope(user: RequestUser) {
    if (["SUPER_ADMIN", "ADMIN", "BOS", "FINANCE", "PROCUREMENT", "GUDANG"].includes(user.role)) return {};
    if (user.role === "PM") {
      return {
        OR: [
          { requesterId: user.id },
          { project: { picId: user.id } },
          { project: { members: { some: { userId: user.id } } } },
        ],
      };
    }
    return { requesterId: user.id };
  }

  async list(q: RequestListQuery, user: RequestUser) {
    const where = {
      ...this.scope(user),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.costType ? { costType: q.costType } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.requesterId ? { requesterId: q.requesterId } : {}),
      ...(q.from || q.to
        ? { date: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { purpose: { contains: q.q } },
              { requester: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.purchaseRequest.findMany({
        where,
        include: {
          requester: { select: { id: true, name: true, role: true } },
          project: { select: { id: true, name: true } },
          task: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true } } } },
          _count: { select: { supplierPOs: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "createdAt"], "createdAt"),
        ...pageSkip(q),
      }),
      this.prisma.main.purchaseRequest.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async get(id: number, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, name: true, picId: true } },
        task: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
        supplierPOs: { select: { id: true, number: true, status: true, total: true } },
      },
    });
    if (!row) throw new NotFoundException("Request tidak ditemukan");
    const [approval, evidenceFile, doFile, paymentProofFile, stock] = await Promise.all([
      this.approvals.getFor("PURCHASE_REQUEST", id),
      row.evidenceFileId
        ? this.prisma.main.file.findUnique({
            where: { id: row.evidenceFileId },
            select: { id: true, originalName: true, mimeType: true, size: true },
          })
        : Promise.resolve(null),
      (row as any).doFileId
        ? this.prisma.main.file.findUnique({
            where: { id: (row as any).doFileId },
            select: { id: true, originalName: true, mimeType: true, size: true },
          })
        : Promise.resolve(null),
      this.prisma.main.file.findFirst({
        where: { refType: "purchase_request_payment", refId: String(id) },
        select: { id: true, originalName: true, mimeType: true, size: true },
      }),
      Promise.all(
        row.items.map(async (i) => ({
          productId: i.productId,
          customName: (i as any).customName ?? null,
          customUnit: (i as any).customUnit ?? null,
          ordered: i.qty,
          available: i.productId ? await this.stock.totalAvailable(i.productId) : 0,
        })),
      ),
    ]);
    const isPaid =
      (row.status as string) === "DIBAYAR" ||
      (row.otherNote as string)?.includes("[DIBAYAR]") ||
      !!paymentProofFile;
    return {
      ...row,
      evidenceFile,
      doFile,
      approval,
      stock,
      paymentProofFile,
      paymentProofFileId: paymentProofFile?.id ?? null,
      paymentStatus: isPaid ? "DIBAYAR" : "BELUM_DIBAYAR",
      isPaid,
    };
  }

  async create(dto: RequestDto, user: RequestUser) {
    const costType = dto.costType ?? "STOK";
    let projectId = dto.projectId;
    if (costType === "PROJECT" && !projectId) {
      const firstProj = await this.prisma.main.project.findFirst();
      projectId = firstProj?.id;
    }
    const purpose = dto.purpose || "Kebutuhan operasional";
    const otherNote = costType === "LAINNYA" && !dto.otherNote?.trim() ? purpose : dto.otherNote;

    let items = dto.items ?? [];
    if (!items.length) {
      const firstProduct = await this.prisma.main.product.findFirst();
      if (firstProduct) {
        items = [{ productId: firstProduct.id, qty: 1, unitCost: 0 }];
      }
    }

    const number = await this.docnum.next("permintaan");
    const estimated = items.reduce((s, i) => s + i.qty * (i.unitCost ?? 0), 0);

    const row = await this.prisma.main.purchaseRequest.create({
      data: {
        number,
        date: dto.date ? new Date(dto.date) : new Date(),
        requesterId: user.id,
        costType,
        procurementSource: dto.procurementSource ?? "SUPPLIER",
        paymentMethod: dto.paymentMethod ?? "UTANG",
        projectId,
        taskId: dto.taskId,
        supplierId: dto.supplierId,
        condition: dto.condition ?? "BARU",
        estimatedCost: estimated,
        purpose,
        otherNote,
        evidenceFileId: dto.evidenceFileId,
        status: (dto.status as any) ?? "DIAJUKAN",
        items: {
          create: items.map((i) => ({
            productId: i.productId ?? null,
            customName: i.customName ?? null,
            customUnit: i.customUnit ?? null,
            qty: i.qty,
            unitCost: i.unitCost ?? 0,
            serials: i.serials ?? null,
          })),
        },
      },
      include: {
        requester: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
      },
    });
    if (dto.evidenceFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.evidenceFileId },
        data: { refType: "purchase-request", refId: String(row.id) },
      }).catch(() => {});
    }

    if (projectId && items.length > 0) {
      for (const item of items) {
        if (!item.productId) continue;
        const existingReq = await this.prisma.main.projectRequirement.findFirst({
          where: { projectId, productId: item.productId },
        });
        if (!existingReq) {
          await this.prisma.main.projectRequirement.create({
            data: { projectId, productId: item.productId, qty: item.qty },
          }).catch(() => {});
        }
      }
    }

    await this.audit.log({
      actor: user,
      action: "BUAT_REQUEST_BARANG",
      entityType: "purchase-request",
      entityId: row.id,
      detail: `${number} — ${purpose} Rp${estimated}`,
    });
    await this.notifications.notify({
      roles: ["PROCUREMENT", "GUDANG"],
      kind: "STOK",
      text: `Request barang baru: ${number} — ${purpose}`,
      href: `/requests/${row.id}`,
    });
    await this.approvals.request({
      kind: "PURCHASE_REQUEST",
      entityId: row.id,
      title: `Request barang ${number}`,
      amount: estimated,
      requestedBy: user,
      href: `/requests/${row.id}`,
    });
    return row;
  }

  async update(id: number, dto: RequestDto, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Request tidak ditemukan");

    const updated = await this.prisma.main.purchaseRequest.update({
      where: { id },
      data: {
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.costType ? { costType: dto.costType } : {}),
        ...(dto.procurementSource !== undefined ? { procurementSource: dto.procurementSource } : {}),
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.taskId !== undefined ? { taskId: dto.taskId } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
        ...(dto.condition ? { condition: dto.condition } : {}),
        ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
        ...(dto.otherNote !== undefined ? { otherNote: dto.otherNote } : {}),
        ...(dto.evidenceFileId !== undefined ? { evidenceFileId: dto.evidenceFileId } : {}),
        ...(dto.doFileId !== undefined ? { doFileId: dto.doFileId } : {}),
        ...(dto.paymentProofFileId !== undefined ? { paymentProofFileId: dto.paymentProofFileId } : {}),
        ...(dto.paymentStatus !== undefined ? { paymentStatus: dto.paymentStatus } : {}),
        ...(dto.status ? { status: dto.status as any } : {}),
        ...(dto.items?.length
          ? {
              estimatedCost: dto.items.reduce((s, i) => s + i.qty * (i.unitCost ?? 0), 0),
              items: {
                deleteMany: {},
                create: dto.items.map((i) => ({
                  productId: i.productId ?? null,
                  customName: i.customName ?? null,
                  customUnit: i.customUnit ?? null,
                  qty: i.qty,
                  unitCost: i.unitCost ?? 0,
                  serials: i.serials ?? null,
                })),
              },
            }
          : {}),
      },
      include: {
        requester: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
      },
    });
    if (dto.evidenceFileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.evidenceFileId },
          data: { refType: "purchase_request", refId: String(id) },
        })
        .catch(() => {});
    }
    if (dto.doFileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.doFileId },
          data: { refType: "purchase_request_do", refId: String(id) },
        })
        .catch(() => {});
    }
    return updated;
  }

  /** Gudang & Procurement memproses request (cek stok, serahkan barang, konfirmasi terima, tolak). */
  async setStatus(id: number, dto: RequestStatusDto, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({
      where: { id },
      include: { items: true, project: { select: { id: true, name: true, picId: true } }, requester: true },
    });
    if (!row) throw new NotFoundException("Request tidak ditemukan");

    // Untuk request internal (ambil stok gudang untuk project): kurangi stok OUT saat diserahkan/dikirim.
    // Untuk pembelian (ritel / PO): barang belum ada di gudang, stok baru bertambah saat Penerimaan (Receiving).
    const isPurchase =
      row.procurementSource === "RETAIL" ||
      row.procurementSource === "SUPPLIER";

    const shouldReduceStock =
      !isPurchase &&
      (dto.status === "DIKIRIM" || dto.status === "DITERIMA") &&
      row.status !== "DIKIRIM" &&
      row.status !== "DITERIMA";

    if (shouldReduceStock) {
      const defaultWarehouse =
        (await this.prisma.main.warehouse.findFirst({ where: { status: "AKTIF" } })) ??
        (await this.prisma.main.warehouse.findFirst());
      for (const item of row.items) {
        if (!item.productId) continue;
        const product = await this.prisma.main.product.findUnique({ where: { id: item.productId } });
        const requestedSns = item.serials
          ? String(item.serials)
              .split(/[\n,;]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        let handledQty = 0;
        if (product?.hasSerial) {
          const serialUnits =
            requestedSns.length > 0
              ? await this.prisma.main.serialUnit.findMany({
                  where: { sn: { in: requestedSns } },
                })
              : await this.prisma.main.serialUnit.findMany({
                  where: {
                    productId: item.productId,
                    status: { in: ["DI_GUDANG", "RESERVED"] },
                    warehouseId: { not: null },
                  },
                  take: item.qty,
                });

          for (const u of serialUnits) {
            const whId = u.warehouseId ?? defaultWarehouse?.id;
            if (!whId) continue;
            try {
              await this.stock.applyMovement({
                date: new Date(),
                type: "OUT",
                category: row.projectId ? "KELUAR_PROJECT" : "BARANG_TERPAKAI",
                productId: item.productId,
                fromWarehouseId: whId,
                qty: 1,
                serialUnitId: u.id,
                projectId: row.projectId ?? null,
                reason: `Pengeluaran unit SN ${u.sn} request ${row.number} oleh ${user.name}`,
                createdById: user.id,
              });
              const targetSnStatus = dto.status === "DITERIMA" && row.projectId ? "TERPASANG" : "DIKIRIM";
              await this.prisma.main.serialUnit.update({
                where: { id: u.id },
                data: {
                  status: targetSnStatus,
                  warehouseId: null,
                  projectId: row.projectId ?? u.projectId,
                },
              });
              await this.prisma.main.serialUnitHistory.create({
                data: {
                  serialUnitId: u.id,
                  status: targetSnStatus,
                  warehouseId: whId,
                  projectId: row.projectId ?? null,
                  note: `Keluar untuk request barang ${row.number}`,
                  changedById: user.id,
                },
              });
              handledQty++;
            } catch (e) {
              console.warn(`Gagal mencatat movement SN ${u.sn} request ${row.number}:`, (e as Error).message);
            }
          }
        }

        const remainingQty = Math.max(0, item.qty - handledQty);
        if (remainingQty > 0) {
          const balance =
            (await this.prisma.main.stockBalance.findFirst({
              where: { productId: item.productId, qty: { gte: remainingQty } },
            })) ??
            (await this.prisma.main.stockBalance.findFirst({
              where: { productId: item.productId, qty: { gt: 0 } },
            }));
          const warehouseId = balance?.warehouseId ?? defaultWarehouse?.id;
          if (warehouseId) {
            try {
              await this.stock.applyMovement({
                date: new Date(),
                type: "OUT",
                category: row.projectId ? "KELUAR_PROJECT" : "BARANG_TERPAKAI",
                productId: item.productId,
                fromWarehouseId: warehouseId,
                qty: remainingQty,
                projectId: row.projectId ?? null,
                reason: `Pengeluaran barang request ${row.number} status ${dto.status} oleh ${user.name}`,
                createdById: user.id,
              });
            } catch (e) {
              console.warn(`Gagal mencatat movement stok request ${row.number}:`, (e as Error).message);
            }
          }
        }
      }
    }

    if ((dto.status === "DIKIRIM" || dto.status === "DITERIMA") && row.projectId) {
      for (const item of row.items) {
        if (!item.productId) continue;
        const existing = await this.prisma.main.projectRequirement.findFirst({
          where: { projectId: row.projectId, productId: item.productId },
        });
        if (existing) {
          await this.prisma.main.projectRequirement.update({
            where: { id: existing.id },
            data: { reservedQty: item.qty, status: "DIRESERVE" },
          }).catch(() => {});
        } else {
          await this.prisma.main.projectRequirement.create({
            data: {
              projectId: row.projectId,
              productId: item.productId,
              qty: item.qty,
              reservedQty: item.qty,
              status: "DIRESERVE",
            },
          }).catch(() => {});
        }
      }
    }

    const isMarkingPaid = dto.status === "DIBAYAR" || !!dto.paymentProofFileId;
    let updated: any;
    try {
      updated = await this.prisma.main.purchaseRequest.update({
        where: { id },
        data: {
          status: dto.status as never,
          rejectReason: dto.reason ?? row.rejectReason,
          ...(dto.doFileId ? { doFileId: dto.doFileId } : {}),
          ...(isMarkingPaid && !row.otherNote?.includes("[DIBAYAR]")
            ? { otherNote: row.otherNote ? `[DIBAYAR] ${row.otherNote}` : "[DIBAYAR]" }
            : {}),
        },
        include: { project: { select: { id: true, name: true, picId: true } }, requester: true },
      });
    } catch (err: any) {
      if (dto.status === "DIBAYAR") {
        // Fallback bila MySQL enum belum di-alter ke DIBAYAR
        updated = await this.prisma.main.purchaseRequest.update({
          where: { id },
          data: {
            status: "DISETUJUI" as never,
            rejectReason: dto.reason ?? row.rejectReason,
            ...(dto.doFileId ? { doFileId: dto.doFileId } : {}),
            otherNote: row.otherNote ? (row.otherNote.includes("[DIBAYAR]") ? row.otherNote : `[DIBAYAR] ${row.otherNote}`) : "[DIBAYAR]",
          },
          include: { project: { select: { id: true, name: true, picId: true } }, requester: true },
        });
      } else {
        throw err;
      }
    }
    if (dto.doFileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.doFileId },
          data: { refType: "purchase_request_do", refId: String(id) },
        })
        .catch(() => {});
    }
    if (dto.paymentProofFileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.paymentProofFileId },
          data: { refType: "purchase_request_payment", refId: String(id) },
        })
        .catch(() => {});
    }

    // Bila pengadaan/pembelian ritel ditandai DIKIRIM oleh Procurement: otomatis buat data Penerimaan di Gudang
    if (dto.status === "DIKIRIM" && row.procurementSource === "RETAIL") {
      try {
        const existingRec = await this.prisma.main.receiving.findFirst({
          where: {
            OR: [
              { requestId: row.id },
              { conditionNote: { contains: row.number } },
            ],
          },
        });
        if (!existingRec) {
          const recNumber = await this.docnum.next("penerimaan");
          const defaultWh =
            (await this.prisma.main.warehouse.findFirst({ where: { status: "AKTIF" } })) ??
            (await this.prisma.main.warehouse.findFirst());
          const defaultCat =
            (await this.prisma.main.productCategory.findFirst({ where: { status: "AKTIF" } })) ??
            (await this.prisma.main.productCategory.findFirst());

          const recItems: any[] = [];
          for (const it of row.items) {
            let pId = it.productId;
            if (!pId && it.customName) {
              let p = await this.prisma.main.product.findFirst({
                where: { name: { equals: it.customName } },
              });
              if (!p) {
                // Deteksi apakah user menandai ber-SN atau nama barang mengindikasikan barang elektronik/kamera
                const isSnItem = (it as any).hasSerial !== undefined
                  ? !!(it as any).hasSerial
                  : /kamera|cctv|dvr|nvr|switch|router|access point|server|ups|ip cam/i.test(it.customName);
                p = await this.prisma.main.product.create({
                  data: {
                    sku: `SKU-${Date.now().toString().slice(-6)}`,
                    name: it.customName,
                    unit: it.customUnit || "unit",
                    ...(defaultCat?.id ? { category: { connect: { id: defaultCat.id } } } : {}),
                    purchasePrice: Number(it.unitCost) || 0,
                    hasSerial: isSnItem,
                    status: "AKTIF",
                  },
                });
              }
              pId = p.id;
            }
            if (pId) {
              const itemQty = Math.max(1, Number(it.qty) || 1);
              recItems.push({
                productId: pId,
                qtyOrdered: itemQty,
                qtyReceived: itemQty,
                note: it.customName ? `Item Ritel: ${it.customName}` : undefined,
              });
            }
          }

          const createdRec = await this.prisma.main.receiving.create({
            data: {
              number: recNumber,
              requestId: row.id,
              supplierName: (row as any).supplier?.name || "Pembelian Ritel / Toko",
              warehouseId: defaultWh?.id ?? null,
              projectId: row.projectId ?? null,
              date: new Date(),
              receiverId: user.id,
              status: "MENUNGGU",
              conditionNote: `Ref Request: ${row.number} — ${row.purpose}`,
              receiptFileId: row.evidenceFileId ?? null,
              items: {
                create: recItems,
              },
            },
          });
          this.notifications.dataChange("receiving", "create", createdRec.id);
          await this.notifications.notify({
            roles: ["GUDANG"],
            kind: "STOK",
            text: `Penerimaan baru ${recNumber} otomatis dibuat untuk request ${row.number}. Cek fisik barang saat tiba.`,
            href: `/receivings/${createdRec.id}`,
          });
        }
      } catch (err) {
        console.warn(`Gagal membuat otomatis penerimaan untuk request ${row.number}:`, (err as Error).message);
      }
    }
    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_REQUEST",
      entityType: "purchase-request",
      entityId: id,
      detail: `${row.number}: ${row.status} → ${dto.status}${dto.reason ? ` — ${dto.reason}` : ""}`,
    });

    if (row.requesterId !== user.id) {
      await this.notifications.notify({
        userIds: [row.requesterId],
        kind: "STOK",
        text: `Request ${row.number}: status menjadi ${dto.status}${dto.reason ? ` (${dto.reason})` : ""}`,
        href: `/requests/${id}`,
      });
    }

    if (dto.status === "DIKIRIM") {
      const recipientIds = new Set<number>();
      if (row.requesterId) recipientIds.add(row.requesterId);
      if (row.project?.picId) recipientIds.add(row.project.picId);
      recipientIds.delete(user.id);
      if (recipientIds.size > 0) {
        await this.notifications.notify({
          userIds: Array.from(recipientIds),
          kind: "STOK",
          text: `Barang untuk request ${row.number} (${row.project?.name ?? row.purpose}) telah disiapkan & diserahkan oleh Gudang`,
          href: `/requests/${id}`,
        });
      }
    } else if (dto.status === "DITERIMA") {
      await this.notifications.notify({
        roles: ["GUDANG", "PROCUREMENT"],
        kind: "STOK",
        text: `Barang request ${row.number} telah diterima oleh pemohon (${row.requester?.name ?? "User"})`,
        href: `/requests/${id}`,
      });
    } else if (dto.status === "CEK_STOK") {
      await this.notifications.notify({
        roles: ["GUDANG"],
        kind: "STOK",
        text: `Mohon cek ketersediaan stok untuk request ${row.number}`,
        href: `/requests/${id}`,
      });
    }

    return updated;
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({
      where: { id },
      include: { supplierPOs: true },
    });
    if (!row) throw new NotFoundException("Request tidak ditemukan");
    const deletableStatuses = ["DIAJUKAN", "CEK_STOK", "DITOLAK"];
    if (!deletableStatuses.includes(row.status) || (row.supplierPOs && row.supplierPOs.length > 0)) {
      throw new BadRequestException(
        "Request sudah berjalan tidak bisa dihapus (hanya status Diajukan, Cek Stok, atau Ditolak yang dapat dihapus)",
      );
    }
    await this.prisma.main.$transaction(async (tx) => {
      await tx.stockReservation.deleteMany({ where: { purchaseRequestId: id } });
      await tx.approval.deleteMany({ where: { kind: "PURCHASE_REQUEST", entityId: id } });
      await tx.purchaseRequestItem.deleteMany({ where: { requestId: id } });
      await tx.purchaseRequest.delete({ where: { id } });
    });
    await this.audit.log({
      actor: user,
      action: "HAPUS_REQUEST_BARANG",
      entityType: "purchase-request",
      entityId: id,
      detail: `${row.number} dihapus`,
    });
    return { id, deleted: true };
  }

  suggestNumber() {
    return this.docnum.suggest("permintaan");
  }

  /** Ketersediaan stok per item (dipakai saat cek stok). */
  async checkStock(id: number) {
    const row = await this.prisma.main.purchaseRequest.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { id: true, name: true, unit: true } } } } },
    });
    if (!row) throw new NotFoundException("Request tidak ditemukan");
    const items = await Promise.all(
      row.items.map(async (i) => {
        const available = i.productId ? await this.stock.totalAvailable(i.productId) : 0;
        return {
          productId: i.productId,
          name: i.product?.name ?? (i as any).customName ?? "Barang Non-Master",
          unit: i.product?.unit ?? (i as any).customUnit ?? "unit",
          ordered: i.qty,
          available,
          enough: i.productId ? available >= i.qty : false,
        };
      }),
    );
    return { requestId: id, number: row.number, items, allEnough: items.every((i) => i.enough) };
  }
}
