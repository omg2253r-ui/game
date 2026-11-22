import json, os, sys
root = sys.argv[1]
def node_for(path, name):
    if os.path.isdir(path):
        n = {"name": name, "className": "Folder", "children": []}
        for f in sorted(os.listdir(path)):
            n["children"].append(node_for(os.path.join(path, f), f))
        return n
    base = os.path.basename(path)
    for suf, cls in ((".server.luau", "Script"), (".client.luau", "LocalScript"), (".luau", "ModuleScript")):
        if base.endswith(suf):
            return {"name": base[: -len(suf)], "className": cls, "filePaths": [path]}
    return {"name": base, "className": "Folder"}
src = os.path.join(root, "src")
def svc(name, child, sub):
    n = node_for(os.path.join(src, sub), child); return {"name": name, "className": name, "children": [n]}
sp = {"name": "StarterPlayer", "className": "StarterPlayer", "children": [{"name": "StarterPlayerScripts", "className": "StarterPlayerScripts", "children": [node_for(os.path.join(src, "client"), "Client")]}]}
tree = {"name": "Game", "className": "DataModel", "children": [svc("ReplicatedStorage", "Shared", "shared"), svc("ServerScriptService", "Server", "server"), sp]}
json.dump(tree, open(sys.argv[2], "w"))
