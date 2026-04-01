import { NextRequest, NextResponse } from 'next/server';
import { sendPasswordResetMail } from '@/lib/mailtrap';

const FUNCTIONS_BASE = `https://europe-west1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net`;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const serviceSecret = process.env.RESET_SERVICE_SECRET;
    if (!serviceSecret) {
      console.error('RESET_SERVICE_SECRET not configured');
      return NextResponse.json({ error: 'Service not configured.' }, { status: 500 });
    }

    // Call Firebase Function (which has Admin SDK) to generate the OOB reset link
    const fnRes = await fetch(`${FUNCTIONS_BASE}/sendPasswordResetLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase().trim(), serviceSecret }),
    });

    const fnData = await fnRes.json();

    if (!fnRes.ok) {
      console.error('Firebase Function error:', fnData);
      return NextResponse.json({ error: 'Failed to generate reset link.' }, { status: 500 });
    }

    // If the link was generated (user exists), send our branded email via Mailtrap
    if (fnData.link) {
      sendPasswordResetMail({ email, resetLink: fnData.link }).catch(console.error);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('forgot-password error:', err);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
