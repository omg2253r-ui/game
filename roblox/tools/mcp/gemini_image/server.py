"""gemini_image_mcp — MCP server (stdio) for generating game art with Google Gemini image models.

Tools
  gemini_list_image_models   list models on your account that can output images
  gemini_generate_image      text -> PNG file (aspect ratio, optional chroma-key transparency, resize)
  gemini_edit_image          image(s) + text -> PNG (restyle, variations, consistent characters)
  gemini_generate_batch      many images from a JSON spec (game UI sets, icons, backgrounds)

Auth: env GEMINI_API_KEY (sent as x-goog-api-key). In a Claude cloud environment the key can instead
live in Network secrets for generativelanguage.googleapis.com; then leave GEMINI_API_KEY unset.
Also usable as a CLI:  python server.py batch spec.json   |   python server.py gen "prompt" out.png 16:9
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import os
import sys
from typing import List, Optional

import httpx
try:  # MCP Python SDK v2
    from mcp.server.mcpserver import MCPServer as _Server
except ImportError:  # v1 fallback
    from mcp.server.fastmcp import FastMCP as _Server  # type: ignore
from mcp.types import ToolAnnotations
from pydantic import BaseModel, ConfigDict, Field

API = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
ASPECTS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
mcp = _Server("gemini_image_mcp", instructions="Generate and edit game art (UI, icons, backgrounds, concept art) with Google Gemini image models. Files are saved as PNG.")


def _headers() -> dict:
    # dummy value is replaced by the Claude network proxy when the key is stored as a network secret
    return {"x-goog-api-key": os.environ.get("GEMINI_API_KEY", "proxy-injected"), "Content-Type": "application/json"}


def _err(resp: httpx.Response) -> str:
    try:
        msg = resp.json().get("error", {}).get("message", resp.text[:300])
    except Exception:
        msg = resp.text[:300]
    hint = {
        400: "Check the prompt/aspect ratio; the model may not support image output — call gemini_list_image_models.",
        401: "API key missing/invalid: set GEMINI_API_KEY or the x-goog-api-key network secret.",
        403: "Key lacks access to this model or the API is not enabled for the project.",
        404: "Model not found — call gemini_list_image_models and pass one of those names.",
        429: "Rate limit / quota reached — wait a minute or use a lower-tier model.",
    }.get(resp.status_code, "")
    if "API key" in msg:
        hint = "Add your key: env GEMINI_API_KEY, or a Network secret for generativelanguage.googleapis.com with header x-goog-api-key (get one at https://aistudio.google.com/apikey)."
    return f"Error {resp.status_code}: {msg} {hint}".strip()


def _postprocess(png: bytes, key_color: Optional[str], size: Optional[List[int]]) -> bytes:
    if not key_color and not size:
        return png
    from PIL import Image  # lazy: Pillow only needed for post-processing

    img = Image.open(io.BytesIO(png)).convert("RGBA")
    if key_color:  # chroma key: remove the solid background colour we asked the model to paint
        kc = tuple(int(key_color.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
        px = img.load()
        for y in range(img.height):
            for x in range(img.width):
                r, g, b, a = px[x, y]
                d = abs(r - kc[0]) + abs(g - kc[1]) + abs(b - kc[2])
                if d < 90:
                    px[x, y] = (r, g, b, 0)
                elif d < 160:  # soft edge + despill
                    px[x, y] = (r, min(g, max(r, b)) if kc[1] > 200 else g, b, int(a * (d - 90) / 70))
    if size:
        img = img.resize((size[0], size[1]), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


async def _generate(prompt: str, out_path: str, aspect: str, model: str, images: List[str],
                    transparent: bool, size: Optional[List[int]]) -> dict:
    key = "#00FF00"
    text = prompt + (" Place the subject on a perfectly flat solid pure green (#00FF00) background, no shadows on the background, no green on the subject." if transparent else "")
    parts: list = [{"text": text}]
    for p in images:
        with open(p, "rb") as f:
            parts.append({"inline_data": {"mime_type": "image/png" if p.lower().endswith(".png") else "image/jpeg", "data": base64.b64encode(f.read()).decode()}})
    body = {"contents": [{"parts": parts}], "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect}}}
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.post(f"{API}/models/{model}:generateContent", headers=_headers(), json=body)
    if r.status_code != 200:
        return {"ok": False, "error": _err(r)}
    data = r.json()
    for cand in data.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                png = _postprocess(base64.b64decode(inline["data"]), key if transparent else None, size)
                os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
                with open(out_path, "wb") as f:
                    f.write(png)
                return {"ok": True, "path": os.path.abspath(out_path), "bytes": len(png), "model": model}
    reason = (data.get("candidates") or [{}])[0].get("finishReason") or data.get("promptFeedback", {})
    return {"ok": False, "error": f"No image returned (reason: {reason}). Rephrase the prompt (avoid real brands/people) and retry."}


class GenerateInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    prompt: str = Field(..., min_length=3, max_length=4000, description="What to draw, e.g. 'glossy cartoon gold coin game icon, thick dark outline'")
    out_path: str = Field(..., description="Where to save the PNG, e.g. 'art/ui/coin.png'")
    aspect_ratio: str = Field("1:1", description=f"One of {ASPECTS}")
    transparent: bool = Field(False, description="Ask for a solid green background and key it out -> transparent PNG (icons, characters)")
    size: Optional[List[int]] = Field(None, description="Resize to [width, height] pixels, e.g. [512, 512]")
    model: str = Field(DEFAULT_MODEL, description="Image-capable Gemini model (see gemini_list_image_models)")


class EditInput(GenerateInput):
    input_paths: List[str] = Field(..., min_length=1, max_length=4, description="1-4 reference images (png/jpg) to edit or keep consistent with")


class BatchInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    spec_path: str = Field(..., description="JSON file: {\"style\": \"shared style text\", \"out_dir\": \"art/ui\", \"items\": [{\"name\": \"coin\", \"prompt\": \"...\", \"aspect_ratio\": \"1:1\", \"transparent\": true, \"size\": [512,512]}]}")
    skip_existing: bool = Field(True, description="Skip items whose output file already exists (cheap re-runs)")
    concurrency: int = Field(3, ge=1, le=8, description="Parallel requests")


@mcp.tool(name="gemini_list_image_models", title="List Gemini image models", annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=True))
async def gemini_list_image_models() -> str:
    """List Gemini/Imagen models available to this API key that can generate images.

    Returns JSON: {"models": [{"name", "display_name", "methods"}], "default": "<model>"}.
    """
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{API}/models?pageSize=200", headers=_headers())
    if r.status_code != 200:
        return json.dumps({"error": _err(r)})
    out = []
    for m in r.json().get("models", []):
        name = m.get("name", "").split("/")[-1]
        if "image" in name or "imagen" in name:
            out.append({"name": name, "display_name": m.get("displayName"), "methods": m.get("supportedGenerationMethods")})
    return json.dumps({"models": out, "default": DEFAULT_MODEL}, indent=1)


@mcp.tool(name="gemini_generate_image", title="Generate image with Gemini", annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=True))
async def gemini_generate_image(params: GenerateInput) -> str:
    """Generate one image from a text prompt and save it as PNG.

    Use transparent=true for icons/characters (green-screen keyed). Returns JSON {"ok", "path"|"error"}.
    """
    if params.aspect_ratio not in ASPECTS:
        return json.dumps({"ok": False, "error": f"aspect_ratio must be one of {ASPECTS}"})
    return json.dumps(await _generate(params.prompt, params.out_path, params.aspect_ratio, params.model, [], params.transparent, params.size))


@mcp.tool(name="gemini_edit_image", title="Edit image with Gemini", annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=True))
async def gemini_edit_image(params: EditInput) -> str:
    """Create a new image from 1-4 reference images + instructions (restyle, recolour, variations,
    keep a character consistent). Saves PNG. Returns JSON {"ok", "path"|"error"}."""
    for p in params.input_paths:
        if not os.path.exists(p):
            return json.dumps({"ok": False, "error": f"input not found: {p}"})
    return json.dumps(await _generate(params.prompt, params.out_path, params.aspect_ratio, params.model, params.input_paths, params.transparent, params.size))


async def run_batch(spec_path: str, skip_existing: bool = True, concurrency: int = 3) -> dict:
    with open(spec_path, encoding="utf-8") as f:
        spec = json.load(f)
    style, out_dir = spec.get("style", ""), spec.get("out_dir", ".")
    sem = asyncio.Semaphore(concurrency)
    results = []

    async def one(item):
        path = os.path.join(out_dir, item["name"] + ".png")
        if skip_existing and os.path.exists(path):
            results.append({"name": item["name"], "ok": True, "skipped": True})
            return
        async with sem:
            res = await _generate(f"{item['prompt']}. {style}".strip(), path, item.get("aspect_ratio", "1:1"),
                                  item.get("model", spec.get("model", DEFAULT_MODEL)), item.get("images", []),
                                  item.get("transparent", False), item.get("size"))
        results.append({"name": item["name"], **res})

    await asyncio.gather(*(one(i) for i in spec.get("items", [])))
    ok = sum(1 for r in results if r.get("ok"))
    return {"total": len(results), "ok": ok, "failed": [r for r in results if not r.get("ok")]}


@mcp.tool(name="gemini_generate_batch", title="Generate image set", annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=True))
async def gemini_generate_batch(params: BatchInput) -> str:
    """Generate many images from a JSON spec with one shared style (consistent game UI sets).
    Skips files that already exist, so re-running only fills gaps. Returns JSON summary + failures."""
    if not os.path.exists(params.spec_path):
        return json.dumps({"error": f"spec not found: {params.spec_path}"})
    return json.dumps(await run_batch(params.spec_path, params.skip_existing, params.concurrency), indent=1)


def _cli():
    cmd = sys.argv[1]
    if cmd == "batch":
        print(json.dumps(asyncio.run(run_batch(sys.argv[2])), indent=1))
    elif cmd == "gen":
        aspect = sys.argv[4] if len(sys.argv) > 4 else "1:1"
        print(json.dumps(asyncio.run(_generate(sys.argv[2], sys.argv[3], aspect, DEFAULT_MODEL, [], "--transparent" in sys.argv, None))))
    elif cmd == "models":
        print(asyncio.run(gemini_list_image_models()))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        _cli()
    else:
        mcp.run()
