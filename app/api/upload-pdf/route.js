// app/api/upload-pdf/route.js
import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";

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

export async function GET() {
  return NextResponse.json(
    { error: "Method GET not allowed, use POST" },
    { status: 405 }
  );
}

export async function POST(req) {
  try {
    const formData = await req.formData();

    const file = formData.get("pdf");
    const uid = formData.get("uid");
    const filename = formData.get("filename");

    if (!file) {
      return NextResponse.json({ error: "No hay archivo PDF" }, { status: 400 });
    }
    if (!uid || !filename) {
      return NextResponse.json(
        { error: "Faltan campos uid o filename" },
        { status: 400 }
      );
    }

    // Pasar File -> Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const destPath = `clientes/${uid}/${filename}`;

    await bucket.file(destPath).save(buffer, {
      contentType: "application/pdf",
      resumable: false,
    });

    const url = `https://storage.googleapis.com/${process.env.GCP_BUCKET_NAME}/${destPath}`;
    return NextResponse.json({ url });
  } catch (e) {
    console.error("upload-pdf error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
