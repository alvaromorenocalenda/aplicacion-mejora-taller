// app/api/upload-pdf/route.js
import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import formidable from "formidable";

export const config = {
  api: {
    bodyParser: false, // deshabilitamos el bodyParser para parsear FormData
  },
};

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    // Quita las comillas envolventes aquí; NEXT _ya_ las carga con \n
    private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
});
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME);

export async function GET() {
  // En lugar de caer al HTML de Next, devolvemos un 405
  return NextResponse.json(
    { error: "Method GET not allowed, use POST" },
    { status: 405 }
  );
}

export async function POST(req) {
  // parsear multipart/form-data
  const form = new formidable.IncomingForm();
  const { fields, files } = await new Promise((res, rej) => {
    form.parse(req, (err, fields, files) => (err ? rej(err) : res({ fields, files })));
  });

  const file = files.pdf;
  if (!file) {
    return NextResponse.json({ error: "No hay archivo PDF" }, { status: 400 });
  }

  const destPath = `clientes/${fields.uid}/${fields.filename}`;
  try {
    // subir
    await bucket.upload(file.filepath, {
      destination: destPath,
      metadata: { contentType: "application/pdf" },
    });
    // NO llames a makePublic si tienes Uniform bucket-level access activado
    // await bucket.file(destPath).makePublic();

    const url = `https://storage.googleapis.com/${process.env.GCP_BUCKET_NAME}/${destPath}`;
    return NextResponse.json({ url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
