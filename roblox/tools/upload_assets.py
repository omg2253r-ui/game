#!/usr/bin/env python3
"""Upload a game's UI art (art/ui/*.png) to Roblox via the Open Cloud Assets API and write the
resulting asset ids into src/shared/Config/UiImages.luau.

Run on YOUR PC (needs internet + an API key). Stdlib only, no pip installs.

  set ROBLOX_API_KEY=...            (Windows: setx ROBLOX_API_KEY ...)   Creator Dashboard > Open Cloud > API Keys,
                                    permission: Assets -> Read + Write
  python roblox/tools/upload_assets.py --game roblox/games/gun-forge --user-id 123456789 --dry-run
  python roblox/tools/upload_assets.py --game roblox/games/gun-forge --user-id 123456789
  python roblox/tools/upload_assets.py --game roblox/games/gun-forge --group-id 987654   (group-owned game)

Options: --type Image|Decal (default Image), --only key1,key2, --force (re-upload keys that already have an id),
         --dry-run (list what would be uploaded, call nothing).
Already-uploaded keys (id != rbxassetid://0) are skipped, so the script is safe to re-run.
"""
import argparse, json, os, re, sys, time, uuid
import urllib.request, urllib.error

API = "https://apis.roblox.com/assets/v1"
ENTRY = re.compile(r'^(I\.(\w+) = \{ id = ")([^"]*)(", file = "([^"]+)".*)$')


def fail(msg: str):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def multipart(fields: dict, file_field: str, filename: str, data: bytes, ctype: str):
    boundary = "----rbx" + uuid.uuid4().hex
    out = b""
    for k, v in fields.items():
        out += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    out += (f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'
            f'Content-Type: {ctype}\r\n\r\n').encode() + data + f"\r\n--{boundary}--\r\n".encode()
    return out, f"multipart/form-data; boundary={boundary}"


def call(req: urllib.request.Request):
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        hint = {401: "API key invalid or missing Assets permission", 403: "key lacks Assets Write permission or wrong creator/IP allow-list",
                429: "rate limited - wait a minute and re-run", 400: "bad request (check file is a valid PNG < 20MB / name)"}.get(e.code, "")
        fail(f"HTTP {e.code} from Roblox: {body[:300]} {('-> ' + hint) if hint else ''}")
    except urllib.error.URLError as e:
        fail(f"cannot reach Roblox ({e.reason}). Check your internet connection.")


def upload(key: str, path: str, args, creator: dict):
    req_json = {"assetType": args.type, "displayName": f"{args.prefix}_{key}"[:50],
                "description": "Gun Forge UI art", "creationContext": {"creator": creator}}
    with open(path, "rb") as f:
        data = f.read()
    body, ctype = multipart({"request": json.dumps(req_json)}, "fileContent", os.path.basename(path), data, "image/png")
    r = urllib.request.Request(f"{API}/assets", data=body, method="POST",
                               headers={"x-api-key": args.key, "Content-Type": ctype})
    op = call(r)
    opid = op.get("operationId") or (op.get("path", "").split("/")[-1])
    if not opid:
        fail(f"no operation id in response: {op}")
    for _ in range(60):  # up to ~2 min
        if op.get("done"):
            break
        time.sleep(2)
        op = call(urllib.request.Request(f"{API}/operations/{opid}", headers={"x-api-key": args.key}))
    if not op.get("done"):
        fail(f"{key}: timed out waiting for operation {opid} (re-run later)")
    if "error" in op:
        fail(f"{key}: Roblox rejected the asset: {op['error']} (moderation or bad image)")
    aid = (op.get("response") or {}).get("assetId")
    if not aid:
        fail(f"{key}: finished but no assetId: {op}")
    return str(aid)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--game", default="roblox/games/gun-forge", help="game folder (has art/ui and src/shared/Config/UiImages.luau)")
    ap.add_argument("--user-id", help="your Roblox user id (owner of the assets)")
    ap.add_argument("--group-id", help="group id instead of --user-id")
    ap.add_argument("--type", default="Image", choices=["Image", "Decal"])
    ap.add_argument("--prefix", default="GunForge")
    ap.add_argument("--only", help="comma list of keys")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    args.key = os.environ.get("ROBLOX_API_KEY", "")
    cfg = os.path.join(args.game, "src/shared/Config/UiImages.luau")
    if not os.path.exists(cfg):
        fail(f"{cfg} not found - run from the repo root or pass --game")
    if not args.dry_run:
        if not args.key:
            fail("ROBLOX_API_KEY is not set. Create a key at https://create.roblox.com/dashboard/credentials (Assets: Read+Write).")
        if bool(args.user_id) == bool(args.group_id):
            fail("pass exactly one of --user-id or --group-id")
    creator = {"userId": args.user_id} if args.user_id else {"groupId": args.group_id}
    only = set(args.only.split(",")) if args.only else None

    lines = open(cfg, encoding="utf-8").read().split("\n")
    todo, missing = [], []
    for i, ln in enumerate(lines):
        m = ENTRY.match(ln)
        if not m:
            continue
        key, cur, rel = m.group(2), m.group(3), m.group(5)
        if only and key not in only:
            continue
        if cur not in ("", "rbxassetid://0") and not args.force:
            continue
        path = os.path.join(args.game, rel)
        (todo if os.path.exists(path) else missing).append((i, key, path))
    print(f"{len(todo)} to upload, {len(missing)} png missing (not generated yet), type={args.type}")
    for _, k, p in missing[:10]:
        print(f"  missing: {p}")
    if args.dry_run:
        for _, k, p in todo:
            print(f"  would upload {k}  <- {p}")
        return
    done = 0
    for i, key, path in todo:
        aid = upload(key, path, args, creator)
        m = ENTRY.match(lines[i])
        lines[i] = f"{m.group(1)}rbxassetid://{aid}{m.group(4)}"
        done += 1
        print(f"[{done}/{len(todo)}] {key} -> rbxassetid://{aid}")
        with open(cfg, "w", encoding="utf-8") as f:  # save after each so a crash loses nothing
            f.write("\n".join(lines))
        time.sleep(0.5)
    print(f"Done. Ids written to {cfg}. Rebuild/sync with Rojo. Note: new assets may take a minute to moderate; "
          f"images owned by you play in your own game. If a group owns the game, upload with --group-id.")


if __name__ == "__main__":
    main()
