// scripts/inspect-vector-index.ts
import { qdrant, COLLECTION } from '../lib/useVectorDB';

async function main() {
  console.log(`🔍 Inspecting collection: ${COLLECTION}`);

  const info = await qdrant.getCollection(COLLECTION);
  console.log(`✅ Collection status: ${info.status}`);
  console.log(`📦 Vectors: ${info.vectors_count}`);
  console.log(`📐 Vector size: ${info.config?.params?.vectors?.size}`);

  const scroll = await qdrant.scroll(COLLECTION, {
    limit: 10,
    with_vector: false,
    with_payload: true,
  });

  console.log('\n🧱 Top 10 Entries:');
  scroll.points.forEach((p, i) => {
    const payload = p.payload as any;
    console.log(`\n#${i + 1}`);
    console.log(`ID:     ${p.id}`);
    console.log(`Type:   ${payload?.type}`);
    console.log(`Tone:   ${payload?.tone}`);
    console.log(`Text:   ${payload?.text?.slice(0, 100)}...`);
  });
}

main().catch((err) => {
  console.error('❌ Error:', err);
});
