import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  health() {
    return {
      name: "Taska Mini ERP API",
      status: "ok",
      version: "0.1.0",
      time: new Date().toISOString(),
    };
  }
}
