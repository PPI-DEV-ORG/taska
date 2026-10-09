import pdfmake from "pdfmake";

let ready = false;

function ensureFonts(): void {
  if (ready) return;
  // Font bawaan pdfmake ("Helvetica-Bold", dll) diverifikasi sebagai path lokal —
  // izinkan nama font polos, tolak path apa pun.
  pdfmake.setLocalAccessPolicy((path) => !/[/\\]/.test(path));
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.addFonts({
    Helvetica: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
  });
  ready = true;
}

/** Render docDefinition pdfmake menjadi Buffer PDF. */
export async function renderPdf(docDefinition: Record<string, unknown>): Promise<Buffer> {
  ensureFonts();
  const doc = pdfmake.createPdf({ defaultStyle: { font: "Helvetica" }, ...docDefinition });
  return (await doc.getBuffer()) as Buffer;
}
