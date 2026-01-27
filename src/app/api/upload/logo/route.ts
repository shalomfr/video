import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile } from "fs/promises";
import { join } from "path";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "אין קובץ" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "סוג הקובץ לא נתמך. השתמש ב-PNG, JPG או WebP" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "הקובץ גדול מדי. מקסימום 5MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueSuffix = crypto.randomBytes(8).toString("hex");
    const extension = file.name.split(".").pop();
    const filename = `logo-${uniqueSuffix}.${extension}`;

    // Save file to public/uploads/logos
    const uploadsDir = join(process.cwd(), "public", "uploads", "logos");
    const filepath = join(uploadsDir, filename);

    await writeFile(filepath, buffer);

    // Return URL
    const url = `/uploads/logos/${filename}`;

    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "שגיאה בהעלאת הקובץ" },
      { status: 500 }
    );
  }
}
