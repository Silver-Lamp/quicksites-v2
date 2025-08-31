import { syncOpenAIPrices } from '@/lib/ai/pricing-sync/openaiSync';
syncOpenAIPrices().then(r => {
  console.log('Sync result:', r);
}).catch(e => {
  console.error(e);
  process.exitCode = 1;
});
