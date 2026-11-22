"""Build a Roblox place file (.rbxlx) from a Rojo-style game folder — no Rojo needed.
Open the result in Roblox Studio (double-click) and press Play.

  python3 roblox/tools/build_place.py roblox/games/<slug> [out.rbxlx]

Supports the template layout: default.project.json tree with $path folders, *.server.luau (Script),
*.client.luau (LocalScript), *.luau (ModuleScript), folders (Folder), and simple $properties
(bool / number / Technology enum).
"""
import json
import os
import sys
from xml.sax.saxutils import escape

ENUMS = {"Technology": {"Legacy": 0, "Voxel": 1, "Compatibility": 2, "ShadowMap": 3, "Future": 4}}
_ref = [0]


def ref():
    _ref[0] += 1
    return f"RBX{_ref[0]:08X}"


def prop_xml(name, value):
    if isinstance(value, bool):
        return f'<bool name="{name}">{str(value).lower()}</bool>'
    if isinstance(value, (int, float)):
        return f'<float name="{name}">{value}</float>'
    if name in ENUMS and value in ENUMS[name]:
        return f'<token name="{name}">{ENUMS[name][value]}</token>'
    return ""


def item(cls, name, props="", children="", source=None):
    src = f'<ProtectedString name="Source">{escape(source)}</ProtectedString>' if source is not None else ""
    return (f'<Item class="{cls}" referent="{ref()}"><Properties><string name="Name">{escape(name)}</string>'
            f"{props}{src}</Properties>{children}</Item>")


def from_path(path, name):
    if os.path.isdir(path):
        init = None
        kids = []
        for f in sorted(os.listdir(path)):
            full = os.path.join(path, f)
            if f in ("init.luau", "init.server.luau", "init.client.luau"):
                init = full
                continue
            node = from_path(full, f)
            if node:
                kids.append(node)
        if init:
            cls = "Script" if ".server." in init else "LocalScript" if ".client." in init else "ModuleScript"
            return item(cls, name, children="".join(kids), source=open(init, encoding="utf-8").read())
        return item("Folder", name, children="".join(kids))
    for suf, cls in ((".server.luau", "Script"), (".client.luau", "LocalScript"), (".luau", "ModuleScript"), (".lua", "ModuleScript")):
        if path.endswith(suf):
            base = os.path.basename(path)[: -len(suf)]
            return item(cls, base, source=open(path, encoding="utf-8").read())
    return ""


def node(name, spec, root):
    cls = spec.get("$className", name)
    props = "".join(prop_xml(k, v) for k, v in spec.get("$properties", {}).items())
    if "$path" in spec:
        inner = from_path(os.path.join(root, spec["$path"]), name)
        return inner
    kids = "".join(node(k, v, root) for k, v in spec.items() if not k.startswith("$"))
    return item(cls, name, props, kids)


def main():
    game = sys.argv[1]
    proj = json.load(open(os.path.join(game, "default.project.json")))
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(game, proj["name"] + ".rbxlx")
    tree = proj["tree"]
    body = "".join(node(k, v, game) for k, v in tree.items() if not k.startswith("$"))
    xml = f'<roblox version="4">{body}</roblox>'
    with open(out, "w", encoding="utf-8") as f:
        f.write(xml)
    print(f"[place] wrote {out} ({os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    main()
