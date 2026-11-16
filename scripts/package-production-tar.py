"""Package only reviewed public build files; leave sources and secrets outside hosting."""
import datetime, hashlib, json, pathlib, re, shutil, sys, tarfile

root = pathlib.Path(__file__).resolve().parent.parent
name = sys.argv[1]
if not re.fullmatch(r'[a-z0-9-]+', name):
    raise ValueError('Use a lowercase release name with hyphens')
dist = root / 'dist'
release = root / 'output' / 'releases' / name
archive = root / (name + '.tar.gz')
if release.exists() or archive.exists():
    raise ValueError('Release already exists; choose a new name')
scan = json.loads((root / 'output/security/secret-scan.json').read_text(encoding='utf-8-sig'))
age = datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(scan['scannedAt'].replace('Z', '+00:00'))
if scan['findings'] or not datetime.timedelta(0) <= age <= datetime.timedelta(minutes=60):
    raise ValueError('Fresh successful secret scan required')
allowed = re.compile(r'(?:\.htaccess|index\.html|legacy-not-found\.html|consent-default\.js|favicon\.svg|robots\.txt|sitemap\.xml|llms\.txt|size-charts/(?:mens|womens)-jackets\.webp|prerender-home/(?:en|it|de|fr|es)\.html|prerender-pages/(?:en|it|de|fr|es)/(?:[a-z0-9-]+/)+index\.html|(?:assets|blog_images)/[^\s]+\.(?:js|mjs|css|svg|png|jpe?g|webp|avif|gif|woff2?|ttf|ico))')
required = {'.htaccess','index.html','robots.txt','sitemap.xml','legacy-not-found.html','consent-default.js','llms.txt'} | {f'prerender-home/{locale}.html' for locale in ['en','de','es','fr','it']}
files = []
for path in sorted(dist.rglob('*')):
    if path.is_symlink() or path.is_junction():
        raise ValueError(f'Link rejected: {path}')
    if not path.is_file():
        continue
    relative = path.relative_to(dist).as_posix()
    if not allowed.fullmatch(relative):
        raise ValueError(f'Unexpected build file: {relative}')
    files.append({'path': relative, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest().upper()})
if not required <= {item['path'] for item in files}:
    raise ValueError('Missing required public files')
unpacked = release / 'website-files'
unpacked.mkdir(parents=True)
for item in files:
    source, target = dist / item['path'], unpacked / item['path']
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    if hashlib.sha256(target.read_bytes()).hexdigest().upper() != item['sha256']:
        raise ValueError(f'Copy hash mismatch: {target}')
with tarfile.open(archive, 'w:gz', format=tarfile.PAX_FORMAT) as bundle:
    for item in files:
        bundle.add(unpacked / item['path'], arcname=item['path'], recursive=False)
manifest = {'status':'Verified frontend files; hosting deployment unconfirmed', 'archive':str(archive), 'unpacked':str(unpacked), 'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(), 'files':files}
(release / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps({'archive':str(archive),'files':len(files),'bytes':archive.stat().st_size,'sha256':manifest['sha256']}))
