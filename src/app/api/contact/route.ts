import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, subject, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    // In production, log contact inquiries or dispatch email notification
    console.log(`[Contact Form] From: ${name} <${email}> | Subject: ${subject || "General Inquiry"}`);

    return NextResponse.json({
      success: true,
      message: "Thank you! Your message has been received.",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to process message." },
      { status: 500 }
    );
  }
}
