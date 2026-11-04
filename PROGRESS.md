# PROGRESS

อัปเดต: 2026-11-04 · branch `claude/awesome-knuth-ocl9dj`

## สถานะรวม
Phase 0–11 ใช้งานได้และมีการทดสอบ; Phase 12 พร้อม (CI + deploy config + dry-run ผ่าน) เหลือเพียง deploy จริงด้วยบัญชี Cloudflare ของเจ้าของ — รายละเอียดใน [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), ผลทดสอบใน [TEST_REPORT.md](TEST_REPORT.md)

## Final Acceptance Criteria (บรีฟข้อ 23)

| เกณฑ์ | สถานะ | ยืนยันโดย |
|---|---|---|
| เปิดผ่านเว็บไซต์ได้ | ✅ (local dev/`wrangler dev`) | e2e ทุกชุด; production URL รอ deploy |
| เล่นบน PC ได้ | ✅ | flow desktop |
| เล่นบนมือถือได้ | ✅ | flow mobile portrait + landscape (tap) |
| เดินสำรวจเมืองได้ | ✅ | flow (W), controller + collision |
| เข้าดันเจี้ยนได้ | ✅ | flow / resume |
| ต่อสู้แบบ Turn-Based ได้ | ✅ | combat tests + flow |
| เลือกคำสั่งต่อสู้ได้ | ✅ | flow (Skill/Scan/Attack), showcase (tap) |
| ใช้สกิลได้ | ✅ | flow, showcase (Ultimate) |
| ทำ Tactical Combo ได้ | ✅ | combat test chain → Team Finisher; showcase Team Ultimate + Superconduct |
| ต่อสู้กับ Boss ได้ | ✅ | boss tests, showcase, balance sim |
| รับไอเทมได้ | ✅ | flow (loot → save) |
| ประกอบคอมพิวเตอร์ได้ | ✅ | economy tests + Workshop UI |
| ขายสินค้าได้ | ✅ | Workshop/Market/Orders (store logic) |
| เก็บ Level ได้ | ✅ | world tests; mobile flow ขึ้น Lv2 |
| บันทึกข้อมูลได้ | ✅ | localStorage + D1 server save |
| สร้างห้อง Multiplayer ได้ | ✅ | coop e2e (room code) |
| เล่น Co-op ได้จริง | ✅ | coop e2e 2 browsers |
| ซิงก์ผลการต่อสู้ได้ | ✅ | "round 2 states identical: true" |
| กลับมาเล่นต่อได้หลังออกจากเว็บไซต์ | ✅ | resume e2e (กลางดันเจี้ยน + cloud restore) |
| Test Report | ✅ | TEST_REPORT.md |

## Log
- **Phase 0** — ตรวจ repo: มีเพียง `index.html` ของเกมอื่น (INFINITE FORGE, Supabase) → เก็บไว้ที่ `legacy/infinite-forge/`; ตั้งโปรเจกต์ Vite + TS + Three + Vitest + Wrangler
- **Phase 2–4** — combat engine แบบ pure/deterministic + AI + บอส 5 ตัว (25 tests)
- **Phase 5–7** — dungeon generator, loot, inventory, progression, crafting/market (29 tests)
- **Phase 1, 8, 11** — client 3D: toon shading, rig + AnimationMixer clips, หุ่น 12 แบบ, VFX pool, เมือง, ดันเจี้ยน, battle view/UI, เมนูทั้งหมด, เสียง procedural, layout มือถือ
- **Phase 9–10** — Worker + D1 + RaidRoom DO; e2e co-op/resume
- **Balance** — simulation test + จูน `TUNING`, HP บอส, co-op scaling
- **Phase 12** — CI workflow, dry-run deploy, เอกสาร

## สิ่งที่ยังไม่ได้ทำ / ข้อจำกัดที่ทราบ
- ยังไม่ได้ deploy production (ต้องมี Cloudflare API token + `database_id`)
- ภูมิภาคเข้าผ่าน Dungeon Gate — ยังไม่มี field map เดินต่อเนื่องแบบ open world เต็มรูปแบบ
- Co-op เป็น Raid 3 waves (ต่อสู้ร่วมกัน) ไม่ได้เดินสำรวจดันเจี้ยนพร้อมกัน
- โมเดลตัวละคร/หุ่นเป็น procedural (มี rig + keyframe animation จริง แต่ยังไม่ใช่งานโมเดลจากศิลปิน); เกราะยังไม่เปลี่ยนรูปลักษณ์ตัวละคร
- Single player คำนวณบน client — ป้องกันโกงด้วย validation/plausibility บนเซิร์ฟเวอร์ (co-op เป็น server-authoritative เต็มรูปแบบ)
- WebGPU ยังไม่เปิดใช้ (WebGL 2 baseline); UI ในเกมเป็นภาษาอังกฤษ
- ยังไม่ได้ทดสอบบนอุปกรณ์จริง/Safari iOS
