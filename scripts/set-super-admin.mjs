#!/usr/bin/env node
/**
 * Set a user's role to super_admin in Firestore using the REST API.
 *
 * Usage:
 *   node scripts/set-super-admin.mjs <email>
 *
 * Requires: FIREBASE_API_KEY env var or uses the project's API key.
 * The script signs in with the Firebase Auth REST API to get an ID token,
 * then queries Firestore for the user by email and updates their role.
 *
 * Note: This requires the user to exist in Firebase Auth. You'll be
 * prompted for their password.
 */

import readline from 'readline';

const PROJECT_ID = 'marigoappcom-v10-6377709-d8775';
const API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/set-super-admin.mjs <email>');
  process.exit(1);
}

if (!API_KEY) {
  console.error('Set NEXT_PUBLIC_FIREBASE_API_KEY or FIREBASE_API_KEY env var');
  console.error('You can find it in your .env.local file');
  process.exit(1);
}

// Prompt for password
const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
const password = await new Promise((resolve) => {
  rl.question(`Password for ${email}: `, (answer) => {
    rl.close();
    resolve(answer);
  });
});

// 1. Sign in to get ID token
console.log('\nSigning in...');
const authRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  }
);

const authData = await authRes.json();
if (!authRes.ok) {
  console.error('Auth failed:', authData.error?.message || 'Unknown error');
  process.exit(1);
}

const { idToken, localId: uid } = authData;
console.log(`Authenticated as UID: ${uid}`);

// 2. Update user document role to super_admin
console.log(`Setting role to super_admin...`);
const updateRes = await fetch(
  `${FIRESTORE_BASE}/users/${uid}?updateMask.fieldPaths=role`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        role: { stringValue: 'super_admin' },
      },
    }),
  }
);

if (!updateRes.ok) {
  const err = await updateRes.json();
  console.error('Firestore update failed:', err.error?.message || JSON.stringify(err));
  process.exit(1);
}

console.log(`\nDone! ${email} (${uid}) is now a super_admin.`);
console.log(`\nYou can verify at:`);
console.log(`https://console.firebase.google.com/u/1/project/${PROJECT_ID}/firestore/databases/-default-/data/users/${uid}`);
