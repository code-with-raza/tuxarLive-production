import ftplib
import hashlib
import importlib.util
import io
import json
import ssl
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("hosting", Path(__file__).resolve().parents[2] / "scripts/ci/hosting.py")
hosting = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hosting)
REVISION = "a" * 40


def fixture(folder):
    files = {
        "index.html": b"new-index", ".htaccess": b"new-rules", "robots.txt": b"robots", "sitemap.xml": b"sitemap",
        "deployment.json": json.dumps({"revision": REVISION}).encode(), "assets/new-12345678.js": b"new-js",
        "prerender-pages/en/product/new/index.html": b"new-product",
    }
    for locale in ("en", "de", "fr", "it", "es"):
        files[f"prerender-home/{locale}.html"] = f"new-{locale}".encode()
    for name, content in files.items():
        target = folder / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    return {"revision": REVISION, "files": [{"path": name, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()} for name, content in files.items()]}


def previous(root):
    for name, content in {"index.html": "old-index", ".htaccess": "old-rules", "assets/old-12345678.js": "old-js", "prerender-home/en.html": "old-home", "prerender-pages/en/product/hidden/index.html": "hidden-product", "unrelated.txt": "keep-me"}.items():
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)


class FakeFTP:
    """Exercise the real publisher with filesystem-backed FTPS operations."""
    def __init__(self, root, fail=None):
        self.root, self.fail = root, fail

    def sendcmd(self, command):
        target = self.root / command.removeprefix("MLST ")
        if not target.exists():
            raise ftplib.error_perm("550 File not found")
        return "250 type=dir;" if target.is_dir() else "250 type=file;"

    def mkd(self, name):
        (self.root / name).mkdir()

    def storbinary(self, command, stream, blocksize=8192):
        (self.root / command.removeprefix("STOR ")).write_bytes(stream.read())

    def retrbinary(self, command, callback, blocksize=8192):
        callback((self.root / command.removeprefix("RETR ")).read_bytes())

    def rename(self, source, target):
        if self.fail and self.fail(source, target):
            self.fail = None
            raise OSError("Injected server failure")
        (self.root / source).replace(self.root / target)

    def close(self):
        pass


