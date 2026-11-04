# TECHNICAL ARCHITECTURE

## Stack
Three.js r187 (WebGL 2) · TypeScript · Vite 8 · Vitest · Cloudflare Workers + Static Assets · Durable Objects (SQLite-backed, hibernatable WebSockets) · D1 · GitHub Actions · Playwright (e2e)

## โครงสร้าง

```
src/
  core/                 ← โค้ด pure TS ไม่พึ่ง DOM/Three — ใช้ร่วมกันทั้ง client และ server
    rng.ts              seeded PRNG (mulberry32) — state เป็น uint32 เก็บใน JSON ได้
    combat/             engine.ts (resolveRound/validate/predictOrder), ai.ts, units.ts, setup.ts, types.ts
    data/               weapons, skills, enemies (+phases), items/statuses, hardware, regions
    dungeon/generator.ts
    economy/            items, loot, crafting (compatibility/pricing/orders/market)
    progression.ts      stats, skill tree, exp, companions
    save.ts             schema, migrate, validateSave, plausibleTransition (anti-cheat)
    net/protocol.ts     co-op message types
  client/
    game.ts             orchestrator: title, creator, city, dungeon run, battles, co-op, HUD, loop
    render/             renderer (quality/bloom/FPS/auto-downgrade), toon, textures, character (rig+clips), robots, vfx (pooled)
    world/              controller (3rd-person + collision), city, dungeon, common
    battle/             battle.ts (planning UI + driver), view.ts (3D playback)   ← lazy-loaded chunk
    ui/                 dom helpers, ui (panels/toasts/banners), menus, items
    input/ audio/ net/ state/
server/
  index.ts              Worker router (auth, save, grants, rooms, ws upgrade), static assets fallback
  room.ts               RaidRoom Durable Object
  auth.ts               PBKDF2, token hashing, input sanitising
  migrations/0001_init.sql
tests/                  vitest: combat, economy, world/save, balance simulation
e2e/                    Playwright scripts: flow (desktop/mobile), showcase, coop (2 browsers), resume
```

## Combat engine
- `createBattle(config) → BattleState` (JSON ล้วน) และ `resolveRound(state, plans) → { state, events }` **ไม่ mutate input** (clone ก่อน) และ **deterministic** จาก `state.rng`
- Validation: `validateAction(state, unitId, action, ownerId?)` + `validatePlans` (นับไอเทมที่ใช้ซ้ำ) — คำสั่งผิดกฎถูกแทนด้วย Defend
- Event list (`dmg`, `status`, `reaction`, `break`, `interrupt`, `phase`, `summon`, `death`, `team`, …) แนบ snapshot HP/armor หลังแต่ละ event → client เล่นแอนิเมชันตามลำดับและอัปเดต UI ได้โดยไม่ต้องคำนวณเอง
- Enemy intents วางแผนตอนเริ่มรอบ (แสดงให้ผู้เล่นเห็น), ท่าชาร์จเก็บเป็น status `charging`
- Single player: client เรียก engine เอง (ไม่มี timer); Co-op: Durable Object เป็นผู้เรียก engine คนเดียว

## Rendering
- ตัวละคร: hierarchy ของ joint (hips/spine/chest/neck/head/shoulder/elbow/thigh/knee) + mesh primitives, toon material แบบ cache + outline inverted hull; แอนิเมชันเป็น `QuaternionKeyframeTrack`/`VectorKeyframeTrack` เล่นด้วย `AnimationMixer` (crossfade, one-shot clamp) และมีเวลา impact ต่อคลิปเพื่อ sync VFX/ดาเมจ
- หุ่นยนต์: procedural models 12 แบบ + state machine animation
- VFX: particle buffer เดียว (ring allocation) + mesh pools (slash/ring/orb/beam/lightning) → ไม่มีการ allocate ต่อ hit
- Performance: Low/Medium/High (pixel ratio, shadows, bloom, particle budget, LOD bias, draw distance); FPS monitor; **auto-downgrade** เมื่อ FPS < 24 ต่อเนื่อง 5 วินาที; `THREE.LOD` อาคารในเมือง; ซ่อนห้องดันเจี้ยนที่อยู่นอกระยะ; shared geometry/material/texture cache + `disposeTree` ตอนเปลี่ยนฉาก; battle code แยก chunk โหลดเมื่อเข้าดันเจี้ยน
- WebGL 2 เป็น baseline; WebGPU (`three/webgpu`) วางแผนไว้เป็นตัวเลือกในอนาคต (renderer ถูกห่อไว้ใน `Renderer` class)

## UI / Input
- DOM overlay (ไม่ใช้ framework) + CSS media queries: desktop, phone portrait (`max-width:760px`), phone landscape (`max-height:520px`) — layout ต่างกันจริง (คำสั่ง 4 คอลัมน์ล่าง / คอลัมน์ขวา, party แถว/คอลัมน์), tap targets ≥ 44px, safe-area insets
- Input: keyboard + mouse drag/wheel, virtual joystick (pointer capture), touch-drag camera, pinch zoom, tap → raycast-ish screen picking ของยูนิตในสนามรบ
- Hover tooltips บน desktop เท่านั้น

