import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { PostingService } from "../accounting/posting.service.js";
import {
  AssetQueryDto,
  AssignAssetDto,
  AuditScanItemDto,
  CreateAssetDto,
  CreateAuditDto,
  CreateCategoryDto,
  CreateLocationDto,
  DisposeAssetDto,
  PostMonthlyDepreciationDto,
  ReturnAssetDto,
  TransferAssetDto,
  UpdateAssetDto,
  UpdateCategoryDto,
  UpdateLocationDto,
} from "./dto.js";
import crypto from "crypto";
import QRCode from "qrcode";

function dateOnly(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  }
  const str = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(`${str}T00:00:00.000Z`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dateStr = String(d.getDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${dateStr}T00:00:00.000Z`);
}

@Injectable()
export class FixedAssetsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingService: PostingService,
  ) {}

  async onModuleInit() {
    void this.ensureRequiredCoaAccounts().catch(() => undefined);
  }

  private db(): any {
    return (this.prisma.main as any);
  }

  async ensureRequiredCoaAccounts() {
    const requiredCoa = [
      { code: "1500", name: "ASET TETAP (Header)", category: "Aset Tidak Lancar", normalBalance: "DEBIT", isPostable: false, isCash: false, isSystem: true, parentCode: null },
      { code: "1501", name: "Tanah", category: "Aset Tidak Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1500" },
      { code: "1502", name: "Bangunan & Gedung", category: "Aset Tidak Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1500" },
      { code: "1503", name: "Kendaraan Operasional", category: "Aset Tidak Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1500" },
      { code: "1504", name: "Peralatan Kantor & Elektronik", category: "Aset Tidak Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1500" },
      { code: "1505", name: "Mesin & Peralatan Proyek", category: "Aset Tidak Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1500" },
      { code: "1506", name: "Perangkat IT & Komputer", category: "Aset Tidak Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1500" },
      { code: "1507", name: "Furniture & Fixture", category: "Aset Tidak Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1500" },
      { code: "1590", name: "AKUMULASI PENYUSUTAN (Header)", category: "Aset Tidak Lancar", normalBalance: "KREDIT", isPostable: false, isCash: false, isSystem: true, parentCode: null },
      { code: "1591", name: "Akum. Penyusutan Gedung", category: "Aset Tidak Lancar", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1590" },
      { code: "1592", name: "Akum. Penyusutan Kendaraan", category: "Aset Tidak Lancar", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1590" },
      { code: "1593", name: "Akum. Penyusutan Peralatan Kantor", category: "Aset Tidak Lancar", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1590" },
      { code: "1594", name: "Akum. Penyusutan Mesin & Alat", category: "Aset Tidak Lancar", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1590" },
      { code: "1595", name: "Akum. Penyusutan Perangkat IT", category: "Aset Tidak Lancar", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1590" },
      { code: "1596", name: "Akum. Penyusutan Furniture", category: "Aset Tidak Lancar", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1590" },
      { code: "6101", name: "Beban Penyusutan Aset Tetap", category: "Beban Operasional", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "6000" },
      { code: "6103", name: "Kerugian Pelepasan Aset Tetap", category: "Beban Diluar Usaha", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: null },
      { code: "7102", name: "Keuntungan Pelepasan Aset Tetap", category: "Pendapatan Diluar Usaha", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: null },
    ];

    for (const acc of requiredCoa) {
      try {
        const found = await this.db().coaAccount.findUnique({
          where: { code: acc.code },
          select: { id: true },
        });
        if (!found) {
          if (acc.parentCode) {
            const parentFound = await this.db().coaAccount.findUnique({
              where: { code: acc.parentCode },
              select: { id: true },
            });
            if (!parentFound) {
              const p = requiredCoa.find((r) => r.code === acc.parentCode);
              if (p) await this.db().coaAccount.create({ data: p }).catch(() => null);
            }
          }
          await this.db().coaAccount.create({ data: acc }).catch(() => null);
        }
      } catch {
        // ignore duplicate / concurrent errors
      }
    }
  }

  // ───────────────────────────────────────────────
  // Code Generators
  // ───────────────────────────────────────────────
  private async generateCode(
    prefix: string,
    tableName: string,
    columnName: string,
    digits = 5,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const pattern = `${prefix}-${year}-%`;
    const rows = await this.db().$queryRawUnsafe(
      `SELECT ${columnName} as code FROM ${tableName} WHERE ${columnName} LIKE ? ORDER BY ${columnName} DESC LIMIT 1`,
      pattern,
    );
    let nextSeq = 1;
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.code) {
      const parts = String(rows[0].code).split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }
    return `${prefix}-${year}-${String(nextSeq).padStart(digits, "0")}`;
  }

  // ───────────────────────────────────────────────
  // 1. Categories
  // ───────────────────────────────────────────────
  async listCategories() {
    return this.db().faCategory.findMany({
      orderBy: { code: "asc" },
      include: {
        _count: { select: { assets: true } },
      },
    });
  }

  async getCategory(id: number) {
    const cat = await this.db().faCategory.findUnique({
      where: { id },
      include: { assets: { take: 10 } },
    });
    if (!cat) throw new NotFoundException(`Kategori aset #${id} tidak ditemukan`);
    return cat;
  }

  async createCategory(dto: CreateCategoryDto) {
    let code = dto.code;
    if (!code) {
      const count = await this.db().faCategory.count();
      code = `CAT-${String(count + 1).padStart(3, "0")}`;
    }
    return this.db().faCategory.create({
      data: {
        code,
        name: dto.name,
        type: dto.type || "TANGIBLE",
        defaultUsefulLifeMonths: dto.defaultUsefulLifeMonths ?? 48,
        depreciationMethod: dto.depreciationMethod || "STRAIGHT_LINE",
        defaultResidualRate: dto.defaultResidualRate ?? 0,
        assetAccountCode: dto.assetAccountCode,
        accumDepAccountCode: dto.accumDepAccountCode,
        depExpenseAccountCode: dto.depExpenseAccountCode,
        capitalizationThreshold: dto.capitalizationThreshold ?? 0,
        description: dto.description,
      },
    });
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    await this.getCategory(id);
    return this.db().faCategory.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.defaultUsefulLifeMonths !== undefined
          ? { defaultUsefulLifeMonths: dto.defaultUsefulLifeMonths }
          : {}),
        ...(dto.depreciationMethod
          ? { depreciationMethod: dto.depreciationMethod }
          : {}),
        ...(dto.defaultResidualRate !== undefined
          ? { defaultResidualRate: dto.defaultResidualRate }
          : {}),
        ...(dto.assetAccountCode !== undefined
          ? { assetAccountCode: dto.assetAccountCode }
          : {}),
        ...(dto.accumDepAccountCode !== undefined
          ? { accumDepAccountCode: dto.accumDepAccountCode }
          : {}),
        ...(dto.depExpenseAccountCode !== undefined
          ? { depExpenseAccountCode: dto.depExpenseAccountCode }
          : {}),
        ...(dto.capitalizationThreshold !== undefined
          ? { capitalizationThreshold: dto.capitalizationThreshold }
          : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
  }

  async deleteCategory(id: number) {
    const cat = await this.getCategory(id);
    const count = await this.db().faAsset.count({ where: { categoryId: id } });
    if (count > 0) {
      throw new ConflictException(
        `Kategori '${cat.name}' tidak dapat dihapus karena masih digunakan oleh ${count} aset.`,
      );
    }
    return this.db().faCategory.delete({ where: { id } });
  }

  // ───────────────────────────────────────────────
  // 2. Locations
  // ───────────────────────────────────────────────
  async listLocations() {
    return this.db().faLocation.findMany({
      orderBy: { code: "asc" },
      include: {
        _count: { select: { assets: true } },
      },
    });
  }

  async getLocation(id: number) {
    const loc = await this.db().faLocation.findUnique({
      where: { id },
      include: { assets: { take: 10 } },
    });
    if (!loc) throw new NotFoundException(`Lokasi #${id} tidak ditemukan`);
    return loc;
  }

  async createLocation(dto: CreateLocationDto) {
    let code = dto.code;
    if (!code) {
      const count = await this.db().faLocation.count();
      code = `LOC-${String(count + 1).padStart(3, "0")}`;
    }
    return this.db().faLocation.create({
      data: {
        code,
        name: dto.name,
        building: dto.building,
        floor: dto.floor,
        room: dto.room,
        description: dto.description,
      },
    });
  }

  async updateLocation(id: number, dto: UpdateLocationDto) {
    await this.getLocation(id);
    return this.db().faLocation.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.building !== undefined ? { building: dto.building } : {}),
        ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
        ...(dto.room !== undefined ? { room: dto.room } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
  }

  async deleteLocation(id: number) {
    const loc = await this.getLocation(id);
    const count = await this.db().faAsset.count({ where: { locationId: id } });
    if (count > 0) {
      throw new ConflictException(
        `Lokasi '${loc.name}' tidak dapat dihapus karena masih digunakan oleh ${count} aset.`,
      );
    }
    return this.db().faLocation.delete({ where: { id } });
  }

  // ───────────────────────────────────────────────
  // 3. Asset Registry (CRUD)
  // ───────────────────────────────────────────────
  async listAssets(query: AssetQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.q) {
      const search = query.q.trim();
      where.OR = [
        { assetCode: { contains: search } },
        { name: { contains: search } },
        { brand: { contains: search } },
        { model: { contains: search } },
        { serialNumber: { contains: search } },
        { department: { contains: search } },
        { assignedUser: { name: { contains: search } } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
    if (query.department) where.department = query.department;
    if (query.status) where.status = query.status;
    if (query.condition) where.condition = query.condition;
    if (query.type) where.type = query.type;

    const orderBy: any = {};
    if (query.sortBy) {
      orderBy[query.sortBy] = query.sortOrder === "desc" ? "desc" : "asc";
    } else {
      orderBy.id = "desc";
    }

    const [total, data] = await Promise.all([
      this.db().faAsset.count({ where }),
      this.db().faAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: true,
          location: true,
          assignedUser: { select: { id: true, name: true, email: true, department: true } },
        },
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAsset(id: number) {
    const asset = await this.db().faAsset.findUnique({
      where: { id },
      include: {
        category: true,
        location: true,
        assignedUser: {
          select: { id: true, name: true, email: true, phone: true, department: true, position: true },
        },
        assignments: {
          orderBy: { id: "desc" },
          include: {
            assignedToUser: { select: { id: true, name: true, department: true } },
          },
        },
        transfers: {
          orderBy: { id: "desc" },
        },
        disposals: true,
        depreciationSchedules: {
          orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
        },
        amortizationSchedules: {
          orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
        },
        maintenanceRefs: {
          orderBy: { serviceDate: "desc" },
          include: { maintenanceReport: { select: { id: true, number: true, title: true } } },
        },
        documents: {
          orderBy: { id: "desc" },
        },
        ledgerEntries: {
          orderBy: { id: "desc" },
        },
      },
    });
    if (!asset) throw new NotFoundException(`Aset #${id} tidak ditemukan`);
    return asset;
  }

  async getAssetByQrOrCode(codeOrQr: string) {
    const trimmed = String(codeOrQr).trim();
    const asset = await this.db().faAsset.findFirst({
      where: {
        OR: [{ assetCode: trimmed }, { qrCodeKey: trimmed }],
      },
      include: {
        category: true,
        location: true,
        assignedUser: {
          select: { id: true, name: true, email: true, phone: true, department: true, position: true },
        },
        assignments: {
          take: 5,
          orderBy: { id: "desc" },
          include: { assignedToUser: { select: { id: true, name: true } } },
        },
        transfers: { take: 5, orderBy: { id: "desc" } },
        maintenanceRefs: { take: 5, orderBy: { serviceDate: "desc" } },
      },
    });
    if (!asset) throw new NotFoundException(`Aset dengan kode/QR '${codeOrQr}' tidak ditemukan.`);
    return asset;
  }

  async getAssetQrCode(idOrCode: string) {
    let asset: any;
    const num = Number(idOrCode);
    if (!isNaN(num) && Number.isInteger(num)) {
      asset = await this.getAsset(num);
    } else {
      asset = await this.getAssetByQrOrCode(idOrCode);
    }
    const payload = asset.qrCodeKey || asset.assetCode;
    const dataUrl = await QRCode.toDataURL(payload, {
      width: 320,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
    return {
      assetId: asset.id,
      assetCode: asset.assetCode,
      qrCodeKey: asset.qrCodeKey,
      dataUrl,
    };
  }

  async createAsset(dto: CreateAssetDto, user?: any) {
    // 1. Validasi Kategori
    const category = await this.getCategory(dto.categoryId);

    // 2. Generate Asset Code AST-YYYY-xxxxx
    const assetCode =
      dto.assetCode?.trim() ||
      (await this.generateCode("AST", "fa_assets", "assetCode", 5));

    // 3. Generate QR Token
    const qrCodeKey = `TASK-FA-${assetCode}-${crypto.randomBytes(4).toString("hex")}`;

    // 4. Perhitungan Nilai Awal
    const acquisitionCost = Number(dto.acquisitionCost);
    const residualValue = Number(dto.residualValue || 0);
    const usefulLifeMonths = Number(dto.usefulLifeMonths || category.defaultUsefulLifeMonths || 48);
    const depreciationMethod = dto.depreciationMethod || category.depreciationMethod || "STRAIGHT_LINE";
    const type = dto.type || category.type || "TANGIBLE";
    const bookValue = acquisitionCost;

    const acquisitionDate = dateOnly(dto.acquisitionDate) ?? new Date();
    const inServiceDate = dateOnly(dto.inServiceDate) ?? acquisitionDate;

    // 5. Simpan Data Aset
    const asset = await this.db().faAsset.create({
      data: {
        assetCode,
        name: dto.name,
        categoryId: dto.categoryId,
        type,
        description: dto.description,
        brand: dto.brand,
        model: dto.model,
        serialNumber: dto.serialNumber,
        acquisitionDate,
        inServiceDate,
        acquisitionCost,
        residualValue,
        usefulLifeMonths,
        depreciationMethod,
        accumulatedDepreciation: 0,
        bookValue,
        locationId: dto.locationId,
        department: dto.department,
        assignedUserId: dto.assignedUserId,
        warrantyExpiry: dateOnly(dto.warrantyExpiry),
        condition: dto.condition || "GOOD",
        status: dto.status || (dto.assignedUserId ? "ASSIGNED" : "REGISTERED"),
        photoUrl: dto.photoUrl,
        documentUrl: dto.documentUrl,
        qrCodeKey,
        acquisitionSource: dto.acquisitionSource || "DIRECT_PURCHASE",
        receivingId: dto.receivingId,
        purchaseRequestId: dto.purchaseRequestId,
        customFields: dto.customFields,
        createdById: user?.id,
      },
    });

    // 6. Buat Buku Depresiasi (Commercial & Tax)
    await Promise.all([
      this.db().faDepreciationBook.create({
        data: {
          assetId: asset.id,
          bookType: "COMMERCIAL",
          usefulLifeMonths,
          depreciationMethod,
          salvageValue: residualValue,
          accumulatedDepreciation: 0,
          currentBookValue: bookValue,
        },
      }),
      this.db().faDepreciationBook.create({
        data: {
          assetId: asset.id,
          bookType: "TAX",
          usefulLifeMonths,
          depreciationMethod,
          salvageValue: 0,
          accumulatedDepreciation: 0,
          currentBookValue: bookValue,
        },
      }),
    ]);

    // 7. Generate Jadwal Depresiasi Bulanan Otomatis (Full Schedule)
    if (depreciationMethod !== "NONE" && usefulLifeMonths > 0) {
      await this.generateDepreciationSchedule(asset.id, {
        cost: acquisitionCost,
        residual: residualValue,
        months: usefulLifeMonths,
        startDate: inServiceDate,
        type,
      });
    }

    // 8. Catat di Buku Pembantu Aset (fa_asset_ledger)
    await this.db().faAssetLedger.create({
      data: {
        assetId: asset.id,
        transactionDate: acquisitionDate,
        transactionType: "ACQUISITION",
        referenceCode: assetCode,
        debit: acquisitionCost,
        credit: 0,
        bookValueAfter: bookValue,
        accumDepAfter: 0,
        description: `Perolehan aset baru ${dto.name} (${assetCode})`,
        createdById: user?.id,
      },
    });

    // 9. Jika langsung ada assignedUserId, buat record assignment otomatis
    if (dto.assignedUserId) {
      const assignmentCode = await this.generateCode("ASN", "fa_asset_assignments", "code", 5);
      await this.db().faAssetAssignment.create({
        data: {
          code: assignmentCode,
          assetId: asset.id,
          assignedToUserId: dto.assignedUserId,
          department: dto.department,
          locationId: dto.locationId,
          assignmentDate: inServiceDate,
          conditionAtHandover: dto.condition || "GOOD",
          notes: "Penyerahan langsung saat pendaftaran aset baru",
          createdById: user?.id,
          approvedById: user?.id,
          status: "ACTIVE",
        },
      });
    }

    // 10. Jurnal Akuntansi Perolehan Aset ke COA (General Ledger)
    if (acquisitionCost > 0) {
      const assetAccountCode = category.assetAccountCode || "1504";
      const creditAccountCode = dto.creditAccountCode || "1000.02";

      try {
        await this.ensureRequiredCoaAccounts();
        await this.postingService.post({
          date: acquisitionDate,
          source: "FIXED_ASSET_ACQUISITION",
          sourceType: "FaAsset",
          sourceId: asset.id,
          event: "ACQUISITION",
          refNo: assetCode,
          memo: `Perolehan Aset Tetap: ${dto.name} (${assetCode})`,
          lines: [
            {
              accountCode: assetAccountCode,
              debit: acquisitionCost,
              credit: 0,
              memo: `Perolehan aset tetap ${dto.name} (${assetCode})`,
            },
            {
              accountCode: creditAccountCode,
              debit: 0,
              credit: acquisitionCost,
              memo: `Sumber dana perolehan aset ${assetCode}`,
            },
          ],
        });
      } catch (err: any) {
        console.error(`Gagal posting jurnal perolehan aset ${assetCode} ke COA:`, err);
      }
    }

    return this.getAsset(asset.id);
  }

  async updateAsset(id: number, dto: UpdateAssetDto, user?: any) {
    const existing = await this.getAsset(id);

    return this.db().faAsset.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
        ...(dto.model !== undefined ? { model: dto.model } : {}),
        ...(dto.serialNumber !== undefined ? { serialNumber: dto.serialNumber } : {}),
        ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.warrantyExpiry !== undefined
          ? { warrantyExpiry: dateOnly(dto.warrantyExpiry) }
          : {}),
        ...(dto.condition ? { condition: dto.condition } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
        ...(dto.documentUrl !== undefined ? { documentUrl: dto.documentUrl } : {}),
        ...(dto.customFields !== undefined ? { customFields: dto.customFields } : {}),
      },
    });
  }

  async deleteAsset(id: number, user?: any) {
    const asset = await this.getAsset(id);
    if (Number(asset.accumulatedDepreciation) > 0) {
      throw new ConflictException(
        `Aset '${asset.assetCode}' telah memiliki penyusutan buku dan tidak dapat dihapus permanen. Gunakan fitur Pelepasan Aset (Disposal).`,
      );
    }
    // Delete schedules & references
    await this.db().faDepreciationSchedule.deleteMany({ where: { assetId: id } });
    await this.db().faAmortizationSchedule.deleteMany({ where: { assetId: id } });
    await this.db().faDepreciationBook.deleteMany({ where: { assetId: id } });
    await this.db().faAssetAssignment.deleteMany({ where: { assetId: id } });
    await this.db().faAssetTransfer.deleteMany({ where: { assetId: id } });
    await this.db().faAssetLedger.deleteMany({ where: { assetId: id } });

    // Reverse jurnal perolehan aset jika ada
    try {
      const acqJournal = await this.db().journalEntry.findFirst({
        where: {
          source: "FIXED_ASSET_ACQUISITION",
          sourceId: id,
          status: "POSTED",
        },
      });
      if (acqJournal) {
        await this.postingService.reverse(
          acqJournal.id,
          "Pembatalan perolehan aset tetap yang dihapus",
          user?.id,
        );
      }
    } catch (err: any) {
      console.warn("Gagal reverse jurnal perolehan aset:", err);
    }

    return this.db().faAsset.delete({ where: { id } });
  }

  // ───────────────────────────────────────────────
  // 4. Jadwal Depresiasi (Calculation Engine)
  // ───────────────────────────────────────────────
  private async generateDepreciationSchedule(
    assetId: number,
    params: {
      cost: number;
      residual: number;
      months: number;
      startDate: Date;
      type: string;
    },
  ) {
    const { cost, residual, months, startDate, type } = params;
    const depreciableAmount = Math.max(0, cost - residual);
    if (months <= 0 || depreciableAmount <= 0) return;

    const baseMonthly = Math.floor(depreciableAmount / months);
    let accum = 0;
    const schedules: any[] = [];

    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1; // 1-12

    for (let i = 1; i <= months; i++) {
      // Hitung tahun dan bulan periode
      const totalMonthIndex = startMonth - 1 + (i - 1);
      const periodYear = startYear + Math.floor(totalMonthIndex / 12);
      const periodMonth = (totalMonthIndex % 12) + 1;

      let monthlyAmount = baseMonthly;
      if (i === months) {
        // Penyesuaian periode terakhir agar total susut tepat sama dengan depreciableAmount
        monthlyAmount = depreciableAmount - accum;
      }
      accum += monthlyAmount;
      const endingBookValue = Math.max(residual, cost - accum);

      schedules.push({
        assetId,
        periodYear,
        periodMonth,
        monthIndex: i,
        depreciationAmount: monthlyAmount,
        accumulatedDepreciation: accum,
        endingBookValue,
        isPosted: false,
      });
    }

    if (type === "INTANGIBLE") {
      const mapped = schedules.map((s) => ({
        assetId: s.assetId,
        periodYear: s.periodYear,
        periodMonth: s.periodMonth,
        monthIndex: s.monthIndex,
        amortizationAmount: s.depreciationAmount,
        accumulatedAmortization: s.accumulatedDepreciation,
        endingBookValue: s.endingBookValue,
        isPosted: false,
      }));
      await this.db().faAmortizationSchedule.createMany({ data: mapped });
    } else {
      await this.db().faDepreciationSchedule.createMany({ data: schedules });
    }
  }

  // ───────────────────────────────────────────────
  // 5. Assignment & Serah Terima (ASN)
  // ───────────────────────────────────────────────
  async assignAsset(assetId: number, dto: AssignAssetDto, user?: any) {
    const asset = await this.getAsset(assetId);
    if (asset.status === "DISPOSED" || asset.status === "WRITTEN_OFF") {
      throw new BadRequestException("Aset yang sudah dilepas/dihapus tidak dapat diserahterimakan.");
    }

    const code = await this.generateCode("ASN", "fa_asset_assignments", "code", 5);
    const assignmentDate = dateOnly(dto.assignmentDate) ?? new Date();

    // Tutup assignment aktif sebelumnya jika ada
    await this.db().faAssetAssignment.updateMany({
      where: { assetId, status: "ACTIVE" },
      data: { status: "RETURNED", returnDate: assignmentDate, returnCondition: "TRANSFERRED" },
    });

    const assignment = await this.db().faAssetAssignment.create({
      data: {
        code,
        assetId,
        assignedToUserId: dto.assignedToUserId,
        department: dto.department,
        locationId: dto.locationId,
        assignmentDate,
        conditionAtHandover: dto.conditionAtHandover || "GOOD",
        handoverDocumentUrl: dto.handoverDocumentUrl,
        notes: dto.notes,
        createdById: user?.id,
        approvedById: user?.id,
        status: "ACTIVE",
      },
    });

    // Update status master aset
    await this.db().faAsset.update({
      where: { id: assetId },
      data: {
        status: "ASSIGNED",
        assignedUserId: dto.assignedToUserId,
        department: dto.department || asset.department,
        locationId: dto.locationId || asset.locationId,
        condition: dto.conditionAtHandover || asset.condition,
      },
    });

    return assignment;
  }

  async returnAsset(assetId: number, dto: ReturnAssetDto, user?: any) {
    const asset = await this.getAsset(assetId);
    const returnDate = dateOnly(dto.returnDate) ?? new Date();

    // Update assignment aktif menjadi RETURNED
    await this.db().faAssetAssignment.updateMany({
      where: { assetId, status: "ACTIVE" },
      data: {
        status: "RETURNED",
        returnDate,
        returnCondition: dto.returnCondition || "GOOD",
        notes: dto.notes,
      },
    });

    // Update master aset
    await this.db().faAsset.update({
      where: { id: assetId },
      data: {
        status: "IN_SERVICE",
        assignedUserId: null,
        condition: dto.returnCondition || asset.condition,
        locationId: dto.locationId || asset.locationId,
      },
    });

    return { message: "Aset berhasil dikembalikan ke inventaris.", assetId };
  }

  // ───────────────────────────────────────────────
  // 6. Mutasi / Transfer (TRF)
  // ───────────────────────────────────────────────
  async transferAsset(assetId: number, dto: TransferAssetDto, user?: any) {
    const asset = await this.getAsset(assetId);
    if (asset.status === "DISPOSED" || asset.status === "WRITTEN_OFF") {
      throw new BadRequestException("Aset yang sudah dilepas tidak dapat dimutasi.");
    }

    const code = await this.generateCode("TRF", "fa_asset_transfers", "code", 5);
    const transferDate = dateOnly(dto.transferDate) ?? new Date();

    const transfer = await this.db().faAssetTransfer.create({
      data: {
        code,
        assetId,
        fromUserId: asset.assignedUserId,
        toUserId: dto.toUserId,
        fromLocationId: asset.locationId,
        toLocationId: dto.toLocationId,
        fromDepartment: asset.department,
        toDepartment: dto.toDepartment,
        transferDate,
        status: "APPROVED",
        reason: dto.reason,
        condition: dto.condition || asset.condition,
        approvedById: user?.id,
        createdById: user?.id,
      },
    });

    // Update assignment aktif
    await this.db().faAssetAssignment.updateMany({
      where: { assetId, status: "ACTIVE" },
      data: { status: "RETURNED", returnDate: transferDate, returnCondition: "MUTATION" },
    });

    if (dto.toUserId) {
      const asnCode = await this.generateCode("ASN", "fa_asset_assignments", "code", 5);
      await this.db().faAssetAssignment.create({
        data: {
          code: asnCode,
          assetId,
          assignedToUserId: dto.toUserId,
          department: dto.toDepartment || asset.department,
          locationId: dto.toLocationId || asset.locationId,
          assignmentDate: transferDate,
          conditionAtHandover: dto.condition || asset.condition,
          notes: `Hasil mutasi (${code}): ${dto.reason || ""}`,
          createdById: user?.id,
          approvedById: user?.id,
          status: "ACTIVE",
        },
      });
    }

    // Update master aset
    await this.db().faAsset.update({
      where: { id: assetId },
      data: {
        assignedUserId: dto.toUserId ?? null,
        locationId: dto.toLocationId ?? asset.locationId,
        department: dto.toDepartment ?? asset.department,
        condition: dto.condition || asset.condition,
        status: dto.toUserId ? "ASSIGNED" : "IN_SERVICE",
      },
    });

    return transfer;
  }

  // ───────────────────────────────────────────────
  // 7. Pelepasan Aset (Disposal - DSP)
  // ───────────────────────────────────────────────
  async disposeAsset(assetId: number, dto: DisposeAssetDto, user?: any) {
    const asset = await this.getAsset(assetId);
    if (asset.status === "DISPOSED" || asset.status === "WRITTEN_OFF") {
      throw new BadRequestException("Aset ini sudah dalam status dilepas/dihapuskan.");
    }

    const code = await this.generateCode("DSP", "fa_asset_disposals", "code", 5);
    const disposalDate = dateOnly(dto.disposalDate) ?? new Date();
    const disposalPrice = Number(dto.disposalPrice || 0);

    const costAtDisposal = Number(asset.acquisitionCost);
    const accumDepAtDisposal = Number(asset.accumulatedDepreciation);
    const bookValueAtDisposal = Number(asset.bookValue);
    const gainLossAmount = disposalPrice - bookValueAtDisposal;

    // 1. Catat Disposal di DB
    const disposal = await this.db().faAssetDisposal.create({
      data: {
        code,
        assetId,
        disposalDate,
        disposalType: dto.disposalType,
        disposalPrice,
        costAtDisposal,
        accumDepAtDisposal,
        bookValueAtDisposal,
        gainLossAmount,
        buyerName: dto.buyerName,
        reason: dto.reason,
        documentUrl: dto.documentUrl,
        approvedById: user?.id,
        createdById: user?.id,
        status: "APPROVED",
      },
    });

    // 2. Buat Jurnal Pelepasan Aset ke General Ledger
    let journalEntryId: number | null = null;
    try {
      const assetAcc = asset.category?.assetAccountCode || "1504";
      const accumAcc = asset.category?.accumDepAccountCode || "1592";
      const cashAcc = dto.cashAccountCode || "1000.02"; // Bank Mandiri default
      const gainLossAcc = "6103"; // PRD 6103 Gain/Loss on Asset Disposal

      const lines: any[] = [];

      // a. Debit Kas jika ada penerimaan uang dari penjualan
      if (disposalPrice > 0) {
        lines.push({
          accountCode: cashAcc,
          debit: disposalPrice,
          credit: 0,
          memo: `Kas masuk penjualan aset ${asset.assetCode}`,
        });
      }

      // b. Debit Akumulasi Penyusutan (menutup saldo susut)
      if (accumDepAtDisposal > 0) {
        lines.push({
          accountCode: accumAcc,
          debit: accumDepAtDisposal,
          credit: 0,
          memo: `Tutup akumulasi susut ${asset.assetCode}`,
        });
      }

      // c. Kredit Nilai Perolehan Aset (menghapus dari neraca)
      lines.push({
        accountCode: assetAcc,
        debit: 0,
        credit: costAtDisposal,
        memo: `Penghapusan nilai buku aset ${asset.assetCode}`,
      });

      // d. Selisih Laba / Rugi Pelepasan (Gain / Loss)
      if (gainLossAmount > 0) {
        // Untung -> Kredit Pendapatan/Gain (6103)
        lines.push({
          accountCode: gainLossAcc,
          debit: 0,
          credit: gainLossAmount,
          memo: `Keuntungan pelepasan aset ${asset.assetCode}`,
        });
      } else if (gainLossAmount < 0) {
        // Rugi -> Debit Beban Kerugian (6103)
        lines.push({
          accountCode: gainLossAcc,
          debit: Math.abs(gainLossAmount),
          credit: 0,
          memo: `Kerugian pelepasan aset ${asset.assetCode}`,
        });
      }

      if (lines.length >= 2) {
        await this.ensureRequiredCoaAccounts();
        const postedJournal = await this.postingService.post({
          date: disposalDate,
          source: "FIXED_ASSET_DISPOSAL",
          sourceType: "FaAssetDisposal",
          sourceId: disposal.id,
          event: "DISPOSAL",
          refNo: asset.assetCode,
          memo: `Pelepasan Aset Tetap ${asset.assetCode} (${dto.disposalType}): ${dto.reason}`,
          lines,
        });
        if (postedJournal?.id) {
          journalEntryId = postedJournal.id;
          await this.db().faAssetDisposal.update({
            where: { id: disposal.id },
            data: { journalEntryId },
          });
        }
      }
    } catch (err: any) {
      console.error("[FixedAssetsService] Gagal posting jurnal disposal:", err?.message || err);
    }

    // 3. Update status aset menjadi DISPOSED atau WRITTEN_OFF
    const finalStatus = dto.disposalType === "WRITTEN_OFF" ? "WRITTEN_OFF" : "DISPOSED";
    await this.db().faAsset.update({
      where: { id: assetId },
      data: {
        status: finalStatus,
        bookValue: 0,
        assignedUserId: null,
      },
    });

    // 4. Catat di fa_asset_ledger
    await this.db().faAssetLedger.create({
      data: {
        assetId,
        transactionDate: disposalDate,
        transactionType: "DISPOSAL",
        referenceCode: code,
        debit: 0,
        credit: bookValueAtDisposal,
        bookValueAfter: 0,
        accumDepAfter: accumDepAtDisposal,
        journalEntryId,
        description: `Pelepasan aset (${dto.disposalType}) seharga Rp ${disposalPrice.toLocaleString("id-ID")}. Gain/Loss: Rp ${gainLossAmount.toLocaleString("id-ID")}`,
        createdById: user?.id,
      },
    });

    return this.db().faAssetDisposal.findUnique({ where: { id: disposal.id } });
  }

  // ───────────────────────────────────────────────
  // 8. Posting Depresiasi Bulanan ke Accounting
  // ───────────────────────────────────────────────
  async postMonthlyDepreciation(dto: PostMonthlyDepreciationDto, user?: any) {
    const { periodYear, periodMonth, assetIds } = dto;

    // Cari jadwal depresiasi yang belum diposting untuk periode ini
    const where: any = {
      periodYear,
      periodMonth,
      isPosted: false,
      asset: {
        status: { in: ["REGISTERED", "IN_SERVICE", "ASSIGNED", "UNDER_MAINTENANCE", "IDLE"] },
      },
    };
    if (assetIds && assetIds.length > 0) {
      where.assetId = { in: assetIds };
    }

    const schedules = await this.db().faDepreciationSchedule.findMany({
      where,
      include: {
        asset: {
          include: { category: true },
        },
      },
    });

    if (schedules.length === 0) {
      return {
        message: `Tidak ada jadwal depresiasi yang belum diposting untuk periode ${periodYear}-${String(periodMonth).padStart(2, "0")}.`,
        postedCount: 0,
        totalAmount: 0,
      };
    }

    // Buat tanggal akhir bulan periode (UTC midnight agar tidak bergeser hari)
    const lastDay = new Date(Date.UTC(periodYear, periodMonth, 0)).getUTCDate();
    const postingDate = new Date(`${periodYear}-${String(periodMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T00:00:00.000Z`);

    let postedCount = 0;
    let totalAmount = 0;

    if (schedules.length > 0) {
      await this.ensureRequiredCoaAccounts();
    }

    for (const schedule of schedules) {
      const depAmount = Number(schedule.depreciationAmount);
      if (depAmount <= 0) continue;

      const asset = schedule.asset;
      const expenseAcc = asset.category?.depExpenseAccountCode || "6101"; // PRD 6101 Depreciation Expense
      const accumAcc = asset.category?.accumDepAccountCode || "1592";

      let journalEntryId: number | null = null;
      try {
        const journal = await this.postingService.post({
          date: postingDate,
          source: "FIXED_ASSET_DEPRECIATION",
          sourceType: "FaDepreciationSchedule",
          sourceId: schedule.id,
          event: `DEP-${periodYear}-${periodMonth}`,
          refNo: asset.assetCode,
          memo: `Penyusutan Aset ${asset.assetCode} Periode ${periodYear}/${String(periodMonth).padStart(2, "0")}`,
          lines: [
            {
              accountCode: expenseAcc,
              debit: depAmount,
              credit: 0,
              memo: `Beban penyusutan ${asset.name} (${asset.assetCode})`,
            },
            {
              accountCode: accumAcc,
              debit: 0,
              credit: depAmount,
              memo: `Akumulasi penyusutan ${asset.name} (${asset.assetCode})`,
            },
          ],
        });
        if (journal?.id) journalEntryId = journal.id;
      } catch (err: any) {
        console.error(`[FixedAssetsService] Gagal posting depresiasi aset #${asset.id}:`, err?.message || err);
      }

      // Update baris schedule
      await this.db().faDepreciationSchedule.update({
        where: { id: schedule.id },
        data: {
          isPosted: true,
          journalEntryId,
          postedAt: new Date(),
          postedById: user?.id,
        },
      });

      // Update akumulasi & nilai buku pada master aset
      const updatedAccum = Number(asset.accumulatedDepreciation) + depAmount;
      const updatedBookValue = Math.max(
        Number(asset.residualValue || 0),
        Number(asset.acquisitionCost) - updatedAccum,
      );

      await this.db().faAsset.update({
        where: { id: asset.id },
        data: {
          accumulatedDepreciation: updatedAccum,
          bookValue: updatedBookValue,
        },
      });

      // Catat di fa_asset_ledger
      await this.db().faAssetLedger.create({
        data: {
          assetId: asset.id,
          transactionDate: postingDate,
          transactionType: "DEPRECIATION",
          referenceCode: `DEP/${periodYear}/${String(periodMonth).padStart(2, "0")}`,
          debit: 0,
          credit: depAmount,
          bookValueAfter: updatedBookValue,
          accumDepAfter: updatedAccum,
          journalEntryId,
          description: `Penyusutan periode ${periodYear}/${String(periodMonth).padStart(2, "0")}`,
          createdById: user?.id,
        },
      });

      postedCount++;
      totalAmount += depAmount;
    }

    return {
      message: `Berhasil memproses depresiasi untuk ${postedCount} aset pada periode ${periodYear}-${String(periodMonth).padStart(2, "0")}.`,
      postedCount,
      totalAmount,
    };
  }

  // ───────────────────────────────────────────────
  // 9. Audit Fisik & Stock Opname via QR (PRD Hal. 13-14)
  // ───────────────────────────────────────────────
  async listAudits() {
    return this.db().faAssetAudit.findMany({
      orderBy: { id: "desc" },
      include: {
        _count: { select: { items: true } },
      },
    });
  }

  async getAudit(id: number) {
    const audit = await this.db().faAssetAudit.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            asset: {
              select: {
                id: true,
                assetCode: true,
                name: true,
                brand: true,
                serialNumber: true,
                condition: true,
                status: true,
                qrCodeKey: true,
                location: true,
                assignedUser: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!audit) throw new NotFoundException(`Audit #${id} tidak ditemukan`);
    return audit;
  }

  async createAudit(dto: CreateAuditDto, user?: any) {
    const code = await this.generateCode("AUD", "fa_asset_audits", "code", 5);
    const auditDate = dateOnly(dto.auditDate) ?? new Date();

    // Filter aset yang akan diaudit
    const assetWhere: any = {
      status: { notIn: ["DISPOSED", "WRITTEN_OFF"] },
    };
    if (dto.department) assetWhere.department = dto.department;
    if (dto.locationId) assetWhere.locationId = dto.locationId;

    const assets = await this.db().faAsset.findMany({
      where: assetWhere,
      select: { id: true, locationId: true, assignedUserId: true, condition: true },
    });

    const audit = await this.db().faAssetAudit.create({
      data: {
        code,
        auditDate,
        title: dto.title,
        department: dto.department,
        locationId: dto.locationId,
        status: "IN_PROGRESS",
        totalAssets: assets.length,
        verifiedAssets: 0,
        discrepancyAssets: 0,
        notes: dto.notes,
        auditorId: user?.id,
      },
    });

    // Populate audit items
    if (assets.length > 0) {
      const items = assets.map((a: any) => ({
        auditId: audit.id,
        assetId: a.id,
        expectedLocationId: a.locationId,
        expectedUserId: a.assignedUserId,
        expectedCondition: a.condition,
        scanStatus: "PENDING",
      }));
      await this.db().faAssetAuditItem.createMany({ data: items });
    }

    return this.getAudit(audit.id);
  }

  async scanAuditItem(auditId: number, dto: AuditScanItemDto, user?: any) {
    const audit = await this.getAudit(auditId);
    if (audit.status === "COMPLETED") {
      throw new BadRequestException("Audit ini sudah selesai dan tidak dapat diubah.");
    }

    const asset = await this.getAssetByQrOrCode(dto.qrCodeOrAssetCode);

    // Cari audit item terkait
    let item = await this.db().faAssetAuditItem.findFirst({
      where: { auditId, assetId: asset.id },
    });

    // Jika aset belum masuk dalam batch audit ini, tambahkan secara dinamis
    if (!item) {
      item = await this.db().faAssetAuditItem.create({
        data: {
          auditId,
          assetId: asset.id,
          expectedLocationId: asset.locationId,
          expectedUserId: asset.assignedUserId,
          expectedCondition: asset.condition,
          scanStatus: "PENDING",
        },
      });
      await this.db().faAssetAudit.update({
        where: { id: auditId },
        data: { totalAssets: { increment: 1 } },
      });
    }

    // Tentukan status hasil scan
    let scanStatus = dto.scanStatus || "VERIFIED";
    const isMoved =
      dto.actualLocationId && dto.actualLocationId !== item.expectedLocationId;
    const isDamaged =
      dto.actualCondition &&
      dto.actualCondition !== item.expectedCondition &&
      (dto.actualCondition === "POOR" || dto.actualCondition === "BROKEN");

    if (isMoved && scanStatus === "VERIFIED") scanStatus = "MOVED";
    if (isDamaged && scanStatus === "VERIFIED") scanStatus = "DAMAGED";

    await this.db().faAssetAuditItem.update({
      where: { id: item.id },
      data: {
        actualLocationId: dto.actualLocationId || item.expectedLocationId,
        actualUserId: dto.actualUserId || item.expectedUserId,
        actualCondition: dto.actualCondition || item.expectedCondition,
        scanStatus,
        scannedAt: new Date(),
        scannedById: user?.id,
        notes: dto.notes,
        photoUrl: dto.photoUrl,
      },
    });

    // Rehitung total verifikasi & selisih
    const items = await this.db().faAssetAuditItem.findMany({ where: { auditId } });
    const verified = items.filter((i: any) => i.scanStatus === "VERIFIED").length;
    const discrepancy = items.filter(
      (i: any) => i.scanStatus !== "PENDING" && i.scanStatus !== "VERIFIED",
    ).length;

    await this.db().faAssetAudit.update({
      where: { id: auditId },
      data: { verifiedAssets: verified, discrepancyAssets: discrepancy },
    });

    return this.getAudit(auditId);
  }

  async completeAudit(auditId: number, user?: any) {
    const audit = await this.getAudit(auditId);
    // Mark items yang masih PENDING sebagai NOT_FOUND
    await this.db().faAssetAuditItem.updateMany({
      where: { auditId, scanStatus: "PENDING" },
      data: { scanStatus: "NOT_FOUND" },
    });

    const items = await this.db().faAssetAuditItem.findMany({ where: { auditId } });
    const verified = items.filter((i: any) => i.scanStatus === "VERIFIED").length;
    const discrepancy = items.filter((i: any) => i.scanStatus !== "VERIFIED").length;

    return this.db().faAssetAudit.update({
      where: { id: auditId },
      data: {
        status: "COMPLETED",
        verifiedAssets: verified,
        discrepancyAssets: discrepancy,
      },
    });
  }

  // ───────────────────────────────────────────────
  // 10. Dashboard & Ringkasan KPI (PRD Hal. 17)
  // ───────────────────────────────────────────────
  async getDashboard() {
    const assets = await this.db().faAsset.findMany({
      select: {
        id: true,
        acquisitionCost: true,
        accumulatedDepreciation: true,
        bookValue: true,
        status: true,
        condition: true,
        department: true,
        warrantyExpiry: true,
        categoryId: true,
        locationId: true,
        category: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });

    let totalCost = 0;
    let totalAccumDep = 0;
    let totalNetBookValue = 0;
    const countByCategory: Record<string, number> = {};
    const countByDepartment: Record<string, number> = {};
    const countByLocation: Record<string, number> = {};

    let underMaintenance = 0;
    let unassigned = 0;
    let damaged = 0;
    let fullyDepreciated = 0;
    let warrantyExpiringSoon = 0;

    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    for (const a of assets) {
      if (a.status !== "DISPOSED" && a.status !== "WRITTEN_OFF") {
        totalCost += Number(a.acquisitionCost);
        totalAccumDep += Number(a.accumulatedDepreciation);
        totalNetBookValue += Number(a.bookValue);

        const catName = a.category?.name || "Lainnya";
        countByCategory[catName] = (countByCategory[catName] || 0) + 1;

        const deptName = a.department || "Tanpa Dept";
        countByDepartment[deptName] = (countByDepartment[deptName] || 0) + 1;

        const locName = a.location?.name || "Tanpa Lokasi";
        countByLocation[locName] = (countByLocation[locName] || 0) + 1;

        if (a.status === "UNDER_MAINTENANCE") underMaintenance++;
        if (a.status === "IDLE" || a.status === "REGISTERED") unassigned++;
        if (a.condition === "POOR" || a.condition === "BROKEN") damaged++;
        if (Number(a.bookValue) <= 0) fullyDepreciated++;

        if (a.warrantyExpiry) {
          const wDate = new Date(a.warrantyExpiry);
          if (wDate >= now && wDate <= in30Days) {
            warrantyExpiringSoon++;
          }
        }
      }
    }

    return {
      overview: {
        totalAssets: assets.length,
        activeAssets: assets.filter((a: any) => a.status !== "DISPOSED" && a.status !== "WRITTEN_OFF").length,
        totalCost,
        totalAccumDep,
        totalNetBookValue,
      },
      attentionCards: {
        warrantyExpiringSoon,
        underMaintenance,
        unassigned,
        damaged,
        fullyDepreciated,
      },
      breakdowns: {
        byCategory: countByCategory,
        byDepartment: countByDepartment,
        byLocation: countByLocation,
      },
    };
  }

  // ───────────────────────────────────────────────
  // 11. Pelaporan (Fixed Asset Register, Mutasi, Disposal, Depresiasi)
  // ───────────────────────────────────────────────
  async getRegisterReport(query: AssetQueryDto) {
    const list = await this.listAssets({ ...query, limit: 1000 });
    return list.data.map((a: any) => ({
      assetCode: a.assetCode,
      name: a.name,
      category: a.category?.name,
      brand: a.brand,
      serialNumber: a.serialNumber,
      acquisitionDate: a.acquisitionDate,
      inServiceDate: a.inServiceDate,
      acquisitionCost: Number(a.acquisitionCost),
      accumulatedDepreciation: Number(a.accumulatedDepreciation),
      netBookValue: Number(a.bookValue),
      usefulLifeMonths: a.usefulLifeMonths,
      condition: a.condition,
      status: a.status,
      department: a.department,
      location: a.location?.name,
      assignedUser: a.assignedUser?.name,
    }));
  }

  async getMovementReport() {
    return this.db().faAssetTransfer.findMany({
      orderBy: { transferDate: "desc" },
      include: {
        asset: { select: { assetCode: true, name: true, brand: true } },
      },
    });
  }

  async getDisposalReport() {
    return this.db().faAssetDisposal.findMany({
      orderBy: { disposalDate: "desc" },
      include: {
        asset: { select: { assetCode: true, name: true, brand: true, category: true } },
      },
    });
  }

  async getDepreciationReport(periodYear?: number, periodMonth?: number) {
    const where: any = { isPosted: true };
    if (periodYear) where.periodYear = periodYear;
    if (periodMonth) where.periodMonth = periodMonth;

    return this.db().faDepreciationSchedule.findMany({
      where,
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      include: {
        asset: { select: { assetCode: true, name: true, category: true } },
      },
    });
  }

  // ───────────────────────────────────────────────
  // 12 Analytical Reports (PRD Section 10)
  // ───────────────────────────────────────────────

  async getAcquisitionReport(query: AssetQueryDto) {
    const list = await this.listAssets({ ...query, limit: 1000 });
    return list.data.map((a: any) => ({
      assetCode: a.assetCode,
      name: a.name,
      category: a.category?.name,
      brand: a.brand,
      acquisitionDate: a.acquisitionDate,
      acquisitionCost: Number(a.acquisitionCost),
      poNumber: a.poNumber,
      source: a.source,
      supplier: a.supplier,
      invoiceNumber: a.invoiceNumber,
      department: a.department,
      location: a.location?.name,
    }));
  }

  async getAssignmentReport() {
    return this.db().faAssetAssignment.findMany({
      orderBy: { assignmentDate: "desc" },
      include: {
        asset: { select: { assetCode: true, name: true, brand: true } },
        assignedToUser: { select: { name: true, email: true } },
      },
    });
  }

  async getAmortizationReport(periodYear?: number, periodMonth?: number) {
    const where: any = {
      isPosted: true,
      asset: { category: { isIntangible: true } },
    };
    if (periodYear) where.periodYear = periodYear;
    if (periodMonth) where.periodMonth = periodMonth;

    return this.db().faDepreciationSchedule.findMany({
      where,
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      include: {
        asset: { select: { assetCode: true, name: true, category: true } },
      },
    });
  }

  async getValuationReport(query: AssetQueryDto) {
    const list = await this.listAssets({ ...query, limit: 1000 });
    return list.data.map((a: any) => ({
      assetCode: a.assetCode,
      name: a.name,
      category: a.category?.name,
      acquisitionCost: Number(a.acquisitionCost),
      accumulatedDepreciation: Number(a.accumulatedDepreciation),
      netBookValue: Number(a.bookValue),
      salvageValue: Number(a.salvageValue || 0),
      condition: a.condition,
      status: a.status,
    }));
  }

  async getBookValueReport(query: AssetQueryDto) {
    const list = await this.listAssets({ ...query, limit: 1000 });
    return list.data.map((a: any) => ({
      assetCode: a.assetCode,
      name: a.name,
      category: a.category?.name,
      department: a.department,
      acquisitionCost: Number(a.acquisitionCost),
      accumulatedDepreciation: Number(a.accumulatedDepreciation),
      netBookValue: Number(a.bookValue),
      depreciationMethod: a.depreciationMethod,
      usefulLifeMonths: a.usefulLifeMonths,
    }));
  }

  async getMaintenanceCostReport(query: AssetQueryDto) {
    const assets = await this.db().faAsset.findMany({
      where: {
        status: { not: "DISPOSED" },
        ...(query.department ? { department: query.department } : {}),
      },
      include: {
        category: { select: { name: true } },
        maintenanceWorkOrders: {
          where: { status: "CLOSED" },
          select: { totalCost: true, totalSparePartCost: true, totalLaborCost: true },
        },
      },
    });

    return assets.map((a: any) => {
      const totalCost = a.maintenanceWorkOrders.reduce(
        (sum: number, w: any) => sum + (Number(w.totalCost) || 0),
        0,
      );
      return {
        assetCode: a.assetCode,
        name: a.name,
        category: a.category?.name,
        department: a.department,
        totalCost,
        servicedCount: a.maintenanceWorkOrders.length,
      };
    });
  }

  async getPhysicalAuditReport() {
    return this.db().faAssetAudit.findMany({
      orderBy: { auditDate: "desc" },
      include: {
        items: {
          include: {
            asset: { select: { assetCode: true, name: true } },
          },
        },
      },
    });
  }

  async getTaxDepreciationReport(periodYear?: number, periodMonth?: number) {
    const schedules = await this.getDepreciationReport(periodYear, periodMonth);
    return schedules.map((s: any) => {
      const commercialDep = Number(s.depreciationAmount || 0);
      // Fiskal / Pajak estimasi berdasarkan PRD (garis lurus tarif pajak)
      const fiscalDep = commercialDep;
      return {
        assetCode: s.asset?.assetCode,
        assetName: s.asset?.name,
        period: `${s.periodYear}-${String(s.periodMonth).padStart(2, "0")}`,
        commercialDepreciation: commercialDep,
        fiscalDepreciation: fiscalDep,
        difference: commercialDep - fiscalDep,
      };
    });
  }

  async getReport(type: string, query: AssetQueryDto & { year?: number; month?: number }) {
    const key = String(type || "register").toLowerCase();
    switch (key) {
      case "register":
        return this.getRegisterReport(query);
      case "acquisition":
        return this.getAcquisitionReport(query);
      case "movement":
        return this.getMovementReport();
      case "assignment":
        return this.getAssignmentReport();
      case "depreciation":
        return this.getDepreciationReport(query.year, query.month);
      case "amortization":
        return this.getAmortizationReport(query.year, query.month);
      case "valuation":
        return this.getValuationReport(query);
      case "book-value":
        return this.getBookValueReport(query);
      case "disposal":
        return this.getDisposalReport();
      case "maintenance-cost":
        return this.getMaintenanceCostReport(query);
      case "physical-audit":
        return this.getPhysicalAuditReport();
      case "tax-depreciation":
        return this.getTaxDepreciationReport(query.year, query.month);
      default:
        return this.getRegisterReport(query);
    }
  }
}
