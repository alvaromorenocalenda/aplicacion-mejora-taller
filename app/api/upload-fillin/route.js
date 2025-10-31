import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import formidable from "formidable-serverless";

// 1) Forzar Node runtime
export const runtime = "nodejs";
// 2) Deshabilitamos bodyParser
export const config = {
  api: { bodyParser: false, externalResolver: true },
};

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
});
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME);

export async function POST(req) {
  try {
    // Parse multipart
    const form = new formidable.IncomingForm();
    const { fields, files } = await new Promise((res, rej) =>
      form.parse(req, (err, fields, files) => (err ? rej(err) : res({ fields, files })))
    );

    // Validar PDF
    const file = files.pdf;
    if (!file) {
      return NextResponse.json({ error: "No hay archivo PDF" }, { status: 400 });
    }

    // Ruta destino en el bucket
    const dest = `clientes/${fields.uid}/${fields.filename}`;

    // Subir
    await bucket.upload(file.filepath, {
      destination: dest,
      metadata: { contentType: "application/pdf" },
    });

    // URL pública
    const url = `https://storage.googleapis.com/${process.env.GCP_BUCKET_NAME}/${dest}`;

    return NextResponse.json({ url });
  } catch (e) {
    console.error("API upload-pdf falló:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
