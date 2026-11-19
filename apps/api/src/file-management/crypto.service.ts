import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

@Injectable()
export class FileCryptoService {
  private readonly logger = new Logger(FileCryptoService.name);
  private keyBuffer: Buffer | null = null;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>("FILE_SECRET_KEY") ?? process.env.FILE_SECRET_KEY;
    if (raw && raw.trim().length > 0) {
      const trimmed = raw.trim();
      if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
        this.keyBuffer = Buffer.from(trimmed, "hex");
      } else if (trimmed.length === 44 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
        this.keyBuffer = Buffer.from(trimmed, "base64");
      } else {
        // Fallback: SHA-256 digest dari string kunci
        this.keyBuffer = createHash("sha256").update(trimmed).digest();
      }
    } else {
      this.logger.warn(
        "FILE_SECRET_KEY tidak diset di .env. Penambahan kredensial storage baru dari UI akan ditolak sampai kunci diisi.",
      );
    }
  }

  isKeyConfigured(): boolean {
    return this.keyBuffer !== null && this.keyBuffer.length === 32;
  }

  /**
   * Enkripsi objek atau string kredensial menggunakan AES-256-GCM
   * Output: "iv_hex:authTag_hex:ciphertext_hex"
   */
  encrypt(data: unknown): string {
    if (!this.keyBuffer) {
      throw new Error(
        "FILE_SECRET_KEY belum dikonfigurasi di .env. Hubungi administrator sistem untuk menambahkan kunci rahasia.",
      );
    }
    const text = typeof data === "string" ? data : JSON.stringify(data);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.keyBuffer, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  /**
   * Dekripsi string terenkripsi AES-256-GCM
   */
  decrypt<T = any>(encryptedPayload: string): T {
    if (!this.keyBuffer) {
      throw new Error("FILE_SECRET_KEY belum dikonfigurasi di .env.");
    }
    const parts = encryptedPayload.split(":");
    if (parts.length !== 3) {
      throw new Error("Format ciphertext tidak valid");
    }
    const [ivHex, authTagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex!, "hex");
    const authTag = Buffer.from(authTagHex!, "hex");
    const decipher = createDecipheriv("aes-256-gcm", this.keyBuffer, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherHex!, "hex")),
      decipher.final(),
    ]);

    const plain = decrypted.toString("utf8");
    try {
      return JSON.parse(plain) as T;
    } catch {
      return plain as unknown as T;
    }
  }
}
