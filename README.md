# SCRAPBOUND: Dungeon of Machines

เกม 3D Anime Turn-Based RPG บนเว็บ — สำรวจเมืองและดันเจี้ยนแบบ real-time, ต่อสู้แบบ **turn-based** ที่มี Elemental Reaction, Armor Break, Chain, Team Combo/Ultimate, เก็บชิ้นส่วนคอมพิวเตอร์จากหุ่นยนต์มาประกอบ PC ขาย และเล่น **Co-op 2–4 คน** ผ่าน Cloudflare Durable Objects

- เล่นได้ทั้ง PC (คีย์บอร์ด/เมาส์) และมือถือ (จอยสติ๊กเสมือน, แตะ, layout แยก portrait/landscape)
- Single player เล่นออฟไลน์ได้ (บันทึกในเครื่อง) — ถ้ามีเซิร์ฟเวอร์จะได้ cloud save + co-op

## เริ่มใช้งาน

```bash
npm install
```

```bash
npm run dev
```

เปิด http://localhost:5173 (โหมด single player; `/api` จะ proxy ไปที่ worker ถ้ารันอยู่)

### รันพร้อมเซิร์ฟเวอร์ (cloud save + co-op)

```bash
npm run build
```

```bash
npm run db:migrate:local
```

```bash
npm run dev:server
```

เปิด http://127.0.0.1:8787 (Worker เสิร์ฟทั้งไฟล์เกมและ API) — หลัง `npm run build` ใหม่ ให้รีสตาร์ต `dev:server` เพราะ wrangler cache รายการ asset ไว้

## ทดสอบ

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run e2e
```

`npm run e2e` เล่นเกมจริงใน headless Chromium (ต้องเปิด `npm run dev` และ `npm run dev:server` ไว้; ใส่ `COOP=0` เพื่อข้ามชุด co-op) — ผลล่าสุดดู [TEST_REPORT.md](TEST_REPORT.md)

## Deploy (Cloudflare Workers + Static Assets + D1 + Durable Objects)

```bash
npx wrangler d1 create scrapbound
```

นำ `database_id` ที่ได้ไปใส่ใน `wrangler.toml` แล้ว

```bash
npm run db:migrate:remote
```

```bash
npm run deploy
```

CI (`.github/workflows/ci.yml`) จะ typecheck, test, build และ dry-run bundle ทุก push และ deploy อัตโนมัติจาก `main` เมื่อมี secret `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` — **ไม่มีข้อมูลลับใน repository**

## การควบคุม

| | PC | มือถือ |
|---|---|---|
| เดิน / วิ่ง | WASD / Shift | จอยซ้าย (ดันสุด = วิ่ง) |
| กล้อง | ลากเมาส์, ล้อ = ซูม, Z/C หมุน | ลากจอ, pinch ซูม |
| โต้ตอบ | E / Enter | ปุ่ม ✋ หรือแตะป้าย |
| เมนู | I กระเป๋า · K สกิล · J เควส · M ตั้งค่า | ปุ่มมุมขวาบน |
| ต่อสู้ | 1–9/0 คำสั่ง · ←/→ เลือกเป้า · Enter ยืนยัน · Esc ย้อน · A auto · Space ความเร็ว | แตะปุ่ม/แตะศัตรู |

## เอกสาร

- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) — แผน 13 phase และสถานะ
- [GAME_DESIGN.md](GAME_DESIGN.md) — ระบบเกมทั้งหมด
- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) — สถาปัตยกรรม, protocol, ความปลอดภัย
- [PROGRESS.md](PROGRESS.md) — ความคืบหน้าและสิ่งที่ยังเหลือ
- [TEST_REPORT.md](TEST_REPORT.md) — ผลการทดสอบ

`legacy/infinite-forge/` คือหน้าเว็บเกมเดิมที่อยู่ใน repo ก่อนหน้า (เก็บไว้ ไม่ได้ใช้แล้ว)
