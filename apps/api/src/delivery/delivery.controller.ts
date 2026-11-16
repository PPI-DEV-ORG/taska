import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from "@nestjs/common";
import { DeliveryService } from "./delivery.service.js";
import {
  DeliveryCreateDto,
  DeliveryListQuery,
  DeliveryReportDto,
  DeliveryStatusDto,
  GoodsDto,
} from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { renderPdf } from "../common/pdf.js";
import { IsOptional, IsString } from "class-validator";

class CancelDto {
  @IsOptional() @IsString()
  reason?: string;
}

@Controller("delivery-notes")
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  @Get()
  @Require("delivery", "L")
  list(@Query() q: DeliveryListQuery) {
    return this.service.list(q);
  }

  @Get("suggest-number")
  @Require("delivery", "C")
  suggestNumber() {
    return this.service.suggestNumber();
  }

  @Get(":id")
  @Require("delivery", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Get(":id/pdf")
  @Require("delivery", "L")
  async pdf(@Param("id", ParseIntPipe) id: number): Promise<StreamableFile> {
    const data = await this.service.toPdf(id);
    const buffer = await renderPdf(this.pdfDefinition(data));
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="surat-jalan-${data.number}.pdf"`,
    });
  }

  private pdfDefinition(d: Awaited<ReturnType<DeliveryService["toPdf"]>>): Record<string, unknown> {
    const label = (t: string) => ({ text: t, color: "#666666", fontSize: 8 });
    const value = (t: string | null | undefined) => ({ text: t || "-", fontSize: 10, bold: true, margin: [0, 0, 0, 6] });
    const sign = (title: string, name: string, role: string) => ({
      width: "*",
      stack: [
        { text: title, alignment: "center", fontSize: 9, bold: true },
        { text: " ", margin: [0, 0, 0, 46] },
        { canvas: [{ type: "line", x1: 10, y1: 0, x2: 150, y2: 0, lineWidth: 0.7 }], alignment: "center" },
        { text: name || "(.................................)", alignment: "center", fontSize: 9, margin: [0, 3, 0, 0] },
        { text: role, alignment: "center", fontSize: 8, color: "#666666" },
      ],
    });
    const goodsTable = {
      table: {
        headerRows: 1,
        widths: [24, "*", 90, 40, 50],
        body: [
          ["No", "Nama Barang", "SKU", "Qty", "Satuan"].map((h) => ({ text: h, bold: true, fontSize: 9, fillColor: "#eeeeee" })),
          ...(d.goods.length
            ? d.goods.map((r) => r.map((c, i) => ({ text: c, fontSize: 9, alignment: i === 0 || i === 3 ? "center" : "left" })))
            : [[{ text: d.withGoods ? "Daftar barang belum diisi" : "Tanpa barang (penugasan)", colSpan: 5, fontSize: 9, italics: true, color: "#666666" }, "", "", "", ""]]),
        ],
      },
      layout: { hLineColor: () => "#bbbbbb", vLineColor: () => "#bbbbbb" },
    };
    return {
      pageSize: "A4",
      pageMargins: [36, 36, 36, 40],
      content: [
        {
          columns: [
            { stack: [{ text: d.company.name, fontSize: 14, bold: true }, { text: [d.company.address, d.company.phone].filter(Boolean).join(" · "), fontSize: 8, color: "#555555" }] },
            { stack: [{ text: "SURAT JALAN", fontSize: 18, bold: true, alignment: "right" }, { text: d.number, fontSize: 10, alignment: "right" }] },
          ],
        },
        { canvas: [{ type: "line", x1: 0, y1: 6, x2: 523, y2: 6, lineWidth: 1.2 }], margin: [0, 0, 0, 12] },
        {
          columns: [
            { width: "*", stack: [label("Tanggal"), value(d.date), label("Referensi"), value(d.reference), label("Proyek"), value(d.project)] },
            {
              width: "*",
              stack: [
                label("Kirim ke"),
                value(d.destination),
                label("Keperluan"),
                value(d.reason),
                label("Penerima"),
                value([d.recipient, d.recipientTitle && `(${d.recipientTitle})`, d.recipientPhone].filter(Boolean).join(" ")),
              ],
            },
            {
              width: "*",
              stack: [label("Gudang asal"), value(d.warehouse), label("Pengirim"), value(d.sender), label(d.vehicleLabel), value(d.vehicleNo)],
            },
          ],
        },
        ...(d.extraLocations.length ? [{ text: `Lokasi lain: ${d.extraLocations.join("; ")}`, fontSize: 9, margin: [0, 0, 0, 6] }] : []),
        { text: "Daftar Barang", bold: true, fontSize: 10, margin: [0, 6, 0, 4] },
        goodsTable,
        {
          text: "Barang telah diterima dalam keadaan baik dan lengkap. Mohon periksa barang sebelum menandatangani.",
          fontSize: 8,
          color: "#555555",
          margin: [0, 8, 0, 18],
        },
        {
          columns: [
            sign("Dikeluarkan oleh", d.warehouseStaff, d.warehouse ? (/^gudang/i.test(d.warehouse) ? d.warehouse : `Gudang ${d.warehouse}`) : "Petugas Gudang"),
            sign("Dikirim oleh", d.sender, d.senderTitle),
            sign("Diterima oleh", d.recipient, d.recipientTitle || "Penerima"),
          ],
          columnGap: 12,
        },
        {
          text: d.receivedAt ? `Diterima pada ${d.receivedAt}` : "Tanggal & jam terima: ...................................",
          fontSize: 8,
          alignment: "right",
          margin: [0, 10, 0, 0],
        },
      ],
    };
  }

  @Post()
  @Require("delivery", "C")
  create(@Body() dto: DeliveryCreateDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("delivery", "U")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: DeliveryCreateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/goods")
  @Require("delivery", "U")
  prepareGoods(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: GoodsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.prepareGoods(id, dto, user);
  }

  @Post(":id/status")
  @Require("delivery", "U")
  setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: DeliveryStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.setStatus(id, dto, user);
  }

  @Post(":id/cancel")
  @Require("delivery", "C")
  cancel(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CancelDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.cancel(id, dto.reason ?? "Dibatalkan", user);
  }

  @Post(":id/report")
  @Require("delivery", "C")
  report(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: DeliveryReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.report(id, dto, user);
  }

  @Delete(":id")
  @Require("delivery", "U")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
