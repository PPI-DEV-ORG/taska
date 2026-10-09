import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { IsString, MinLength } from "class-validator";

class CancelDto {
  @IsString() @MinLength(3)
  reason: string;
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
    const table = (head: string[], body: string[][]) => ({
      table: {
        headerRows: 1,
        widths: ["*", "*", "*", "*"],
        body: [head, ...body],
      },
      layout: "lightHorizontalLines",
    });
    return {
      pageSize: "A4",
      pageMargins: [40, 50, 40, 50],
      content: [
        { text: d.company, fontSize: 14, bold: true, alignment: "center" },
        { text: "SURAT JALAN", fontSize: 18, bold: true, alignment: "center", margin: [0, 4, 0, 2] },
        { text: d.number, fontSize: 11, alignment: "center", margin: [0, 0, 0, 12] },
        {
          columns: [
            [{ text: `Tanggal: ${d.date}` }, { text: `Pembuat: ${d.creator}` }],
            [{ text: `Status: ${d.status}` }, { text: `Persetujuan: ${d.approval}` }],
          ],
          margin: [0, 0, 0, 10],
        },
        { text: "Lokasi / Tujuan", bold: true, margin: [0, 4, 0, 4] },
        table(["No", "Tujuan", "Alasan", "Project"], d.locations),
        ...(d.withGoods
          ? [
              { text: "Barang yang dibawa (Serial Number)", bold: true, margin: [0, 12, 0, 4] } as never,
              table(["No", "SN", "Produk", "Gudang Asal"], d.goods),
            ]
          : []),
        ...(d.reportText
          ? [{ text: "Laporan Hasil", bold: true, margin: [0, 12, 0, 4] } as never, { text: d.reportText } as never]
          : []),
        {
          columns: [
            { text: `Pembuat,\n\n\n${d.creator}`, width: "45%" },
            { text: "Mengetahui (Finance/Bos),\n\n\n", width: "45%" },
          ],
          margin: [0, 30, 0, 0],
        },
      ],
    };
  }

  @Post()
  @Require("delivery", "C")
  create(@Body() dto: DeliveryCreateDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
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
    return this.service.cancel(id, dto.reason, user);
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
}
