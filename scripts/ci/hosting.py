"""cPanel publishing over verified SSH or explicit FTPS; never plaintext FTP.

Upload assets first, swap the complete generated page directories, publish index
last, and retain a private rollback copy. Unrelated hosting files are untouched.
"""
import ftplib
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import shutil
import ssl
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request

GENERATED = ("prerender-home", "prerender-pages", "blog_images", "size-charts")
ROOT_FILES = ("favicon.svg", "consent-default.js", "legacy-not-found.html", "llms.txt", "robots.txt", "sitemap.xml", ".htaccess", "deployment.json", "index.html")
PUBLIC_FILE = re.compile(r"^(?:\.htaccess|index\.html|robots\.txt|sitemap\.xml|llms\.txt|legacy-not-found\.html|consent-default\.js|favicon\.svg|deployment\.json|(?:assets|blog_images|size-charts)/[a-zA-Z0-9_./-]+\.(?:js|mjs|css|svg|png|jpe?g|webp|avif|gif|woff2?|ttf|ico)|prerender-home/(?:en|de|fr|it|es)\.html|prerender-pages/(?:en|de|fr|it|es)/(?:[a-z0-9-]+/)+index\.html)$")


def safe_relative(value):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or ".." in path.parts or "\\" in value or not PUBLIC_FILE.fullmatch(value):
        raise ValueError("Unexpected public release path")
    return value


def verify_artifact(folder, manifest):
    seen = set()
    for item in manifest["files"]:
        relative = safe_relative(item["path"])
        if relative in seen:
            raise ValueError("Duplicate release file")
        seen.add(relative)
        target = folder / relative
        if target.is_symlink() or target.resolve() != target.absolute():
            raise ValueError("Release symlinks are forbidden")
        content = target.read_bytes()
        if len(content) != item["bytes"] or hashlib.sha256(content).hexdigest() != item["sha256"]:
            raise ValueError("Release hash mismatch")
    required = {"index.html", ".htaccess", "deployment.json", "sitemap.xml", "robots.txt"}
    required.update(f"prerender-home/{locale}.html" for locale in ("en", "de", "fr", "it", "es"))
    if not required <= seen or not any(p.startswith("prerender-pages/en/product/") for p in seen):
        raise ValueError("Incomplete public release")
    revision = manifest.get("revision", "")
    if not re.fullmatch(r"[0-9a-f]{40}", revision) or json.loads((folder / "deployment.json").read_text())["revision"] != revision:
        raise ValueError("Release revision mismatch")


def validate_root(value):
    if not re.fullmatch(r"/[a-zA-Z0-9_./-]*", value or "") or ".." in PurePosixPath(value).parts:
        raise ValueError("Use an absolute hosting document-root path without traversal")
    return value.rstrip("/") or "/"


def release_id():
    revision = os.environ.get("GITHUB_SHA", "")
    run = os.environ.get("GITHUB_RUN_ID", "")
    attempt = os.environ.get("GITHUB_RUN_ATTEMPT", "1")
    if not re.fullmatch(r"[0-9a-f]{40}", revision) or not run.isdigit() or not attempt.isdigit():
        raise ValueError("GitHub release identity is missing")
    return f"{revision}-{run}-{attempt}"


def no_symlink_path(root, target):
    relative = target.relative_to(root)
    current = root
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError("Hosting symlink at a managed release path")


def local_rollback(root, release, force=False):
    journal = json.loads((release / "journal.json").read_text())
    if journal.get("rolled_back"):
        return
    if not force and json.loads((root / "deployment.json").read_text())["revision"] != journal["revision"]:
        raise ValueError("Refusing to roll back a different live release")
    for relative, existed in reversed(journal["changes"]):
        target, backup = root / relative, release / "backup" / relative
        no_symlink_path(root, target)
        if backup.exists():
            if target.exists():
                failed = release / "failed" / relative
                failed.parent.mkdir(parents=True, exist_ok=True)
                os.replace(target, failed)
            os.replace(backup, target)
        elif not existed and target.exists():
            failed = release / "failed" / relative
            failed.parent.mkdir(parents=True, exist_ok=True)
            os.replace(target, failed)
    journal["rolled_back"] = True
    (release / "journal.json").write_text(json.dumps(journal))


