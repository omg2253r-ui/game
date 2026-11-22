#!/usr/bin/env bash
# Fast, token-free quality gate for a game folder. Run before every hand-off.
#   ./roblox/tools/check.sh roblox/games/<slug> [--release]
# 1) Luau syntax (luau-compile)  2) Roblox type check (luau-lsp + definitions, if present)
# 3) lint rules that catch common Roblox bugs/lag  4) --release: config ids must be set
set -uo pipefail
GAME="${1:?usage: check.sh <game-dir> [--release]}"
RELEASE="${2:-}"
TOOLS="$(cd "$(dirname "$0")" && pwd)"
BIN="${RBX_TOOLS_BIN:-$HOME/.rbx-tools}"   # where luau-compile / luau-lsp / globalTypes.d.luau live
fail=0; warnc=0
err(){ echo "✖ $*"; fail=1; }
wrn(){ echo "⚠ $*"; warnc=$((warnc+1)); }

cd "$GAME" || exit 1
FILES=$(find src -name '*.luau' -o -name '*.lua' | sort)

# 1) syntax
if command -v luau-compile >/dev/null || [ -x "$BIN/luau-compile" ]; then
  LC=$(command -v luau-compile || echo "$BIN/luau-compile")
  for f in $FILES; do "$LC" --null "$f" >/dev/null 2>&1 || { err "syntax: $f"; "$LC" --null "$f" 2>&1 | head -3; }; done
else wrn "luau-compile not found (put it in \$PATH or $BIN) - syntax not checked"; fi

# 2) types
LSP=$(command -v luau-lsp || echo "$BIN/luau-lsp")
if [ -x "$LSP" ] && [ -f "$BIN/globalTypes.d.luau" ]; then
  python3 "$TOOLS/luau/mksourcemap.py" "$PWD" /tmp/rbx-sourcemap.json
  OUT=$("$LSP" analyze --definitions="$BIN/globalTypes.d.luau" --sourcemap=/tmp/rbx-sourcemap.json src 2>&1 | grep -v -E '^\[(INFO|WARN)\]')
  [ -n "$OUT" ] && { echo "$OUT" | head -40; echo "$OUT" | grep -q "TypeError\|SyntaxError" && fail=1; }
else wrn "luau-lsp/globalTypes.d.luau not found - type check skipped"; fi

# 3) lint rules
lint(){ # pattern message severity
  local hits; hits=$(grep -nE "$1" $FILES 2>/dev/null | grep -v -- '-- lint-ok' || true)
  [ -n "$hits" ] && { if [ "$3" = err ]; then err "$2"; else wrn "$2"; fi; echo "$hits" | head -5 | sed 's/^/    /'; }
}
lint '(^|[^.:A-Za-z0-9_])wait\(' "deprecated wait() -> task.wait()" err
lint '(^|[^.:A-Za-z0-9_])(spawn|delay)\(' "deprecated spawn/delay -> task.spawn/task.delay" err
lint ':GetAsync\(|:SetAsync\(|:UpdateAsync\(' "DataStore call - must be inside pcall (verify)" warn
lint 'while true do$' "infinite loop - make sure it yields (task.wait)" warn
lint 'OnServerEvent:Connect' "raw OnServerEvent - use Net.on (rate limit) and validate args" warn
lint 'Instance\.new\("[A-Za-z]+", ' "Instance.new with parent arg is slow - set Parent last" warn
lint 'RenderStepped:Connect' "RenderStepped runs every frame - keep it tiny / prefer Heartbeat" warn
lint 'FireAllClients' "FireAllClients - check payload size & frequency" warn
lint 'loadstring' "loadstring is a security risk" err

# 4) release gate
if [ "$RELEASE" = "--release" ]; then
  grep -nE 'id = 0' src/shared/Config/GamePasses.luau src/shared/Config/Products.luau && err "unset game pass / product ids (id = 0)"
  grep -n 'rbxassetid://0' -r src/shared/Config | head -5 && wrn "placeholder icons (rbxassetid://0)"
  grep -n 'Enabled = true' src/shared/Config/Settings.luau | grep -i collect && wrn "demo Collectibles still enabled"
  for f in docs/PLAN.md; do grep -q '\[ \]' "$f" 2>/dev/null && wrn "$f has unchecked tasks"; done
fi

echo "---- $( [ $fail = 0 ] && echo PASS || echo FAIL ) ($warnc warnings)"
exit $fail
