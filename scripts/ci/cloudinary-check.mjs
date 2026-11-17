import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {uploadImage,verifyImageUrl} from './catalogue.mjs';

// A single tiny public diagnostic image, reused on every run with overwrite=false.
// Never attach it to a product or delete/replace an existing asset.
const probe=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64');
const folder='tuxar/ci';

export function cloudinaryCredentials(env) {
  const result={cloudName:env.CLOUDINARY_CLOUD_NAME,apiKey:env.CLOUDINARY_API_KEY,apiSecret:env.CLOUDINARY_API_SECRET,folderMode:env.CLOUDINARY_FOLDER_MODE||'dynamic'};
  if(!/^[a-z0-9_-]+$/i.test(result.cloudName??'') || !result.apiKey || !result.apiSecret) throw new Error('Set the Cloudinary cloud-name variable and matching API-key/API-secret secrets');
  if(!['dynamic','fixed'].includes(result.folderMode)) throw new Error('CLOUDINARY_FOLDER_MODE must be dynamic or fixed');
  return result;
}

export async function configureFolder(env,fetcher=fetch) {
  const credentials=cloudinaryCredentials(env);
  const adminKey=env.CLOUDINARY_SETUP_API_KEY,adminSecret=env.CLOUDINARY_SETUP_API_SECRET;
  if(!adminKey || !adminSecret || adminKey===credentials.apiKey) throw new Error('Folder setup requires separate temporary administrator credentials; keep the deployment key restricted');
  const base=`https://api.cloudinary.com/v1_1/${credentials.cloudName}`;
  const headers={Authorization:`Basic ${Buffer.from(`${adminKey}:${adminSecret}`).toString('base64')}`,'Content-Type':'application/json'};
  const request=async (route,options={})=>{
    const response=await fetcher(base+route,{...options,headers,redirect:'error',signal:AbortSignal.timeout(30000)});
    // Do not log provider responses: configuration/permission responses may contain credentials.
    if(!response.ok) throw new Error(`Cloudinary folder setup failed (HTTP ${response.status}); check the temporary administrator credentials and folder permissions`);
    return response.json();
  };
  const config=await request('/config?settings=true');
  const actualMode=config.settings?.folder_mode;
  if(!['dynamic','fixed'].includes(actualMode)) throw new Error('Cloudinary did not return a supported folder mode');
  if(actualMode!==credentials.folderMode) throw new Error(`Set the CLOUDINARY_FOLDER_MODE environment variable to ${actualMode}, then rerun setup`);
  const findFolder=async (parent,target)=>{
    let cursor;
    const seen=new Set();
    do {
      const result=await request(`/folders${parent?'/'+parent:''}?max_results=500`+(cursor?`&next_cursor=${encodeURIComponent(cursor)}`:''));
      const match=result.folders?.find(item=>item.path===target);
      if(match) return match;
      cursor=result.next_cursor;
      if(cursor && seen.has(cursor)) throw new Error('Cloudinary folder listing returned a repeated page');
      seen.add(cursor);
    } while(cursor);
  };
  if(!await findFolder('','tuxar')) await request('/folders/tuxar',{method:'POST'});
  let target=await findFolder('tuxar',folder);
  if(!target) {
    await request('/folders/tuxar/ci',{method:'POST'});
    target=await findFolder('tuxar',folder);
  }
  const externalId=target?.external_id;
  if(!externalId) throw new Error('The deployment folder could not be identified; no permission grant was made');
  await request(`/folder_operations/invite/${encodeURIComponent(externalId)}`,{
    method:'POST',body:JSON.stringify({principal:{id:credentials.apiKey,type:'apiKey'},operation:'add',roles:['cld::role::folder::contributor']}),
  });
  return credentials;
}

export async function checkCloudinary(credentials,fetcher=fetch) {
  const url=await uploadImage(probe,credentials,fetcher);
  await verifyImageUrl(url,fetcher);
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const credentials=process.argv.includes('--setup') ? await configureFolder(process.env) : cloudinaryCredentials(process.env);
    await checkCloudinary(credentials);
    console.log('Cloudinary signed upload and public image delivery verified in tuxar/ci. No product records changed.');
    if(process.argv.includes('--setup')) console.log('Folder contributor access configured. Remove CLOUDINARY_SETUP_API_KEY and CLOUDINARY_SETUP_API_SECRET from GitHub now.');
  } catch(error) { console.error(error.message);process.exitCode=1; }
}
