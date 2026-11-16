import fs from 'node:fs/promises';
const batches=new Set(['motorcycle-jackets-folder-01','motorcycle-jackets-folder-02']);
const activePath='src/data/products/local-jackets.json';
const catalogue=JSON.parse(await fs.readFile(activePath,'utf8'));
let moved=0;
for(const product of catalogue.products){
 if(!batches.has(product.batchId))continue;
 if(!product.gallery.every(image=>/\.webp$/i.test(image)))throw new Error('Expected image-only WebP galleries; stop before editing.');
 product.collections=['biker-jackets'];
 moved++;
}
if(moved!==14)throw new Error('Unexpected target count; no file written.');
await fs.writeFile(activePath,JSON.stringify(catalogue,null,2)+'\n');
// Refresh generated batch snapshots, preserving all variants and source media.
for(const [batchId,out] of [['motorcycle-jackets-folder-01','output/motorcycle-jackets-folder-01'],['motorcycle-jackets-folder-02','output/motorcycle-jackets-folder-02']]){
 const snapshot=JSON.parse(await fs.readFile(`${out}/catalogue-review.json`,'utf8'));
 for(const product of snapshot.products)if(batches.has(product.batchId))product.collections=['biker-jackets'];
 await fs.writeFile(`${out}/catalogue-review.json`,JSON.stringify(snapshot,null,2)+'\n');
}
console.log(JSON.stringify({movedColourways:moved,collection:'biker-jackets',media:'WebP images only',websiteTestsRun:false,remoteWrites:0}));
