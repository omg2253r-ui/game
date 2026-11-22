# 🔫 Gun Forge Simulator — คู่มือ

## วิธีที่ง่ายที่สุด (ไม่ต้องติดตั้งอะไรเพิ่ม)
1. ติดตั้ง Roblox Studio (https://create.roblox.com → Start Creating) บน PC/Mac
2. ดาวน์โหลด `GunForge.rbxlx` (อยู่ในโฟลเดอร์นี้) → ดับเบิลคลิก หรือ Studio → File → Open from File
3. กด **Play** (F5) — เล่นได้เลย
> สร้างไฟล์ใหม่หลังแก้โค้ด: `python3 roblox/tools/build_place.py roblox/games/gun-forge`

## วิธีสำหรับนักพัฒนา (Rojo — แก้โค้ดแล้ว sync สด)
1. ติดตั้ง [Rojo](https://rojo.space/docs/v7/getting-started/installation/) (ปลั๊กอิน Studio + CLI)
2. `cd roblox/games/gun-forge && rojo serve`
3. เปิด Studio → Baseplate ใหม่ → ปลั๊กอิน Rojo → **Connect** → กด **Play**
4. ทดสอบเซฟ: Game Settings → Security → เปิด *Enable Studio Access to API Services* (ต้อง Publish เกมก่อน 1 ครั้ง)
5. ทดสอบ PvP / เตะกันจริง: Test → Clients and Servers → 2–4 Players

> แมพทั้งหมด (Hub, 5 โซน, อารีน่า 3 สนาม) สร้างด้วยโค้ดอัตโนมัติ — มอน ปืน สัตว์เลี้ยง มีรูปร่างสำรองจากโค้ด เล่นได้เลย
> ใน Studio เกมพาส/สินค้าที่ id = 0 กดซื้อทดสอบได้ฟรี (จะได้ของจริงในเซิร์ฟเวอร์ทดสอบ)

## วิธีเล่น
| ระบบ | ที่ไหน |
|---|---|
| ฝึก AFK (+Power ทุกวินาที) | อัตโนมัติ — ปุ่ม TRAINING ล่างจอ |
| ปุ่ม **x2** | เด้งขึ้นทุก 45–75 วิ กดภายใน 6 วิ → x2 นาน 30 วิ |
| มินิเกม 3 แบบ | ตู้ในฮับ หรือปุ่ม GAMES |
| ยิงมอน | ถือเมาส์ซ้าย / ปุ่ม FIRE (มือถือ) / AUTO (เกมพาส) — ล็อกเป้าอัตโนมัติ |
| ประตูโซน | ต้องมี Power ตามที่ป้ายบอก (0 / 2K / 25K / 300K / 5M) |
| ตีปืน/เกราะ | Forge → เลือกสูตร → มินิเกมกดตอกชิ้นส่วน (Perfect = ลุ้นแรร์ขึ้น) |
| สัตว์เลี้ยง | Fusion Altar → ใช้วัสดุ → ลุ้นสุ่ม (แสดงเปอร์เซ็นต์) · ซ้ำ 5 = ทอง · ทอง 5 = รุ้ง |
| PvP 1v1 / 2v2 / 4v4 | Arena Portal หรือปุ่ม PVP — ค่าพลังเท่ากันทุกคน มีแรงค์ |
| ทัวร์นาเมนต์ | ทุก 30 นาที (8 คน) ค่าเข้า 500 Coins ผู้ชนะได้เงินกองกลาง + 40 Gems |
| แคลน | ClanBoard / ปุ่ม CLAN — สร้าง (25K Coins), เชิญ, ยศ, สงครามแคลนรายสัปดาห์ |
| บอสโลก | ทุก 20 นาทีที่ Boss Pit — แบ่งรางวัลตามดาเมจ, ระวังวงแดง! |
| อื่นๆ | Rebirth, Index, Codes (RELEASE / FORGE / THANKS100), Gem Shop, รายวัน, เควส, รางวัลเวลาเล่น, ลีดเดอร์บอร์ด, ฟาร์มตอนออฟไลน์ (≤ 4 ชม.) |

## ก่อนเปิดเกมจริง (Creator Hub)
1. **Monetization → Passes:** สร้าง VIP 299, 2x Training 199, Auto Farm 249, +3 Pet Slots 149, Lucky Forge 349, 2x Drops 199 → ใส่ id ใน `src/shared/Config/GamePasses.luau`
2. **Developer Products:** 1,000 Coins 25, 6,000 Coins 99, 120 Gems 49, x3 Training 39, 700 Gems 249 → `Products.luau`
3. **ไอคอน:** อัปโหลดไฟล์ใน `art/icons/` → ใส่ `rbxassetid://...` ในช่อง `icon`
4. **โมเดล 3D (ไม่บังคับ แต่สวยขึ้นมาก):** 3D Importer → File Dimensions = *Studs* → นำเข้า `art/blender/...` แล้ววางใน
   `ReplicatedStorage/Assets/Guns/<type>` (MeshPart), `Assets/Monsters/<id>`, `Assets/Pets/<id>` (Model) — โค้ดจะใช้แทนรูปร่างสำรองเอง (ดู `docs/ASSETS.md`)
5. **Badges (ไม่บังคับ):** สร้างแล้วใส่ id ใน `Config/Economy.luau → Badges`
6. **หน้าเกม:** Thumbnail `art/store/thumbnail_1920x1080.png` (+ แบบที่ 2 ใน `art/store/v2/` ไว้ A/B test), Icon `art/store/icon_512.png`
7. ตรวจ: `roblox/tools/check.sh roblox/games/gun-forge --release` ต้อง PASS

## ปรับสมดุลเกม (ไม่ต้องแตะโค้ด)
- ความเร็วฝึก / x2 / ออฟไลน์ → `Config/Training.luau`
- มอน HP/ดาเมจ/ของดรอป → `Config/Monsters.luau` · ความยากรวม → `Combat.luau MonsterDamageScale`
- ปืน/เกราะ/แรร์ → `Config/Guns.luau` · สูตรตี → `Recipes.luau` · สัตว์เลี้ยง/อัตราออก → `Pets.luau`
- PvP / ทัวร์ / แคลน / บอสโลก → `Config/Combat.luau` · โค้ดแลกของ → `Codes.luau`
