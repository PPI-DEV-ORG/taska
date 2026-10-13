import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  downloadMediaMessage,
  type proto,
  type WASocket,
  type ConnectionState,
  type WAMessage,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import path from "node:path";
import fs from "node:fs/promises";
import pino from "pino";
import { WhatsappConversationService } from "./whatsapp-conversation.service.js";

export type WaStatus = "DISCONNECTED" | "CONNECTING" | "SCAN_QR" | "CONNECTED";

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private sock: WASocket | null = null;
  private status: WaStatus = "DISCONNECTED";
  private qrCodeDataUrl: string | null = null;
  private connectedPhone: string | null = null;
  private connectedName: string | null = null;
  private authDir: string;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private readonly conversationService: WhatsappConversationService) {
    this.authDir = path.resolve(process.cwd(), "storage", "wa-auth");
  }

  async onModuleInit() {
    await this.initSocket();
  }

  async onModuleDestroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      this.sock?.end(new Error("Module destroyed"));
    } catch {}
  }

  getStatus() {
    return {
      status: this.status,
      qr: this.qrCodeDataUrl,
      connectedPhone: this.connectedPhone,
      connectedName: this.connectedName,
    };
  }

  async getQrDataUrl(): Promise<string | null> {
    return this.qrCodeDataUrl;
  }

  async initSocket() {
    try {
      await fs.mkdir(this.authDir, { recursive: true });
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as [number, number, number],
      }));

      this.status = "CONNECTING";
      this.logger.log(`Memulai WhatsApp Baileys socket (versi: ${version.join(".")})...`);

      const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }) as any,
        printQRInTerminal: false,
        auth: state,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
      });

      this.sock = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr);
            this.status = "SCAN_QR";
            this.logger.log("QR Code baru WhatsApp siap di-scan");
          } catch (err) {
            this.logger.error("Gagal generate QR Code", err);
          }
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          this.status = "DISCONNECTED";
          this.connectedPhone = null;
          this.connectedName = null;
          this.logger.warn(
            `Koneksi WhatsApp terputus (code: ${statusCode}). Reconnect: ${shouldReconnect}`,
          );

          if (shouldReconnect) {
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.initSocket(), 5000);
          } else {
            await this.clearAuth();
            this.reconnectTimer = setTimeout(() => this.initSocket(), 3000);
          }
        } else if (connection === "open") {
          this.status = "CONNECTED";
          this.qrCodeDataUrl = null;
          const userJid = sock.user?.id || "";
          const phone = userJid.split(":")[0]?.replace("@s.whatsapp.net", "") || "";
          this.connectedPhone = phone ? `+${phone}` : null;
          this.connectedName = sock.user?.name || "Bot WhatsApp Taska";
          this.logger.log(`WhatsApp terhubung sebagai ${this.connectedName} (${this.connectedPhone})`);
        }
      });

      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        for (const msg of messages) {
          if (!msg.message || msg.key?.fromMe) continue;
          await this.handleIncomingMessage(msg);
        }
      });
    } catch (err: any) {
      this.logger.error(`Error inisialisasi Baileys: ${err?.message}`, err?.stack);
      this.status = "DISCONNECTED";
    }
  }

  private async handleIncomingMessage(msg: proto.IWebMessageInfo) {
    const remoteJid = msg.key?.remoteJid;
    if (!remoteJid || remoteJid.endsWith("@g.us")) {
      // Abaikan grup WhatsApp untuk laporan privasi teknisi
      return;
    }

    const messageContent = msg.message;
    if (!messageContent) return;

    let text =
      messageContent.conversation ||
      messageContent.extendedTextMessage?.text ||
      messageContent.imageMessage?.caption ||
      messageContent.documentMessage?.caption ||
      "";

    let mediaBuffer: Buffer | null = null;
    let mimeType: string | null = null;
    let isImage = false;

    if (messageContent.imageMessage) {
      isImage = true;
      mimeType = messageContent.imageMessage.mimetype || "image/jpeg";
      try {
        mediaBuffer = (await downloadMediaMessage(
          msg as WAMessage,
          "buffer",
          {},
          {
            logger: pino({ level: "silent" }) as any,
            reuploadRequest: this.sock!.updateMediaMessage,
          },
        )) as Buffer;
      } catch (err) {
        this.logger.error("Gagal download gambar dari WhatsApp", err);
      }
    }

    try {
      await this.conversationService.handleIncomingMessage({
        senderJid: remoteJid,
        senderName: msg.pushName || "Teknisi",
        text: text.trim(),
        mediaBuffer,
        mimeType,
        isImage,
        reply: async (replyText: string) => this.sendMessage(remoteJid, replyText),
        sendPdf: async (buffer: Buffer, fileName: string, caption?: string) =>
          this.sendPdfDocument(remoteJid, buffer, fileName, caption),
      });
    } catch (err: any) {
      this.logger.error(`Error processing conversation for ${remoteJid}: ${err?.message}`);
      await this.sendMessage(
        remoteJid,
        "⚠️ Terjadi kesalahan saat memproses laporan Anda. Silakan coba kirim kembali.",
      );
    }
  }

  async sendMessage(toJid: string, text: string) {
    if (!this.sock || this.status !== "CONNECTED") {
      throw new BadRequestException("WhatsApp bot belum terhubung");
    }
    await this.sock.sendMessage(toJid, { text });
  }

  async sendPdfDocument(toJid: string, buffer: Buffer, fileName: string, caption?: string) {
    if (!this.sock || this.status !== "CONNECTED") {
      throw new BadRequestException("WhatsApp bot belum terhubung");
    }
    await this.sock.sendMessage(toJid, {
      document: buffer,
      mimetype: "application/pdf",
      fileName,
      caption,
    });
  }

  async restart(): Promise<{ message: string }> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      this.sock?.end(new Error("Restart requested"));
    } catch {}
    this.status = "CONNECTING";
    setTimeout(() => this.initSocket(), 1500);
    return { message: "Koneksi WhatsApp sedang dimuat ulang" };
  }

  async logout(): Promise<{ message: string }> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      await this.sock?.logout();
    } catch {}
    await this.clearAuth();
    this.status = "DISCONNECTED";
    this.connectedPhone = null;
    this.connectedName = null;
    this.qrCodeDataUrl = null;
    setTimeout(() => this.initSocket(), 1500);
    return { message: "WhatsApp bot berhasil logout, QR baru akan segera dibuat" };
  }

  private async clearAuth() {
    try {
      await fs.rm(this.authDir, { recursive: true, force: true });
    } catch {}
  }
}

