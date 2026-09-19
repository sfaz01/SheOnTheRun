"""Local preview server for the site.

Plain `python -m http.server` lets the browser cache your CSS and JS, so edits
sometimes don't show up until you clear the cache. This does the same job but
tells the browser never to cache anything, and serves 404.html properly.

    python serve.py            # then open http://localhost:8091
    python serve.py 3000       # a different port
"""
import sys
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8091


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".webp": "image/webp",
        ".avif": "image/avif",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
    }

    def do_GET(self):
        clean_path = self.path.split("?")[0].split("#")[0]
        if clean_path in ("/journal", "/journal/"):
            self.send_response(301)
            self.send_header("Location", "/journal/index.html")
            self.end_headers()
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            page = os.path.join(ROOT, "404.html")
            if os.path.exists(page):
                body = open(page, "rb").read()
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(body)
                return
        super().send_error(code, message, explain)

    def log_message(self, fmt, *args):
        if "404" in (args[1] if len(args) > 1 else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    os.chdir(ROOT)
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), partial(Handler, directory=ROOT))
    print(f"Serving {ROOT}\n  http://localhost:{PORT}\nCtrl+C to stop.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
