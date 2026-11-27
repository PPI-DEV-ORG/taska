import { describe, it, expect } from "vitest";
import { assertSafeUploadedFile, isSafeInlineMime } from "./upload.js";

describe("upload security helpers", () => {
  it("blocks dangerous extensions and MIME types", () => {
    expect(() =>
      assertSafeUploadedFile(Buffer.from("<script>alert(1)</script>"), "evil.html", "text/html"),
    ).toThrow();
    expect(() =>
      assertSafeUploadedFile(Buffer.from("<svg onload=alert(1)></svg>"), "icon.svg", "image/svg+xml"),
    ).toThrow();
    expect(() =>
      assertSafeUploadedFile(Buffer.from("console.log(1)"), "script.js", "application/javascript"),
    ).toThrow();
    expect(() =>
      assertSafeUploadedFile(Buffer.from("<!DOCTYPE html><html></html>"), "fake.txt", "text/plain"),
    ).toThrow();
  });

  it("allows safe business documents and classifies inline MIME safely", () => {
    expect(assertSafeUploadedFile(Buffer.from("%PDF-1.7"), "invoice.pdf", "application/pdf")).toBe(
      "application/pdf",
    );
    expect(isSafeInlineMime("application/pdf")).toBe(true);
    expect(isSafeInlineMime("image/png")).toBe(true);
    expect(isSafeInlineMime("text/html")).toBe(false);
    expect(isSafeInlineMime("image/svg+xml")).toBe(false);
  });
});
