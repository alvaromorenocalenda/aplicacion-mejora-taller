import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";

// Forzar runtime Node (necesario para GCS)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

const bucket = storage.bucket(process.env.GCP_BUCKET_NAME);

export async function POST(req) {
  try {
    const formData = await req.formData();

    const file = formData.get("pdf");
    const uid = formData.get("uid");
    const filename = formData.get("filename");

    if (!file) {
      return NextResponse.json(
        { error: "No hay archivo PDF" },
        { status: 400 }
      );
    }

    // Convertir a Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const dest = `clientes/${uid}/${filename}`;
    const fileUpload = bucket.file(dest);

    await fileUpload.save(buffer, {
      contentType: "application/pdf",
      resumable: false,
    });

    const url = `https://storage.googleapis.com/${process.env.GCP_BUCKET_NAME}/${dest}`;

    return NextResponse.json({ url });
  } catch (e) {
    console.error("API upload-pdf falló:", e);
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}
