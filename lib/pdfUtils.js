// lib/pdfUtils.js
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

export async function extractPdfFields() {
  const bytes = fs.readFileSync(path.join(process.cwd(), 'public/checklist_formulario.pdf'));
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  return form.getFields().map(f => {
    const name = f.getName();
    const rect = f.acroField.dict.get('Rect').array.map(n => n.number);
    const [x1,y1,x2,y2] = rect;
    return { name, type: f.constructor.name, x: x1, y: y1, width: x2-x1, height: y2-y1 };
  });
}

export async function fillPdf(origBytes, values) {
  const pdf = await PDFDocument.load(origBytes);
  const form = pdf.getForm();
  Object.entries(values).forEach(([key, val]) => {
    const field = form.getFieldMaybe(key);
    if (!field) return;
    if (field.constructor.name === 'PDFTextField') field.setText(val||'');
    if (field.constructor.name === 'PDFCheckBox') val ? field.check() : field.uncheck();
  });
  return pdf.save();
}
