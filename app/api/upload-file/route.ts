import { NextRequest, NextResponse } from "next/server";
import { uploadFile, getSignedUrlFromGCS } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";
import logger from "@/app/logger";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.name.split(".").pop();
    const filename = `${uuidv4()}.${extension}`;
    const contentType = file.type;

    const gcsUri = await uploadFile(buffer, filename, contentType);

    if (!gcsUri) {
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    const signedUrl = await getSignedUrlFromGCS(gcsUri);

    return NextResponse.json({ gcsUri, signedUrl, fileName: file.name });
  } catch (error) {
    logger.error("Error in upload-file route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