def local_publish(root, release, manifest, fail_after=None):
    staged = release / "staged"
    verify_artifact(staged, manifest)
    journal = {"revision": manifest["revision"], "changes": []}
    if (release / "journal.json").exists():
        raise ValueError("Release was already activated; rerun the workflow for a new attempt")
    # New hashed assets remain available after rollback for already-open tabs.
    for item in manifest["files"]:
        if not item["path"].startswith("assets/"):
            continue
        target = root / item["path"]
        no_symlink_path(root, target)
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=target.parent, prefix=".tuxar-", delete=False) as output:
            temporary = Path(output.name)
            with (staged / item["path"]).open("rb") as source:
                shutil.copyfileobj(source, output)
        os.replace(temporary, target)
    try:
        for relative in (*GENERATED, *ROOT_FILES):
            target, source = root / relative, staged / relative
            no_symlink_path(root, target)
            if not source.exists() and relative not in GENERATED:
                continue
            if not source.exists() and not target.exists():
                continue
            journal["changes"].append([relative, target.exists()])
            (release / "journal.json").write_text(json.dumps(journal))
            if target.exists():
                backup = release / "backup" / relative
                backup.parent.mkdir(parents=True, exist_ok=True)
                os.replace(target, backup)
            if fail_after is not None and len(journal["changes"]) == fail_after:
                raise OSError("Injected activation failure")
            if source.exists():
                os.replace(source, target)
    except Exception:
        local_rollback(root, release, force=True)
        raise


