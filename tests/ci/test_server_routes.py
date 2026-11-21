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
        code += "echo json_encode(array_map(fn($path)=>tuxar_route_status($path,$routes,fn($locale,$slug)=>$slug==='existing'?200:" + str(published) + "),$paths));"
        result = subprocess.run([PHP, "-r", code], capture_output=True, text=True, timeout=15, check=True)
        return json.loads(result.stdout)

    def test_genuinely_unknown_routes_return_404(self):
        paths = ["/seo-check-page-does-not-exist-20261119", "/en/product/missing", "/en/collections/missing",
                 "/en/blog/missing", "/en/shop/not-a-route", "/zz/shop", "/en/admin/journal/not-an-id"]
        self.assertEqual(self.statuses(paths), [404] * len(paths))

    def test_valid_public_language_and_private_routes_survive(self):
        paths = ["/en", "/de/shop", "/en/account/orders", "/en/product/existing",
                 "/en/collections/existing", "/en/blog/existing", "/en/admin/journal/new",
                 "/en/admin/categories/storefront--cafe-racer-jackets",
                 "/en/admin/products/preview--mens-test-jacket"]
        self.assertEqual(self.statuses(paths), [200] * len(paths))

    def test_new_published_articles_work_without_a_static_slug(self):
        self.assertEqual(self.statuses(["/en/blog/new-published-guide"], published=200), [200])
        self.assertEqual(self.statuses(["/en/blog/unpublished-guide"]), [404])
        self.assertEqual(self.statuses(["/en/blog/new-published-guide"], published=503), [503])

    def test_live_visibility_overrides_known_static_product_and_article_paths(self):
        code = "require " + json.dumps(str(ROUTER)) + ";"
        code += "$routes=['paths'=>['/en/blog/existing','/en/product/existing'],'productSlugs'=>['localized'=>'existing']];"
        code += "echo json_encode([tuxar_route_status('/en/blog/existing',$routes,fn()=>404),tuxar_route_status('/en/product/existing',$routes,fn()=>200,fn()=>404),tuxar_route_status('/fr/product/localized',$routes,fn()=>200,fn($slug)=>$slug==='existing'?200:404)]);"
        result = subprocess.run([PHP, "-r", code], capture_output=True, text=True, timeout=15, check=True)
        self.assertEqual(json.loads(result.stdout), [404, 404, 200])

    def test_prerendered_cards_remove_unpublished_content_and_fail_closed(self):
        html = '<article data-publication-product="available"><h3>Available</h3></article><article data-publication-product="archived"><h3>Archived</h3></article><article data-publication-blog="en:removed"><h3>Removed</h3></article><p>Unrelated content</p>'
        code = "require " + json.dumps(str(ROUTER)) + ";$html=" + json.dumps(html) + ";"
        code += "echo json_encode([tuxar_filter_publication_cards($html,fn($keys)=>['product:available'=>true,'product:archived'=>false,'blog:en:removed'=>false]),tuxar_filter_publication_cards($html,fn()=>null)]);"
        result = subprocess.run([PHP, "-r", code], capture_output=True, text=True, timeout=15, check=True)
        filtered, failed = json.loads(result.stdout)
        self.assertIn('Available', filtered)
        self.assertIn('Unrelated content', filtered)
        self.assertNotIn('Archived', filtered)
        self.assertNotIn('Removed', filtered)
        self.assertIsNone(failed)
