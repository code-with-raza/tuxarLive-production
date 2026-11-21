import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const input=JSON.parse(await fs.readFile(process.argv[2]||'scripts/catalogue-inputs/motorcycle-folder-01.json','utf8'));
if(!Number.isSafeInteger(input.stockPerSize)||input.stockPerSize<0)throw new Error('Draft stockPerSize must be a known nonnegative integer. This export is not a live inventory feed.');
const out=process.argv[3]||'output/motorcycle-jackets-folder-01';
const inventory=JSON.parse(await fs.readFile(`${out}/inventory.json`,'utf8'));
const active=JSON.parse(await fs.readFile('src/data/products/local-jackets.json','utf8'));
const previousBatchSlugs=new Set(active.products.filter(product=>product.batchId===input.batchId).map(product=>product.slug));
const preservedProducts=active.products.filter(product=>product.batchId!==input.batchId);
const preservedVariants=active.variants.filter(variant=>!previousBatchSlugs.has(variant.productSlug));
const imageDirectory='src/assets/products/local-jacket-import';
await fs.mkdir(imageDirectory,{recursive:true});
const products=[],variants=[],images=[],keywords=[];
for(const colour of input.colours){
 const slug=`mens-${colour.key}-${input.slugDesign||'colour-block'}-leather-${input.slugStyle||'biker'}-jacket`;
 if(preservedProducts.some(product=>product.slug===slug))throw new Error('Slug collision with another batch; refusing to overwrite.');
 const gallery=[];
 const priceGBP=colour.priceGBP??input.priceGBP;
 for(const view of colour.views){
  const original=inventory.find(image=>image.id===view.id);
  if(!original||input.excludedImages.some(image=>image.id===view.id))throw new Error('Missing or excluded image.');
  if(!/\.(png|jpe?g|webp|avif)$/i.test(original.source))throw new Error('Image-only import: video and other media are not allowed.');
  const before=createHash('sha256').update(await fs.readFile(original.source)).digest('hex');
  const target=path.join(imageDirectory,`${slug}-${view.label}.webp`);
  await sharp(original.source).rotate().resize(1000,1250,{fit:'contain',background:'#ffffff',withoutEnlargement:true}).flatten({background:'#ffffff'}).webp({quality:85,effort:4}).toFile(target);
  if(before!==createHash('sha256').update(await fs.readFile(original.source)).digest('hex'))throw new Error('Original image changed unexpectedly.');
  const url='/'+target.replaceAll('\\','/');gallery.push(url);
  images.push({sourceId:view.id,source:original.source,sourceSHA256:before,path:url,alt:`${colour.title} — ${view.label.replaceAll('-',' ')}`,width:1000,height:1250,format:'webp',cloudinaryURL:null});
 }
 const description=`${colour.description} ${input.safetyNote}`;
 products.push({batchId:input.batchId,slug,name:colour.title,tagline:`Genuine leather · ${colour.name} · M–XXL`,category:input.category,priceGBP,currency:'GBP',image:gallery[0],gallery,colors:[{name:colour.name,hex:colour.hex}],sizes:input.sizes,material:input.material,weight:'',rating:0,reviewCount:0,description,specs:[{label:'Material',value:input.material},{label:'Colour',value:colour.name},{label:'Sizes',value:input.sizes.join(', ')},{label:'Design',value:input.style},{label:'Safety',value:input.safetyNote}],inStock:true,collections:input.collection?[input.collection]:[],itemGroupId:input.itemGroupId,seoTitle:colour.seoTitle,seoDescription:colour.seoDescription,cataloguePreview:true});
 for(const size of input.sizes)variants.push({id:`${slug}-${size.toLowerCase()}`,sku:`${input.skuPrefix||'TX-CB'}-${colour.sku}-${size}`,item_group_id:input.itemGroupId,productSlug:slug,title:`${colour.title} — ${size}`,description,product_url:`https://tuxar.co.uk/en/product/${slug}`,image_url:null,local_image_path:gallery[0],availability:input.stockPerSize>0?'in_stock':'out_of_stock',stock:input.stockPerSize,price:`${priceGBP.toFixed(2)} GBP`,sale_price:null,brand:'Tuxar',gender:'male',age_group:'adult',colour:colour.name,size,material:input.material,condition:'new',publishReady:false});
 keywords.push({productSlug:slug,primary:`mens ${colour.name.split(' / ')[0].toLowerCase()} leather ${input.keywordStyle||'biker'} jacket`,secondary:input.keywords||['mens leather biker jacket uk','mens colour block leather jacket','genuine leather biker jacket men','motorcycle inspired leather jacket'],monthlySearchesUK:null,volumeBand:'UNVERIFIED — keyword-tool data required'});
}
const allProducts=[...preservedProducts,...products];
const catalogue={schemaVersion:1,localOnly:true,publishReady:false,currency:'GBP',reviewedFamilies:new Set(allProducts.map(product=>product.batchId)).size,products:allProducts,variants:[...preservedVariants,...variants]};
await fs.writeFile('src/data/products/local-jackets.json',JSON.stringify(catalogue,null,2)+'\n');
await fs.writeFile(`${out}/image-map.json`,JSON.stringify(images,null,2)+'\n');
await fs.writeFile(`${out}/uk-keyword-plan.json`,JSON.stringify(keywords,null,2)+'\n');
await fs.writeFile(`${out}/catalogue-review.json`,JSON.stringify(catalogue,null,2)+'\n');
console.log(JSON.stringify({products:products.length,sizeVariants:variants.length,images:images.length,stockPerSize:input.stockPerSize,totalStock:variants.reduce((sum,v)=>sum+v.stock,0),collection:input.collection,priceGBP:input.priceGBP,networkWrites:0,originalImagesUnchanged:true}));
