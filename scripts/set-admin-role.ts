#!/usr/bin/env node
/**
 * Set a user's role to super_admin in Firestore.
 *
 * Usage: npx ts-node scripts/set-admin-role.ts genti@eng.al
 *
 * This script uses the Firebase CLI to update the user document.
 * Make sure you're authenticated: npx firebase login
 */

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx ts-node scripts/set-admin-role.ts <email>');
  process.exit(1);
}

const PROJECT_ID = 'marigoappcom-v10-6377709-d8775';

console.log(`
To set ${email} as super_admin, run these Firebase CLI commands:

1. First, find the user's UID by checking Firebase Auth:
   npx firebase auth:export users.json --project ${PROJECT_ID}
   Then search for "${email}" in users.json to find the UID.

2. Then update their Firestore document:
   Open the Firebase Console:
   https://console.firebase.google.com/u/1/project/${PROJECT_ID}/firestore/databases/-default-/data/users/<USER_UID>

   Set the "role" field to "super_admin"

Or use the Firestore REST API with your ID token:

   curl -X PATCH \\
     "https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/<USER_UID>?updateMask.fieldPaths=role" \\
     -H "Authorization: Bearer <YOUR_ID_TOKEN>" \\
     -H "Content-Type: application/json" \\
     -d '{"fields":{"role":{"stringValue":"super_admin"}}}'
`);
