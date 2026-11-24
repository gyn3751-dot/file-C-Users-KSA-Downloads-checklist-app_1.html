#!/usr/bin/env python3
"""영업사원 브리핑 도구 (내 컴퓨터에서 실행).

입력 : customers.json (customers.sample.json 형식)
출력 : <out>/웰니스_영업고객목록_YYYYMMDD.xlsx, <out>/briefing.png
Gemini 키는 환경변수 GEMINI_API_KEY 또는 홍보실 폴더의 파일에서 찾는다.
키 값은 화면·로그에 절대 출력하지 않는다. 키가 없거나 호출이 실패하면
배너 그림 없이 같은 카드를 만든다(오류로 멈추지 않음).
메일 발송은 이 스크립트가 하지 않는다. Claude Code가 Gmail 커넥터로 보낸다.

사용: python make_briefing.py customers.json --out 출력폴더
선택: --key-dir "Z:\\★ AI경진대회\\★ksa-work\\홍보실"  --no-ai
환경: GEMINI_IMAGE_MODEL(기본 gemini-2.5-flash-image), CHROME_PATH(브라우저 경로)
"""
import argparse, base64, html, json, os, re, shutil, subprocess, sys, tempfile, urllib.request
from pathlib import Path

DEFAULT_KEY_DIR = r"Z:\★ AI경진대회\★ksa-work\홍보실"
COLS = ["고객사명", "사업자번호", "업종", "규모", "담당자", "잠재성", "최근 이슈", "비고"]
COLOR = {"A": "#d9534f", "B": "#f0a030", "C": "#6c8ea4"}
KEY_RE = re.compile(r"AIza[0-9A-Za-z_\-]{30,}")


def find_key(key_dir):
    k = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if k:
        return k.strip()
    d = Path(key_dir)
    if not d.is_dir():
        return None
    for f in sorted(d.rglob("*")):
        if f.is_file() and f.suffix.lower() in {".env", ".txt", ".json", ".key", ""} and f.stat().st_size < 200_000:
            try:
                m = KEY_RE.search(f.read_text(encoding="utf-8", errors="ignore"))
            except OSError:
                continue
            if m:
                return m.group(0)
    return None


