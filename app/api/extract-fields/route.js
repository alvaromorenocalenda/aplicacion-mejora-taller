// app/api/extract-fields/route.js
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

export async function GET() {
  const pdfPath = path.join(process.cwd(), "public", "cuestionario_cliente_formulario.pdf");
  const buf = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(buf);
  const form = doc.getForm();
  const fields = form.getFields().map(f => ({
    name: f.getName(),
    type: f.constructor.name,   // PDFTextField, PDFCheckBox, etc.
  }));
  return new Response(JSON.stringify(fields), {
    headers: { "Content-Type": "application/json" },
  });
}
