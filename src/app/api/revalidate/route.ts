import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const configuredSecret = process.env.REVALIDATION_SECRET;
    const authHeader = req.headers.get("x-revalidate-secret");
    const querySecret = req.nextUrl.searchParams.get("secret");
    if (configuredSecret && authHeader !== configuredSecret && querySecret !== configuredSecret) {
      return NextResponse.json(
        { revalidated: false, message: "Unauthorized revalidation secret" },
        { status: 401 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const path = body?.path || "/";
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path, timestamp: Date.now() });
  } catch (err: any) {
    return NextResponse.json(
      { revalidated: false, message: err?.message || "Revalidation failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const configuredSecret = process.env.REVALIDATION_SECRET;
    const authHeader = req.headers.get("x-revalidate-secret");
    const querySecret = req.nextUrl.searchParams.get("secret");
    if (configuredSecret && authHeader !== configuredSecret && querySecret !== configuredSecret) {
      return NextResponse.json(
        { revalidated: false, message: "Unauthorized revalidation secret" },
        { status: 401 }
      );
    }
    const path = req.nextUrl.searchParams.get("path") || "/";
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path, timestamp: Date.now() });
  } catch (err: any) {
    return NextResponse.json(
      { revalidated: false, message: err?.message || "Revalidation failed" },
      { status: 500 }
    );
  }
}