def gemini_banner(key, out_png):
    model = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    prompt = ("Wide banner illustration for a wellness business briefing: calm teal and navy gradient, "
              "soft abstract leaves, yoga and health icons, flat modern style. No text, no letters.")
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"responseModalities": ["IMAGE"]}}).encode()
    req = urllib.request.Request(url, body, {"Content-Type": "application/json", "x-goog-api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            data = json.load(r)
        for p in data["candidates"][0]["content"]["parts"]:
            inline = p.get("inlineData") or p.get("inline_data")
            if inline:
                Path(out_png).write_bytes(base64.b64decode(inline["data"]))
                return True
    except Exception as e:  # 키 값이 들어갈 수 있는 상세 메시지는 출력하지 않음
        print("Gemini 호출 실패:", type(e).__name__, "- 배너 없이 진행")
    return False


def make_xlsx(customers, path):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    rank = {"A": 0, "B": 1, "C": 2}
    rows = sorted(customers, key=lambda c: rank.get(c.get("잠재성", "C"), 3))
    wb = Workbook(); ws = wb.active; ws.title = "고객목록"
    ws.append(COLS)
    for c in rows:
        ws.append([str(c.get(k, "확인 필요")) for k in COLS])
    side = Side(style="thin", color="999999")
    for row in ws.iter_rows():
        for cell in row:
            cell.border = Border(top=side, bottom=side, left=side, right=side)
            cell.alignment = Alignment(wrap_text=True, vertical="top") if cell.row > 1 else Alignment(horizontal="center")
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF"); cell.fill = PatternFill("solid", fgColor="1F4E78")
    for col, w in zip("ABCDEFGH", [20, 24, 22, 24, 24, 9, 50, 40]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A2"
    for r in range(2, ws.max_row + 1):
        ws.cell(r, 2).number_format = "@"
    wb.save(path)
    return rows


def make_html(rows, meta, banner_png):
    cnt = {g: sum(1 for c in rows if c.get("잠재성") == g) for g in "ABC"}
    bg = "linear-gradient(135deg,#1F4E78,#2e8b8b)"
    if banner_png and Path(banner_png).exists():
        b64 = base64.b64encode(Path(banner_png).read_bytes()).decode()
        bg = f"linear-gradient(rgba(20,50,80,.55),rgba(20,50,80,.55)),url(data:image/png;base64,{b64}) center/cover"
    esc = html.escape
    cards = "".join(
        f'<div class="c" style="border-color:{COLOR.get(c.get("잠재성"), "#999")}">'
        f'<span class="tag" style="background:{COLOR.get(c.get("잠재성"), "#999")}">{esc(c.get("잠재성", "?"))}</span>'
        f'<h3>{esc(c["고객사명"])}</h3><div class="t">{esc(c.get("업종", ""))} · {esc(c.get("규모", ""))}</div>'
        f'<p>{esc(c.get("최근 이슈", ""))}</p></div>' for c in rows)
    boxes = "".join(f'<div class="b" style="background:{COLOR[g]}"><b>{cnt[g]}</b>{g} 등급</div>' for g in "ABC")
    return f"""<!doctype html><meta charset="utf-8"><style>
body{{margin:0;width:900px;font-family:'Malgun Gothic','Noto Sans CJK KR','WenQuanYi Zen Hei',sans-serif;background:#f4f7fb;color:#1b2a3a}}
.h{{background:{bg};color:#fff;padding:34px 32px}}.h h1{{margin:0;font-size:28px}}.h p{{margin:8px 0 0;font-size:15px}}
.s{{display:flex;gap:12px;padding:18px 32px 6px}}.b{{flex:1;border-radius:12px;padding:14px;color:#fff;text-align:center}}.b b{{display:block;font-size:30px}}
.g{{padding:10px 32px 24px;display:grid;grid-template-columns:1fr 1fr;gap:14px}}
.c{{background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 4px #0002;border-left:8px solid}}
.c h3{{margin:0 0 4px;font-size:18px}}.t{{font-size:12px;color:#5a6b7b;margin-bottom:6px}}.c p{{margin:0;font-size:13.5px;line-height:1.5}}
.tag{{float:right;color:#fff;border-radius:10px;padding:1px 10px;font-size:13px}}.f{{padding:0 32px 22px;font-size:12px;color:#6b7a89}}
</style><div class=h><h1>웰니스·웰빙 영업 고객 브리핑</h1><p>{esc(meta.get("date", ""))} · 기사 {meta.get("articles", 5)}건 · 고객사 {len(rows)}곳</p></div>
<div class=s>{boxes}</div><div class=g>{cards}</div>
<div class=f>사업자번호·매출·담당자는 확인하지 못한 경우 엑셀에 "확인 필요/미매칭"으로 표기했습니다. 등급은 잠정 분류입니다.</div>"""


def find_browser():
    p = os.environ.get("CHROME_PATH")
    cands = [p] if p else []
    cands += [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"]
    for n in ("msedge", "chrome", "google-chrome", "chromium"):
        w = shutil.which(n)
        if w:
            cands.append(w)
    return next((c for c in cands if c and Path(c).exists()), None)


def screenshot(html_path, png_path, rows):
    exe = find_browser()
    if not exe:
        sys.exit("Edge/Chrome를 찾지 못했습니다. CHROME_PATH 환경변수에 브라우저 경로를 지정하세요.")
    height = 330 + ((len(rows) + 1) // 2) * 120
    subprocess.run([exe, "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=2", f"--window-size=900,{height}",
                    f"--screenshot={png_path}", Path(html_path).resolve().as_uri()],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json_path"); ap.add_argument("--out", default="out")
    ap.add_argument("--key-dir", default=DEFAULT_KEY_DIR); ap.add_argument("--no-ai", action="store_true")
    a = ap.parse_args()
    meta = json.loads(Path(a.json_path).read_text(encoding="utf-8"))
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    ymd = meta.get("date", "").replace("-", "") or "날짜없음"
    rows = make_xlsx(meta["customers"], out / f"웰니스_영업고객목록_{ymd}.xlsx")
    banner = None
    if not a.no_ai:
        key = find_key(a.key_dir)
        print("Gemini 키:", "찾음" if key else "없음(배너 없이 진행)")
        if key and gemini_banner(key, out / "banner.png"):
            banner = out / "banner.png"
    html_path = out / "briefing.html"
    html_path.write_text(make_html(rows, meta, banner), encoding="utf-8")
    screenshot(html_path, out / "briefing.png", rows)
    print("완료:", *(p.name for p in sorted(out.iterdir())))


if __name__ == "__main__":
    main()