class HostingTests(unittest.TestCase):
    def setUp(self):
        temporary_root = Path(__file__).resolve().parents[2] / "output/ci-tests"
        temporary_root.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=temporary_root)
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / "public_html"
        self.root.mkdir()
        previous(self.root)

    def test_ssh_activation_replaces_generated_trees_keeps_open_tab_assets_and_can_rollback(self):
        release = self.base / "private-release"
        manifest = fixture(release / "staged")
        hosting.local_publish(self.root, release, manifest)
        self.assertEqual((self.root / "index.html").read_text(), "new-index")
        self.assertFalse((self.root / "prerender-pages/en/product/hidden/index.html").exists())
        self.assertTrue((self.root / "assets/old-12345678.js").exists())
        self.assertEqual((self.root / "unrelated.txt").read_text(), "keep-me")
        hosting.local_rollback(self.root, release)
        self.assertEqual((self.root / "index.html").read_text(), "old-index")
        self.assertEqual((self.root / ".htaccess").read_text(), "old-rules")
        self.assertTrue((self.root / "prerender-pages/en/product/hidden/index.html").exists())
        self.assertTrue((self.root / "assets/new-12345678.js").exists())

    def test_ssh_activation_failure_restores_old_directories_even_between_renames(self):
        release = self.base / "private-failure"
        manifest = fixture(release / "staged")
        with self.assertRaises(OSError):
            hosting.local_publish(self.root, release, manifest, fail_after=2)
        self.assertEqual((self.root / "index.html").read_text(), "old-index")
        self.assertTrue((self.root / "prerender-pages/en/product/hidden/index.html").exists())
        self.assertEqual((self.root / "prerender-home/en.html").read_text(), "old-home")

    def test_ftps_publisher_and_rollback_use_the_same_complete_directory_replacement(self):
        folder = self.base / "dist"
        manifest = fixture(folder)
        ftp = FakeFTP(self.root)
        publisher = hosting.FTPSPublisher(ftp, "release")
        publisher.publish(folder, manifest)
        self.assertEqual((self.root / "index.html").read_text(), "new-index")
        self.assertFalse((self.root / "prerender-pages/en/product/hidden/index.html").exists())
        publisher.rollback()
        self.assertEqual((self.root / "index.html").read_text(), "old-index")
        self.assertTrue((self.root / "prerender-pages/en/product/hidden/index.html").exists())

    def test_ftps_failed_page_swap_restores_previous_site(self):
        folder = self.base / "dist"
        manifest = fixture(folder)
        ftp = FakeFTP(self.root, fail=lambda source, target: source.endswith("staged/prerender-pages") and target == "prerender-pages")
        publisher = hosting.FTPSPublisher(ftp, "failure")
        with self.assertRaises(OSError):
            publisher.publish(folder, manifest)
        self.assertEqual((self.root / "index.html").read_text(), "old-index")
        self.assertTrue((self.root / "prerender-pages/en/product/hidden/index.html").exists())

    @patch.object(hosting.time, "sleep")
    def test_ftps_reconnect_rewinds_partial_upload_and_discards_partial_download(self, _sleep):
        folder = self.base / "dist"
        manifest = fixture(folder)
        failures = {"upload": True, "download": True}
        connections = []

        class UnstableFTP(FakeFTP):
            def storbinary(inner, command, stream, blocksize=8192):
                if command.endswith("staged/index.html") and failures["upload"]:
                    failures["upload"] = False
                    (inner.root / command.removeprefix("STOR ")).write_bytes(stream.read(2))
                    raise TimeoutError("Injected partial upload")
                super().storbinary(command, stream, blocksize)

            def retrbinary(inner, command, callback, blocksize=8192):
                if command.endswith("staged/index.html") and failures["download"]:
                    failures["download"] = False
                    callback(b"partial")
                    raise TimeoutError("Injected partial download")
                super().retrbinary(command, callback, blocksize)

        def connect():
            ftp = UnstableFTP(self.root)
            connections.append(ftp)
            return ftp

        publisher = hosting.FTPSPublisher(connect(), "retry", reconnect=connect)
        publisher.publish(folder, manifest)
        self.assertEqual(len(connections), 3)
        self.assertEqual((self.root / "index.html").read_bytes(), b"new-index")
        publisher.rollback()
        self.assertEqual((self.root / "index.html").read_bytes(), b"old-index")

    @patch.object(hosting.time, "sleep")
    def test_ftps_exhausted_retries_leave_live_site_intact_and_resume_only_matching_hashes(self, _sleep):
        folder = self.base / "dist"
        manifest = fixture(folder)
        attempts = []

        class BrokenFTP(FakeFTP):
            def storbinary(inner, command, stream, blocksize=8192):
                if command.endswith("staged/.htaccess"):
                    attempts.append(command)
                    (inner.root / command.removeprefix("STOR ")).write_bytes(b"partial")
                    raise TimeoutError("Injected recurring failure")
                super().storbinary(command, stream, blocksize)

        publisher = hosting.FTPSPublisher(BrokenFTP(self.root), "resume", reconnect=lambda: BrokenFTP(self.root))
        with self.assertRaises(TimeoutError):
            publisher.publish(folder, manifest)
        self.assertEqual(len(attempts), 3)
        self.assertEqual((self.root / "index.html").read_text(), "old-index")
        self.assertFalse((self.root / ".tuxar-ci/resume/journal.json").exists())
        writes = []

        class TrackingFTP(FakeFTP):
            def storbinary(inner, command, stream, blocksize=8192):
                writes.append(command)
                super().storbinary(command, stream, blocksize)

        publisher = hosting.FTPSPublisher(TrackingFTP(self.root), "resume")
        publisher.publish(folder, manifest)
        self.assertNotIn("STOR .tuxar-ci/resume/staged/index.html", writes)
        self.assertEqual((self.root / ".htaccess").read_text(), "new-rules")
        self.assertEqual((self.root / "index.html").read_text(), "new-index")

    def test_ftps_resume_rejects_changed_manifest_and_never_retries_certificate_failures(self):
        folder = self.base / "dist"
        manifest = fixture(folder)
        publisher = hosting.FTPSPublisher(FakeFTP(self.root), "mismatch")
        publisher.write(f"{publisher.release}/manifest.json", b"{}")
        with self.assertRaisesRegex(ValueError, "manifest differs"):
            publisher.publish(folder, manifest)
        self.assertEqual((self.root / "index.html").read_text(), "old-index")
        reconnects = []

        class BadCertificateFTP(FakeFTP):
            def storbinary(inner, *args, **kwargs):
                raise ssl.SSLCertVerificationError("Injected certificate mismatch")

        publisher = hosting.FTPSPublisher(BadCertificateFTP(self.root), "certificate", reconnect=lambda: reconnects.append(True))
        with self.assertRaises(ssl.SSLCertVerificationError):
            publisher.write(".tuxar-ci/certificate/test", b"test")
        self.assertEqual(reconnects, [])

    @patch.object(hosting.time, "sleep")
    def test_ftps_failed_journal_upload_keeps_last_complete_journal_for_rollback(self, _sleep):
        folder = self.base / "dist"
        manifest = fixture(folder)
        journal_writes = []

        class JournalFailureFTP(FakeFTP):
            def storbinary(inner, command, stream, blocksize=8192):
                if command.endswith("journal.next.json"):
                    data = stream.read()
                    # Fail after at least one generated directory has been swapped.
                    if not journal_writes or len(json.loads(data)["changes"]) < 2:
                        journal_writes.append(command)
                        return super().storbinary(command, io.BytesIO(data), blocksize)
                    (inner.root / command.removeprefix("STOR ")).write_bytes(b"{partial")
                    raise TimeoutError("Injected journal upload failure")
                super().storbinary(command, stream, blocksize)

        publisher = hosting.FTPSPublisher(JournalFailureFTP(self.root), "journal", reconnect=lambda: JournalFailureFTP(self.root))
        with self.assertRaises(TimeoutError):
            publisher.publish(folder, manifest)
        self.assertEqual((self.root / "index.html").read_text(), "old-index")
        self.assertEqual((self.root / "prerender-home/en.html").read_text(), "old-home")
        self.assertTrue((self.root / "prerender-pages/en/product/hidden/index.html").exists())
        self.assertTrue(json.loads((self.root / ".tuxar-ci/journal/journal.json").read_text())["rolled_back"])

    def test_tampered_artifact_and_private_paths_are_rejected_before_publication(self):
        folder = self.base / "dist"
        manifest = fixture(folder)
        (folder / "index.html").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "hash mismatch"):
            hosting.verify_artifact(folder, manifest)
        for name in ("../.env", "/index.html", "assets/../../private.key", "scripts/deploy.py", ".env"):
            with self.assertRaises(ValueError):
                hosting.safe_relative(name)
        with self.assertRaises(ValueError):
            hosting.validate_root("/home/account/../other/public_html")

    def test_rollback_refuses_to_replace_a_newer_live_revision(self):
        release = self.base / "private-release"
        manifest = fixture(release / "staged")
        hosting.local_publish(self.root, release, manifest)
        (self.root / "deployment.json").write_text(json.dumps({"revision": "b" * 40}))
        with self.assertRaisesRegex(ValueError, "different live release"):
            hosting.local_rollback(self.root, release)


if __name__ == "__main__":
    unittest.main()
