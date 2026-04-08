const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize with default project
initializeApp({ projectId: 'marigoappcom-v10-6377709-d8775' });
const db = getFirestore();

async function deleteProductsWithoutPhotos() {
  const productsRef = db.collection('products');
  const snapshot = await productsRef.get();

  let deleted = 0;
  let kept = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const images = data.images || [];

    // Check if product has valid image URLs
    const hasValidImages = images.length > 0 && images.some(img => {
      const url = typeof img === 'string' ? img : img?.url;
      return url && url.startsWith('http');
    });

    if (!hasValidImages) {
      console.log(`Deleting: "${data.title}" (ID: ${doc.id}) - no valid photos`);
      await doc.ref.delete();
      deleted++;
    } else {
      kept++;
    }
  }

  console.log(`\nDone. Deleted: ${deleted}, Kept: ${kept}`);
}

deleteProductsWithoutPhotos().catch(console.error);
