import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  verifyIdToken,
  firestoreGet,
  firestoreUpdate,
} from '@/lib/firebase-admin';

// Same-origin Next.js API route that mirrors the `createStripeConnectedAccount`
// cloud function. Exists so the browser can hit it without the deployed
// Cloud Function's `allUsers` invoker IAM (which is blocked by our org policy).
//
// Auth: expects a Firebase ID token in the `Authorization: Bearer ...` header.
// The user-doc write goes through firestoreUpdate (REST API, using the user's
// token) which respects security rules — the user can only update their own
// document.

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) throw new Error('Stripe secret key not configured.');
  return new Stripe(key, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    let decoded;
    try {
      decoded = await verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired auth token.' }, { status: 401 });
    }

    const uid = decoded.sub;
    const stripe = getStripe();

    const body = await req.json().catch(() => ({}));
    const baseUrl =
      body?.baseUrl ||
      process.env.APP_URL ||
      'https://marigo10.vercel.app';

    const userData = await firestoreGet('users', uid, idToken).catch(() => null);

    // Already has a Connect account → just generate a fresh onboarding link.
    if (userData?.stripeAccountId) {
      const link = await stripe.accountLinks.create({
        account: userData.stripeAccountId,
        refresh_url: `${baseUrl}/profile/seller/onboarding?refresh=true`,
        return_url: `${baseUrl}/profile/seller/onboarding?success=true`,
        type: 'account_onboarding',
      });
      return NextResponse.json({
        accountId: userData.stripeAccountId,
        onboardingUrl: link.url,
      });
    }

    // New account.
    const account = await stripe.accounts.create({
      type: 'express',
      email: userData?.email || undefined,
      metadata: { firebaseUid: uid },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    await firestoreUpdate(
      'users',
      uid,
      { stripeAccountId: account.id, isSeller: true },
      idToken,
    );

    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/profile/seller/onboarding?refresh=true`,
      return_url: `${baseUrl}/profile/seller/onboarding?success=true`,
      type: 'account_onboarding',
    });

    return NextResponse.json({
      accountId: account.id,
      onboardingUrl: link.url,
    });
  } catch (err: any) {
    console.error('create-connected-account error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to create Stripe Connect account.' },
      { status: 500 },
    );
  }
}
