import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/Ahmad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const source=process.argv[2]||'D:/Codex/leather jacket-20261017T102709Z-1-001/leather jacket/Men leather biker 3 color jacket';
const out=process.argv[3]||'output/motorcycle-jackets-folder-01';
await fs.mkdir(out,{recursive:true});
const names=(await fs.readdir(source)).filter(name=>/\.png$/i.test(name)).sort();
const inventory=[];const cells=[];
for(const [index,name] of names.entries()){
 const file=path.join(source,name);const metadata=await sharp(file).metadata();
 inventory.push({id:index+1,name,source:file,width:metadata.width,height:metadata.height});
 const thumb=await sharp(file).resize(200,230,{fit:'contain',background:'white'}).flatten({background:'white'}).png().toBuffer();
 const label=Buffer.from(`<svg width="200" height="25"><rect width="200" height="25" fill="white"/><text x="8" y="18" font-size="16">Image ${index+1}</text></svg>`);
 cells.push({input:thumb,left:(index%5)*200,top:Math.floor(index/5)*255});
 cells.push({input:label,left:(index%5)*200,top:Math.floor(index/5)*255+230});
}
await sharp({create:{width:1000,height:Math.ceil(names.length/5)*255,channels:3,background:'white'}}).composite(cells).png().toFile(path.join(out,'contact-sheet.png'));
await fs.writeFile(path.join(out,'inventory.json'),JSON.stringify(inventory,null,2));
console.log(JSON.stringify({images:inventory.length,contactSheet:path.resolve(out,'contact-sheet.png'),inventory}));
