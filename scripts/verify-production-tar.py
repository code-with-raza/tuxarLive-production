"""Verify archive contents without extracting files or following links."""
import hashlib, json, pathlib, sys, tarfile

archive = pathlib.Path(sys.argv[1]).resolve()
manifest_path = pathlib.Path(sys.argv[2]).resolve()
manifest = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
expected = {item['path']: item for item in manifest['files']}
seen = set()
with tarfile.open(archive, 'r:gz') as bundle:
    for member in bundle:
        if member.isdir():
            continue
        assert member.isfile(), f'Unexpected link/special member: {member.name}'
        name = member.name[2:] if member.name.startswith('./') else member.name
        parts = pathlib.PurePosixPath(name)
        assert not parts.is_absolute() and '..' not in parts.parts, name
        assert name in expected and name not in seen, f'Unexpected/duplicate file: {name}'
        digest = hashlib.sha256()
        with bundle.extractfile(member) as stream:
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
        assert digest.hexdigest().upper() == expected[name]['sha256'].upper(), name
        assert member.size == expected[name]['bytes'], name
        seen.add(name)
assert seen == set(expected), 'Missing archive files'
assert '.htaccess' in seen
report = {'archive': str(archive), 'verifiedFiles': len(seen), 'bytes': archive.stat().st_size,
          'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
          'status': 'All archived file hashes match the production build; hosting upload remains unverified.'}
(manifest_path.parent / 'archive-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
