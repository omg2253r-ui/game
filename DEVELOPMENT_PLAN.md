# DEVELOPMENT PLAN — SCRAPBOUND: Dungeon of Machines

หลักการ: ทุก phase ต้อง **build ผ่าน + มี test** ก่อนไป phase ถัดไป. ลำดับความสำคัญตามบรีฟ: Turn-Based Combat → Tactical Combo → 3D Anime Visuals → PC/Mobile Compatibility.

สถานะ: ✅ เสร็จและทดสอบแล้ว · 🟡 ใช้งานได้แต่ยังขยายต่อได้ · ⬜ ยังไม่เริ่ม

| Phase | งาน | สถานะ | หลักฐาน |
|---|---|---|---|
| 0 | ตรวจ workspace, ออกแบบ architecture, ตั้ง Vite + TS + Three.js + Wrangler | ✅ | repo เดิมมีแค่ `index.html` (เกมอื่น, Supabase) → ย้ายไป `legacy/`; โครงใหม่ดู TECHNICAL_ARCHITECTURE.md |
| 1 | 3D world + character controller (third-person, WASD/joystick, กล้องหมุน/ซูม, collision) | ✅ | `src/client/world/controller.ts`, `city.ts`; e2e flow |
| 2 | Turn-based combat engine (round, turn order, คำสั่ง 9+ แบบ, validation, deterministic) | ✅ | `src/core/combat/engine.ts`; 25 unit tests |
| 3 | Skill, Tactical Combo, Elemental System (7 ธาตุ, 9 reactions, chain, armor break, follow-up, team combo/finisher/ultimate) | ✅ | `tests/combat.test.ts` (เช่น chain Electric→Shock→Plasma Burst→Break→Team Finisher) |
| 4 | Enemy AI (utility-based) + 7 ศัตรู + 5 บอสหลาย phase พร้อมกลไกเฉพาะ | ✅ | `ai.ts`, `enemies.ts`; boss tests |
| 5 | Dungeon (procedural rooms, hidden room, events, mini-boss, boss, 4 ความยาก) + Loot (drop table ต่อหุ่น, 6 rarity) | ✅ | `generator.ts`, `loot.ts`; `tests/world.test.ts`, `tests/economy.test.ts` |
| 6 | RPG: EXP/Level, stats, skill tree 17 nodes, equipment, weapon enhancement, inventory (sort/filter/compare/lock/sell/storage) | ✅ | `progression.ts`, `store.ts`, `menus.ts` |
| 7 | Crafting PC 6 แบบ + compatibility (socket, RAM type, PCIe/ความยาว GPU, PSU +10%, cooling) + market, orders, contracts | ✅ | `crafting.ts`; 11 economy tests |
| 8 | Semi-open world: Hunter City (shops, guild, workshop, market, quest board, storage, lobby, gate) + NPC | ✅ 🟡 | 5 ภูมิภาคเข้าผ่าน Dungeon Gate (ยังไม่มี field map เดินต่อเนื่องระหว่างภูมิภาค) |
| 9 | Multiplayer turn sync (room code, ready, action lock, timer, reconnection, disconnect AI, shared rewards) | ✅ | `server/room.ts`; e2e 2 ผู้เล่นจริง |
| 10 | Account (guest + username/password), D1 migration, server save, anti-cheat | ✅ | `server/index.ts`, `server/migrations/`; resume/cloud e2e |
| 11 | Mobile optimization + UI polish (portrait/landscape layouts, touch targets ≥ 44px, quality settings, auto-downgrade) | ✅ 🟡 | screenshots ใน TEST_REPORT.md |
| 12 | Testing + Cloudflare deployment config + CI | ✅ 🟡 | CI + `wrangler deploy --dry-run` ผ่าน; ยังไม่ได้ deploy จริงเพราะ session นี้ไม่มี Cloudflare credentials |

## งานถัดไป (backlog เรียงตามความสำคัญ)

1. Deploy ขึ้น Cloudflare จริง (ต้องใช้ `database_id` + API token ของเจ้าของ)
2. Field map ของแต่ละภูมิภาค (Abandoned City ฯลฯ) แบบเดินต่อเนื่องก่อนเข้าดันเจี้ยน
3. Co-op แบบเดินสำรวจดันเจี้ยนร่วมกัน (ตอนนี้ co-op เป็น Raid 3 waves)
4. โมเดล/แอนิเมชันจากศิลปิน (GLTF + skinned mesh) แทนโมเดล procedural; ระบบชุด/เกราะแสดงผลบนตัวละคร
5. WebGPU renderer (Three.js `WebGPURenderer`) เป็นตัวเลือกบนเบราว์เซอร์ที่รองรับ
6. ระบบแชท/emote ใน co-op UI (ฝั่ง server รองรับ `chat` แล้ว)
7. Localization ไทย/อังกฤษสำหรับ UI ในเกม