## Server
### REST
| Method | Path | หน้าที่ |
|---|---|---|
| GET | /api/health | health |
| POST | /api/auth/guest | สร้าง guest + session |
| POST | /api/auth/register | สมัคร (หรือ upgrade guest เดิม) |
| POST | /api/auth/login | ล็อกอิน |
| GET | /api/me | ข้อมูลผู้ใช้ |
| GET/PUT | /api/save | โหลด/บันทึก save (validate + anti-cheat) |
| POST | /api/grants/claim | รับรางวัลที่เซิร์ฟเวอร์ออกให้ (co-op) |
| POST | /api/rooms | ออก room code |
| GET (WS) | /api/rooms/:code/ws?token= | เข้าห้อง (forward ไป Durable Object) |

### Co-op protocol (`src/core/net/protocol.ts`)
Client → `ready`, `config`, `start`, `plan {round, unitId, action|null, locked}`, `chat`, `leave`, `ping`
Server → `room`, `battle_start`, `round_open {state, deadline, plans}`, `plan`, `round_result {events, state}`, `wave_clear`, `raid_end {rewards}`, `member`, `error`

ลำดับต่อรอบ: server เปิดรอบ (deadline 30s, `setAlarm`) → ผู้เล่นส่ง/แก้/lock คำสั่ง (server validate ด้วย ownerId + round number) → ครบทุกคนหรือหมดเวลา → server รวมแผน (คนหมดเวลา/หลุด → คำสั่งล่าสุดหรือ AI) → `resolveRound` → broadcast events+state เดียวกันให้ทุกคน → client เล่นแอนิเมชันจาก event ชุดเดียวกัน → รอบใหม่

### ความปลอดภัย / Anti-cheat
- รหัสผ่าน PBKDF2-SHA256 100k + salt, เปรียบเทียบ constant-time; session token สุ่ม 256-bit เก็บเป็น SHA-256 hash, หมดอายุ 60 วัน
- Input validation ทุก endpoint (ขนาด body ≤ 600KB, regex username, sanitize ชื่อ), rate limit ต่อ IP/ผู้ใช้ (best-effort ต่อ isolate — แนะนำเพิ่ม Cloudflare WAF rate limiting ใน production)
- `validateSave`: schema, ช่วงค่า, uid ซ้ำ, item def มีจริง, spec ชิ้นส่วนอยู่ในช่วงที่ generator สร้างได้, skill points ≤ level, prerequisite, ของที่สวมต้องมีอยู่จริง
- `plausibleTransition`: จำกัดอัตราเงิน/เลเวล/ของ Legendary ที่เพิ่มต่อเวลาจริง, ห้ามเลเวลลด/เปลี่ยน createdAt (ยกเว้นเริ่มเกมใหม่) — ถูกปฏิเสธจะบันทึก `save_audit`
- Co-op: stats ของ hunter โหลดจาก save บนเซิร์ฟเวอร์ (ไม่เชื่อ client), RNG seed ไม่ถูกส่งให้ client (`publicState`), รางวัลสุ่มบนเซิร์ฟเวอร์และเขียนลง `grants` (idempotent ด้วย `INSERT OR IGNORE` + `grantsClaimed` ใน save)
- ข้อจำกัดที่ยอมรับ: single player คำนวณบน client (เพื่อเล่นออฟไลน์/ไม่ต้องรอเซิร์ฟเวอร์) จึงป้องกันด้วย validation + plausibility ไม่ใช่ server-authoritative เต็มรูปแบบ
- ไม่มี secret ใน repo; `database_id` ไม่ใช่ความลับ; CI ใช้ GitHub secrets

## Persistence
- Local: `localStorage` (`scrapbound.save.v2`, `scrapbound.run.v1` สำหรับดันเจี้ยนที่ค้าง) บันทึกทุก 30 วินาที, ทุกเหตุการณ์สำคัญ, และตอน `pagehide/visibilitychange`
- Server: debounce 2.5s + บันทึกทันทีเมื่อจบการต่อสู้; ตอนบูตเลือก save ที่ `updatedAt` ใหม่กว่า; ถ้าเครื่องไม่มี save แต่มี session จะดึงจาก cloud
- D1 schema: `users`, `sessions`, `saves`, `grants`, `save_audit` (migration ใน `server/migrations`)
- R2: ยังไม่จำเป็น (asset ทั้งหมดสร้าง procedural, bundle ~250KB gzip)

## Deployment
Workers Static Assets (`dist/`) + Worker เดียวสำหรับ `/api/*` (`run_worker_first`) + Durable Object `RaidRoom` + D1 `scrapbound`. ขั้นตอนใน README; CI deploy อัตโนมัติจาก `main` เมื่อมี secrets
