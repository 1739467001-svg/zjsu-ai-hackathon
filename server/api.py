#!/usr/bin/env python3
# 繁星之夜 · 点赞/评论后端（零依赖：Python 标准库 + SQLite）
# 环境变量：FX_DB（数据库路径）、FX_ADMIN_KEY（后台查看密钥）、FX_PORT（监听端口）
import json, os, time, sqlite3, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

DB    = os.environ.get("FX_DB", "/var/lib/funskills/engagement.db")
ADMIN = os.environ.get("FX_ADMIN_KEY", "changeme")
PORT  = int(os.environ.get("FX_PORT", "8090"))
os.makedirs(os.path.dirname(DB), exist_ok=True)
_lock = threading.Lock()

def conn():
    c = sqlite3.connect(DB, timeout=10)
    c.execute("PRAGMA journal_mode=WAL")
    return c

def init():
    c = conn()
    c.execute("CREATE TABLE IF NOT EXISTS likes(slug TEXT, name TEXT, ts INTEGER, UNIQUE(slug,name))")
    c.execute("CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, name TEXT, text TEXT, ts INTEGER)")
    c.commit(); c.close()
init()

class H(BaseHTTPRequestHandler):
    def _h(self, code, ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Cache-Control", "no-store")
    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self._h(code); self.send_header("Content-Length", str(len(body))); self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._h(204); self.send_header("Content-Length", "0"); self.end_headers()

    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path == "/api/stats":
            slug = (q.get("slug", [""])[0])[:64]; name = (q.get("name", [""])[0]).strip()[:24]
            c = conn()
            likes = c.execute("SELECT COUNT(*) FROM likes WHERE slug=?", (slug,)).fetchone()[0]
            liked = bool(name) and c.execute("SELECT 1 FROM likes WHERE slug=? AND name=?", (slug, name)).fetchone() is not None
            cms = [{"name": r[0], "text": r[1], "ts": r[2]}
                   for r in c.execute("SELECT name,text,ts FROM comments WHERE slug=? ORDER BY id DESC LIMIT 300", (slug,))]
            c.close()
            return self._json(200, {"slug": slug, "likes": likes, "liked": liked, "comments": cms})
        if u.path == "/api/summary":
            c = conn()
            by = {}
            for r in c.execute("SELECT slug, COUNT(*) FROM likes GROUP BY slug"):
                by.setdefault(r[0], {"likes": 0, "comments": 0})["likes"] = r[1]
            for r in c.execute("SELECT slug, COUNT(*) FROM comments GROUP BY slug"):
                by.setdefault(r[0], {"likes": 0, "comments": 0})["comments"] = r[1]
            tl = c.execute("SELECT COUNT(*) FROM likes").fetchone()[0]
            tc = c.execute("SELECT COUNT(*) FROM comments").fetchone()[0]
            c.close()
            return self._json(200, {"by_slug": by, "totals": {"likes": tl, "comments": tc}})
        if u.path == "/api/all":
            if (q.get("key", [""])[0]) != ADMIN:
                return self._json(403, {"error": "forbidden"})
            c = conn()
            likes = [{"slug": r[0], "name": r[1], "ts": r[2]} for r in c.execute("SELECT slug,name,ts FROM likes ORDER BY ts DESC")]
            cms = [{"id": r[0], "slug": r[1], "name": r[2], "text": r[3], "ts": r[4]} for r in c.execute("SELECT id,slug,name,text,ts FROM comments ORDER BY ts DESC")]
            byslug = {}
            for l in c.execute("SELECT slug, COUNT(*) FROM likes GROUP BY slug"): byslug.setdefault(l[0], {})["likes"] = l[1]
            for l in c.execute("SELECT slug, COUNT(*) FROM comments GROUP BY slug"): byslug.setdefault(l[0], {})["comments"] = l[1]
            c.close()
            return self._json(200, {"totals": {"likes": len(likes), "comments": len(cms)}, "by_slug": byslug, "likes": likes, "comments": cms})
        return self._json(404, {"error": "not found"})

    def do_POST(self):
        ln = int(self.headers.get("Content-Length", "0") or 0)
        try: data = json.loads(self.rfile.read(ln) or b"{}")
        except Exception: data = {}
        u = urlparse(self.path)
        # 管理员操作：评论增删改 + 删点赞（需密钥）
        if u.path == "/api/admin":
            if str(data.get("key", "")) != ADMIN:
                return self._json(403, {"error": "forbidden"})
            act = data.get("action", "")
            with _lock:
                c = conn()
                if act == "del_comment":
                    c.execute("DELETE FROM comments WHERE id=?", (int(data.get("id", 0)),))
                elif act == "edit_comment":
                    t = str(data.get("text", "")).strip()[:500]
                    if not t: c.close(); return self._json(400, {"error": "内容不能为空"})
                    c.execute("UPDATE comments SET text=? WHERE id=?", (t, int(data.get("id", 0))))
                elif act == "add_comment":
                    aslug = str(data.get("slug", "")).strip()[:64]
                    aname = (str(data.get("name", "")).strip()[:24]) or "管理员"
                    t = str(data.get("text", "")).strip()[:500]
                    if not aslug or not t: c.close(); return self._json(400, {"error": "需要作品和内容"})
                    c.execute("INSERT INTO comments(slug,name,text,ts) VALUES(?,?,?,?)", (aslug, aname, t, int(time.time())))
                elif act == "del_like":
                    c.execute("DELETE FROM likes WHERE slug=? AND name=?", (str(data.get("slug", "")), str(data.get("name", ""))))
                else:
                    c.close(); return self._json(400, {"error": "未知操作"})
                c.commit(); c.close()
            return self._json(200, {"ok": True})

        name = str(data.get("name", "")).strip()[:24]
        slug = str(data.get("slug", "")).strip()[:64]
        if not name or not slug:
            return self._json(400, {"error": "需要昵称和作品"})
        if u.path == "/api/like":
            with _lock:
                c = conn()
                ex = c.execute("SELECT 1 FROM likes WHERE slug=? AND name=?", (slug, name)).fetchone()
                if ex:
                    c.execute("DELETE FROM likes WHERE slug=? AND name=?", (slug, name)); liked = False
                else:
                    c.execute("INSERT OR IGNORE INTO likes(slug,name,ts) VALUES(?,?,?)", (slug, name, int(time.time()))); liked = True
                c.commit()
                n = c.execute("SELECT COUNT(*) FROM likes WHERE slug=?", (slug,)).fetchone()[0]
                c.close()
            return self._json(200, {"likes": n, "liked": liked})
        if u.path == "/api/comment":
            text = str(data.get("text", "")).strip()[:500]
            if not text:
                return self._json(400, {"error": "评论不能为空"})
            with _lock:
                c = conn()
                c.execute("INSERT INTO comments(slug,name,text,ts) VALUES(?,?,?,?)", (slug, name, text, int(time.time())))
                c.commit(); c.close()
            return self._json(200, {"ok": True})
        return self._json(404, {"error": "not found"})

    def log_message(self, *a): pass

if __name__ == "__main__":
    print("FunSkills engagement API on 127.0.0.1:%d  DB=%s" % (PORT, DB))
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
