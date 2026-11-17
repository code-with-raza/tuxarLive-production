import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {configureFolder,cloudinaryCredentials,checkCloudinary} from '../../scripts/ci/cloudinary-check.mjs';
import {uploadImage} from '../../scripts/ci/catalogue.mjs';

const env={CLOUDINARY_CLOUD_NAME:'test-cloud',CLOUDINARY_API_KEY:'restricted-key',CLOUDINARY_API_SECRET:'restricted-secret',CLOUDINARY_SETUP_API_KEY:'setup-key',CLOUDINARY_SETUP_API_SECRET:'setup-secret'};
const reply=data=>({ok:true,json:async()=>data});

test('dynamic uploads sign the asset folder; fixed uploads preserve their original public-ID path',async()=>{
  for(const folderMode of ['dynamic','fixed']) {
    await uploadImage(Buffer.from('test'),{...cloudinaryCredentials(env),folderMode},async(_,options)=>{
      const body=options.body;
      assert.equal(body.get('asset_folder'),folderMode==='dynamic'?'tuxar/ci':null);
      assert.equal(body.get('overwrite'),'false');
      const signed=[...body.entries()].filter(([key])=>!['file','api_key','signature'].includes(key)).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join('&');
      assert.equal(body.get('signature'),createHash('sha1').update(signed+env.CLOUDINARY_API_SECRET).digest('hex'));
      return reply({public_id:body.get('public_id'),secure_url:`https://res.cloudinary.com/test-cloud/image/upload/v1/${body.get('public_id')}.png`});
    });
  }
  await assert.rejects(uploadImage(Buffer.from('test'),{...cloudinaryCredentials(env),folderMode:'unknown'}),/folder mode/);
});

test('one-time setup grants only folder Contributor to the restricted key, including paginated lookup',async()=>{
  const calls=[];
  const credentials=await configureFolder(env,async(endpoint,options)=>{
    assert.equal(options.redirect,'error');
    assert.equal(options.headers.Authorization,'Basic '+Buffer.from('setup-key:setup-secret').toString('base64'));
    calls.push([endpoint,options]);
    if(endpoint.endsWith('/config?settings=true')) return reply({settings:{folder_mode:'dynamic'}});
    if(endpoint.endsWith('/folders/tuxar?max_results=500')) return reply({folders:[],next_cursor:'page2'});
    if(endpoint.endsWith('&next_cursor=page2')) return reply({folders:[{path:'tuxar/ci',external_id:'immutable-folder'}]});
    return reply({success:true});
  });
  const [endpoint,options]=calls.at(-1);
  assert.ok(endpoint.endsWith('/folder_operations/invite/immutable-folder'));
  assert.deepEqual(JSON.parse(options.body),{principal:{id:'restricted-key',type:'apiKey'},operation:'add',roles:['cld::role::folder::contributor']});
  assert.equal(credentials.apiKey,'restricted-key');
  assert.ok(calls.every(([,options])=>options.method!=='DELETE'));
});

test('setup stops before writes for wrong folder mode or missing privileged credentials',async()=>{
  let calls=0;
  await assert.rejects(configureFolder({...env,CLOUDINARY_SETUP_API_KEY:''}),/temporary administrator/);
  await assert.rejects(configureFolder({...env,CLOUDINARY_SETUP_API_KEY:env.CLOUDINARY_API_KEY}),/temporary administrator/);
  await assert.rejects(configureFolder(env,async()=>{calls++;return reply({settings:{folder_mode:'fixed'}});}),/CLOUDINARY_FOLDER_MODE.*fixed/);
  assert.equal(calls,1);
  await assert.rejects(configureFolder(env,async()=>({ok:false,status:403,json:async()=>{throw new Error('Do not read private response');}})),/HTTP 403/);
});

test('Cloudinary check uploads a reusable probe and verifies delivery, with no product/database requests',async()=>{
  const calls=[];
  const fetcher=async(endpoint,options)=>{
    calls.push([endpoint,options.method]);
    if(options.method==='POST') {
      const bytes=Buffer.from(await options.body.get('file').arrayBuffer());
      assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      for(let offset=8;offset<bytes.length;) {
        const size=bytes.readUInt32BE(offset);
        let crc=0xffffffff;
        for(const byte of bytes.subarray(offset+4,offset+8+size)) {
          crc^=byte;
          for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);
        }
        assert.equal((crc^0xffffffff)>>>0,bytes.readUInt32BE(offset+8+size));
        if(bytes.toString('ascii',offset+4,offset+8)==='IDAT') assert.equal(inflateSync(bytes.subarray(offset+8,offset+8+size)).length,3);
        offset+=12+size;
      }
      return reply({public_id:options.body.get('public_id'),secure_url:`https://res.cloudinary.com/test-cloud/image/upload/v1/${options.body.get('public_id')}.png`});
    }
    return {ok:true,headers:new Headers({'content-type':'image/png'})};
  };
  await checkCloudinary(cloudinaryCredentials(env),fetcher);
  await checkCloudinary(cloudinaryCredentials(env),fetcher);
  assert.equal(calls.length,4);
  assert.equal(calls[1][0],calls[3][0]);
  assert.equal(calls[1][1],'HEAD');
  assert.throws(()=>cloudinaryCredentials({...env,CLOUDINARY_API_SECRET:''}),/matching API/);
});
