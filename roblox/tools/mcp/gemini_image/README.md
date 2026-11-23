# gemini_image_mcp — Gemini image generation for the rbx team

MCP server (stdio, Python, MCP SDK v1/v2) + CLI that turns prompts into PNG game art.

| Tool | What it does |
|---|---|
| `gemini_list_image_models` | image-capable models on your key |
| `gemini_generate_image` | prompt → PNG (`aspect_ratio`, `transparent` green-key, `size`) |
| `gemini_edit_image` | 1–4 reference images + prompt → PNG (variants, consistent characters) |
| `gemini_generate_batch` | JSON spec → whole UI/icon set with one shared style (skips existing files) |

## Setup
1. Key: https://aistudio.google.com/apikey
2. `pip install -r roblox/tools/mcp/gemini_image/requirements.txt`
3. Claude Code picks up `.mcp.json` at the repo root (project scope). Provide the key one of two ways:
   - local: `export GEMINI_API_KEY=...` (Windows: `setx GEMINI_API_KEY ...`) before starting `claude`
   - Claude cloud environment: Network secret → host `generativelanguage.googleapis.com`, header `x-goog-api-key`
   Or add manually: `claude mcp add gemini_image -- python roblox/tools/mcp/gemini_image/server.py`
4. Model override: `GEMINI_IMAGE_MODEL` (default `gemini-2.5-flash-image`).

## CLI (no MCP client needed)
```bash
python roblox/tools/mcp/gemini_image/server.py models
python roblox/tools/mcp/gemini_image/server.py gen "glossy gold coin icon" art/ui/coin.png 1:1 --transparent
python roblox/tools/mcp/gemini_image/server.py batch roblox/games/gun-forge/art/ui/gemini_spec.json
```
Batch spec: `{"style": "...", "out_dir": "...", "model": "...", "items": [{"name", "prompt", "aspect_ratio", "transparent", "size", "images"}]}`
