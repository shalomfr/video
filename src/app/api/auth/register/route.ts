import { NextResponse } from "next/server";

export async function POST() {
  // Registration is currently disabled
  return NextResponse.json(
    { error: "ההרשמה סגורה כרגע" },
    { status: 403 }
  );
}
