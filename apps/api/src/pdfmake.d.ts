declare module "pdfmake" {
  interface PdfOutput {
    getBuffer(): Promise<Buffer>;
  }
  interface PdfmakeInstance {
    setLocalAccessPolicy(cb: (path: string) => boolean): void;
    setUrlAccessPolicy(cb: (url: string) => boolean): void;
    addFonts(fonts: Record<string, Record<string, string>>): void;
    createPdf(docDefinition: Record<string, unknown>): PdfOutput;
  }
  const pdfmake: PdfmakeInstance;
  export default pdfmake;
}
