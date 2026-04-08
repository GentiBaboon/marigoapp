import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAj6mdkO-0sVr0UUETRSuv3WvTnfuW31O4",
  authDomain: "marigoappcom-v10-6377709-d8775.firebaseapp.com",
  projectId: "marigoappcom-v10-6377709-d8775",
  storageBucket: "marigoappcom-v10-6377709-d8775.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Sign in as admin to get delete permissions
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node scripts/delete-no-photo-products.mjs <admin-email> <admin-password>');
  process.exit(1);
}

async function deleteProductsWithoutPhotos() {
  console.log(`Signing in as ${email}...`);
  await signInWithEmailAndPassword(auth, email, password);
  console.log('Authenticated.\n');

  const productsRef = collection(db, 'products');
  const snapshot = await getDocs(productsRef);

  let deleted = 0;
  let kept = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const images = data.images || [];

    const hasValidImages = images.length > 0 && images.some(img => {
      const url = typeof img === 'string' ? img : img?.url;
      return url && url.startsWith('http');
    });

    if (!hasValidImages) {
      console.log(`Deleting: "${data.title}" (ID: ${docSnap.id}) - no valid photos`);
      await deleteDoc(doc(db, 'products', docSnap.id));
      deleted++;
    } else {
      kept++;
    }
  }

  console.log(`\nDone. Deleted: ${deleted}, Kept: ${kept}`);
  process.exit(0);
}

deleteProductsWithoutPhotos().catch(err => {
  console.error(err);
  process.exit(1);
});
