#!/usr/bin/env bash
# One-time: download the free Luau toolchain used by check.sh into ~/.rbx-tools (Linux/macOS).
# Rojo (Studio sync) is installed separately: https://rojo.space/docs/v7/getting-started/installation/
set -euo pipefail
BIN="${RBX_TOOLS_BIN:-$HOME/.rbx-tools}"; mkdir -p "$BIN"; cd "$BIN"
case "$(uname -s)" in Linux) L=luau-ubuntu.zip; P=luau-lsp-linux-x86_64.zip;; Darwin) L=luau-macos.zip; P=luau-lsp-macos.zip;; *) echo "use WSL on Windows"; exit 1;; esac
curl -sSL -o luau.zip "https://github.com/luau-lang/luau/releases/latest/download/$L" && unzip -o -q luau.zip
curl -sSL -o lsp.zip "https://github.com/JohnnyMorganz/luau-lsp/releases/latest/download/$P" && unzip -o -q lsp.zip
curl -sSL -o globalTypes.d.luau https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/main/scripts/globalTypes.None.d.luau
rm -f luau.zip lsp.zip; chmod +x luau* || true
echo "✔ tools in $BIN"