def remote_main(mode, document_root, identity):
    import fcntl
    if not re.fullmatch(r"[0-9a-f]{40}-[0-9]+-[0-9]+", identity):
        raise ValueError("Invalid release identity")
    home = Path.home().resolve()
    root = Path(validate_root(document_root))
    if root.resolve() != root or root == home or home not in root.parents or not root.is_dir():
        raise ValueError("Document root must be a real directory inside this SSH user's home")
    no_symlink_path(home, root)
    private = home / ".tuxar-ci"
    no_symlink_path(home, private)
    private.mkdir(mode=0o700, exist_ok=True)
    os.chmod(private, 0o700)
    if private.stat().st_dev != root.stat().st_dev:
        raise ValueError("SSH staging and the document root must share a filesystem for atomic renames")
    release = private / identity
    no_symlink_path(private, release)
    with (private / "deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if mode == "remote-check":
            release.mkdir(mode=0o700, exist_ok=False)
            probe = root / f"ci-probe-{identity}.txt"
            with probe.open("x") as output:
                output.write(hashlib.sha256(identity.encode()).hexdigest())
            print("SSH document root, private staging directory and Python verified")
            return
        if mode == "remote-probe-cleanup":
            probe = root / f"ci-probe-{identity}.txt"
            no_symlink_path(root, probe)
            probe.unlink()
            return
        if mode == "remote-rollback":
            local_rollback(root, release)
            print("Previous website restored; database changes were retained")
            return
        staged = release / "staged"
        staged.mkdir(mode=0o700, exist_ok=False)
        with tarfile.open(release / "release.tar.gz", "r:gz") as archive:
            seen = set()
            for entry in archive.getmembers():
                if not entry.isfile() or entry.name in seen:
                    raise ValueError("Archive contains a link, special file or duplicate")
                seen.add(entry.name)
                if entry.name != ".release-manifest.json":
                    safe_relative(entry.name)
                destination = staged / entry.name
                destination.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(entry) as source, destination.open("wb") as output:
                    shutil.copyfileobj(source, output)
        manifest = json.loads((staged / ".release-manifest.json").read_text())
        if manifest["revision"] != identity.split("-")[0] or seen != {i["path"] for i in manifest["files"]} | {".release-manifest.json"}:
            raise ValueError("Archive and manifest disagree")
        local_publish(root, release, manifest)
        print("Website published; rollback copy retained outside the document root")


class FTPSPublisher:
    def __init__(self, ftp, identity, reconnect=None):
        self.ftp = ftp
        self.release = f".tuxar-ci/{identity}"
        self.identity = identity
        self.reconnect = reconnect
        self.directories = set()

    def transfer(self, label, operation):
        # Retry only idempotent reads/writes, never replay an uncertain rename.
        for attempt in range(3):
            try:
                if attempt:
                    if self.ftp is not None:
                        self.ftp.close()
                    self.ftp = None
                    self.directories.clear()
                    self.ftp = self.reconnect()
                return operation()
            except ssl.SSLCertVerificationError:
                raise
            except (TimeoutError, ConnectionError, EOFError, ssl.SSLError, ftplib.error_temp) as error:
                if not self.reconnect or attempt == 2:
                    # A safe public-path annotation is readable without downloading
                    # private job logs. Never include raw FTP replies/credentials.
                    if __name__ == "__main__":
                        print(f"::error title=FTPS transfer stopped::{label} stopped after {attempt + 1} attempt(s) ({type(error).__name__}); activation and rollback state must be checked", flush=True)
                    raise
                print(f"Transient FTPS {label} failure ({type(error).__name__}); reconnecting for attempt {attempt + 2}/3", flush=True)
                time.sleep(attempt + 1)

    def exists(self, name):
        # MLST avoids treating a permission/connection failure as an absent file.
        try:
            facts = self.ftp.sendcmd(f"MLST {name}")
            if "slink" in facts.lower() or "symlink" in facts.lower():
                raise ValueError("Hosting symlink at a managed release path")
            return True
        except ftplib.error_perm as error:
            if str(error).startswith("550"):
                return False
            raise

    def mkdir(self, name):
        current = ""
        for part in PurePosixPath(name).parts:
            current = f"{current}/{part}".lstrip("/")
            if current in self.directories:
                continue
            if not self.exists(current):
                self.ftp.mkd(current)
            self.directories.add(current)

    def write(self, name, data):
        def upload():
            parent = str(PurePosixPath(name).parent)
            if parent != ".":
                self.mkdir(parent)
            self.exists(name)  # Reject an existing symlink before STOR follows it.
            # Always rewind from byte zero after an interrupted/partial upload.
            self.ftp.storbinary(f"STOR {name}", io.BytesIO(data), blocksize=65536)
        self.transfer(f"upload {name}", upload)

    def read(self, name):
        def download():
            # A retry must discard partially downloaded bytes, not append to them.
            content = io.BytesIO()
            self.ftp.retrbinary(f"RETR {name}", content.write, blocksize=65536)
            return content.getvalue()
        return self.transfer(f"download {name}", download)

    def save_journal(self, journal):
        pending = f"{self.release}/journal.next.json"
        content = json.dumps(journal).encode()
        self.write(pending, content)
        if self.read(pending) != content:
            raise ValueError("FTPS rollback journal verification failed")
        # Preserve the last complete journal if the data connection fails.
        self.ftp.rename(pending, f"{self.release}/journal.json")

    def check(self):
        self.mkdir(".tuxar-ci")
        self.write(".tuxar-ci/.htaccess", b"Require all denied\n")
        if self.exists(self.release):
            raise ValueError("Staging directory already exists; rerun for a new attempt")
        self.mkdir(self.release)
        self.write(f"{self.release}/probe", b"private staging probe\n")
        self.ftp.rename(f"{self.release}/probe", f"{self.release}/probe-renamed")
        if self.read(f"{self.release}/probe-renamed") != b"private staging probe\n":
            raise ValueError("FTPS read/write/rename check failed")
        print("Certificate-verified FTPS read/write/rename verified")

    def rollback(self, force=False):
        journal = json.loads(self.read(f"{self.release}/journal.json"))
        if journal.get("rolled_back"):
            return
        if not force and json.loads(self.read("deployment.json"))["revision"] != journal["revision"]:
            raise ValueError("Refusing to roll back a different live release")
        for relative, existed in reversed(journal["changes"]):
            backup = f"{self.release}/backup/{relative}"
            if self.exists(backup):
                if self.exists(relative):
                    failed = f"{self.release}/failed/{relative}"
                    self.mkdir(str(PurePosixPath(failed).parent))
                    self.ftp.rename(relative, failed)
                self.ftp.rename(backup, relative)
            elif not existed and self.exists(relative):
                failed = f"{self.release}/failed/{relative}"
                self.mkdir(str(PurePosixPath(failed).parent))
                self.ftp.rename(relative, failed)
        journal["rolled_back"] = True
        self.save_journal(journal)

    def publish(self, folder, manifest):
        verify_artifact(folder, manifest)
        staged = f"{self.release}/staged"
        manifest_path = f"{self.release}/manifest.json"
        if self.exists(f"{self.release}/journal.json"):
            raise ValueError("Activation already started; use a fresh workflow attempt")
        if self.exists(manifest_path):
            if json.loads(self.read(manifest_path)) != manifest:
                raise ValueError("Staged release manifest differs; refusing to resume")
        elif self.exists(staged):
            raise ValueError("Unidentified staging directory; use a fresh workflow attempt")
        else:
            self.write(manifest_path, json.dumps(manifest).encode())
        total_bytes = sum(item["bytes"] for item in manifest["files"])
        print(f"Staging {len(manifest['files'])} files ({total_bytes / 1048576:.1f} MiB); TLS verification and read-back hashes required", flush=True)
        for index, item in enumerate(manifest["files"]):
            target = f"{staged}/{item['path']}"
            def stage():
                # A previous transfer may have completed before its reply was lost.
                if self.transfer(f"inspect {item['path']}", lambda: self.exists(target)) and hashlib.sha256(self.read(target)).hexdigest() == item["sha256"]:
                    return
                self.write(target, (folder / item["path"]).read_bytes())
                if hashlib.sha256(self.read(target)).hexdigest() != item["sha256"]:
                    raise ValueError("FTPS staged upload hash mismatch")
            if item["bytes"] >= 1048576:
                print(f"Staging file {index + 1}/{len(manifest['files'])}: {item['path']} ({item['bytes']} bytes)", flush=True)
            try:
                stage()
            except Exception:
                print(f"Staging stopped at file {index + 1}/{len(manifest['files'])}: {item['path']}; website activation has not started", flush=True)
                raise
            if index % 25 == 0 or index + 1 == len(manifest["files"]):
                print(f"Staged and verified {index + 1}/{len(manifest['files'])} files", flush=True)
        for item in manifest["files"]:
            if item["path"].startswith("assets/"):
                self.mkdir(str(PurePosixPath(item["path"]).parent))
                if self.exists(item["path"]):
                    if hashlib.sha256(self.read(item["path"])).hexdigest() == item["sha256"]:
                        continue
                    raise ValueError("Existing asset name has different content; refusing to break open tabs")
                self.ftp.rename(f"{staged}/{item['path']}", item["path"])
        journal = {"revision": manifest["revision"], "changes": []}
        try:
            for relative in (*GENERATED, *ROOT_FILES):
                source = f"{staged}/{relative}"
                exists = self.exists(relative)
                if not self.exists(source) and (relative not in GENERATED or not exists):
                    continue
                journal["changes"].append([relative, exists])
                self.save_journal(journal)
                if exists:
                    backup = f"{self.release}/backup/{relative}"
                    self.mkdir(str(PurePosixPath(backup).parent))
                    self.ftp.rename(relative, backup)
                if self.exists(source):
                    self.ftp.rename(source, relative)
        except Exception:
            if self.transfer("rollback journal lookup", lambda: self.exists(f"{self.release}/journal.json")):
                self.rollback(force=True)
            raise
        print("Website published; protected FTPS rollback copy retained")


def ssh_run(mode, root, identity, key, known):
    host, user = os.environ["HOSTING_HOST"], os.environ["HOSTING_USER"]
    port = os.environ.get("HOSTING_PORT") or "22"
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9.-]*", host) or not re.fullmatch(r"[a-zA-Z0-9_][a-zA-Z0-9_-]*", user) or not port.isdigit():
        raise ValueError("Invalid SSH host, user or port")
    options = ["-i", str(key), "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", f"UserKnownHostsFile={known}", "-o", "ConnectTimeout=20"]
    command = "python3 - " + " ".join(shlex.quote(v) for v in [mode, root, identity])
    if mode == "remote-publish":
        manifest = json.loads(Path("output/ci/release-manifest.json").read_text())
        verify_artifact(Path("dist"), manifest)
        archive_path = key.parent / "release.tar.gz"
        with tarfile.open(archive_path, "w:gz") as archive:
            for item in manifest["files"]:
                archive.add(Path("dist") / item["path"], arcname=item["path"], recursive=False)
            archive.add("output/ci/release-manifest.json", arcname=".release-manifest.json", recursive=False)
        # A leading relative path is interpreted inside the authenticated user's home.
        subprocess.run(["scp", "-P", port, *options, str(archive_path), f"{user}@{host}:.tuxar-ci/{identity}/release.tar.gz"], check=True, capture_output=True)
    subprocess.run(["ssh", "-p", port, *options, f"{user}@{host}", command], input=Path(__file__).read_bytes(), check=True)


