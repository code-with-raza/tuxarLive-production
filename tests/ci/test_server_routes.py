import json
from pathlib import Path
import shutil
import subprocess
import unittest

PHP = shutil.which("php")
ROUTER = Path(__file__).resolve().parents[2] / "public/server-router.php"


@unittest.skipUnless(PHP, "PHP CLI is required; deployment CI checks it explicitly")
class ServerRouteTests(unittest.TestCase):
    def statuses(self, paths, published=404):
        known = ["/en", "/en/shop", "/en/contact", "/de/shop", "/en/account/orders",
                 "/en/product/existing", "/en/collections/existing", "/en/blog/existing"]
        code = "require " + json.dumps(str(ROUTER)) + ";"
        code += "$routes=['paths'=>json_decode(" + json.dumps(json.dumps(known)) + ",true)];"
        code += "$paths=json_decode(" + json.dumps(json.dumps(paths)) + ",true);"
        code += "echo json_encode(array_map(fn($path)=>tuxar_route_status($path,$routes,fn($locale,$slug)=>" + str(published) + "),$paths));"
        result = subprocess.run([PHP, "-r", code], capture_output=True, text=True, timeout=15, check=True)
        return json.loads(result.stdout)

    def test_genuinely_unknown_routes_return_404(self):
        paths = ["/seo-check-page-does-not-exist-20261119", "/en/product/missing", "/en/collections/missing",
                 "/en/blog/missing", "/en/shop/not-a-route", "/zz/shop", "/en/admin/journal/not-an-id"]
        self.assertEqual(self.statuses(paths), [404] * len(paths))

    def test_valid_public_language_and_private_routes_survive(self):
        paths = ["/en", "/de/shop", "/en/account/orders", "/en/product/existing",
                 "/en/collections/existing", "/en/blog/existing", "/en/admin/journal/new"]
        self.assertEqual(self.statuses(paths), [200] * len(paths))

    def test_new_published_articles_work_without_a_static_slug(self):
        self.assertEqual(self.statuses(["/en/blog/new-published-guide"], published=200), [200])
        self.assertEqual(self.statuses(["/en/blog/unpublished-guide"]), [404])
        self.assertEqual(self.statuses(["/en/blog/new-published-guide"], published=503), [503])