def main(mode):
    transport = os.environ.get("DEPLOY_TRANSPORT", "")
    root = validate_root(os.environ.get("HOSTING_DOCUMENT_ROOT", ""))
    identity = release_id()
    for key in ("HOSTING_HOST", "HOSTING_USER"):
        if not os.environ.get(key):
            raise ValueError(f"Set {key} in the production GitHub environment")
    if transport == "ssh":
        if not os.environ.get("HOSTING_SSH_PRIVATE_KEY") or not os.environ.get("HOSTING_SSH_KNOWN_HOSTS"):
            raise ValueError("Set the SSH private key and independently verified known-hosts record")
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            key, known = folder / "key", folder / "known_hosts"
            key.write_text(os.environ["HOSTING_SSH_PRIVATE_KEY"].replace("\r\n", "\n").rstrip() + "\n")
            known.write_text(os.environ["HOSTING_SSH_KNOWN_HOSTS"].replace("\r\n", "\n").rstrip() + "\n")
            key.chmod(0o600)
            ssh_run(f"remote-{mode}", root, identity, key, known)
            if mode == "check":
                try:
                    verify_document_root(identity)
                finally:
                    ssh_run("remote-probe-cleanup", root, identity, key, known)
    elif transport == "ftps":
        if not os.environ.get("HOSTING_PASSWORD"):
            raise ValueError("Set HOSTING_PASSWORD for FTPS")
        def connect():
            ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=180)
            try:
                ftp.connect(os.environ["HOSTING_HOST"], int(os.environ.get("HOSTING_PORT") or "21"))
                ftp.login(os.environ["HOSTING_USER"], os.environ["HOSTING_PASSWORD"])
                ftp.prot_p()
                ftp.cwd(root)
                return ftp
            except Exception:
                ftp.close()
                raise
        publisher = FTPSPublisher(connect(), identity, reconnect=connect)
        try:
            if mode == "check":
                publisher.check()
                probe = f"ci-probe-{identity}.txt"
                if publisher.exists(probe):
                    raise ValueError("Document-root probe already exists")
                publisher.write(probe, hashlib.sha256(identity.encode()).hexdigest().encode())
                try:
                    verify_document_root(identity)
                    # Staging and rollback copies must be denied by the web server.
                    try:
                        with urllib.request.urlopen(f"https://tuxar.co.uk/{publisher.release}/probe-renamed", timeout=20):
                            raise ValueError("FTPS staging directory is publicly readable; use SSH or fix directory access rules")
                    except urllib.error.HTTPError as error:
                        if error.code not in (403, 404):
                            raise
                finally:
                    publisher.ftp.delete(probe)
            elif mode == "rollback":
                publisher.rollback()
            else:
                publisher.publish(Path("dist"), json.loads(Path("output/ci/release-manifest.json").read_text()))
        finally:
            if publisher.ftp is not None:
                publisher.ftp.close()
    else:
        raise ValueError("Set DEPLOY_TRANSPORT to ssh or ftps after confirming hosting access")


def verify_document_root(identity):
    with urllib.request.urlopen(f"https://tuxar.co.uk/ci-probe-{identity}.txt", timeout=20) as response:
        expected = hashlib.sha256(identity.encode()).hexdigest().encode()
        if response.status != 200 or response.read() != expected:
            raise ValueError("The configured document root does not serve tuxar.co.uk")


if __name__ == "__main__":
    try:
        if len(sys.argv) == 4 and sys.argv[1].startswith("remote-"):
            remote_main(*sys.argv[1:])
        elif len(sys.argv) == 2 and sys.argv[1] in ("check", "publish", "rollback"):
            main(sys.argv[1])
        else:
            raise ValueError("Use hosting.py check, publish or rollback")
    except Exception as error:
        # Do not dump FTP authentication replies, command arguments, keys or URLs.
        print(f"Hosting operation stopped ({type(error).__name__}). Review the hosting configuration and retained private staging/rollback directory.", file=sys.stderr)
        if isinstance(error, ValueError):
            print(str(error), file=sys.stderr)
        sys.exit(1)
