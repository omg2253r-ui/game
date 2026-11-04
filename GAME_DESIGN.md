# GAME DESIGN — SCRAPBOUND: Dungeon of Machines

## 1. Concept
อารยธรรมมนุษย์ล่มสลาย หุ่นยนต์ยึดเทคโนโลยีโบราณไว้ในดันเจี้ยน ผู้เล่นเป็น **Hunter** ที่ทำลายหุ่น เก็บชิ้นส่วน (CPU, GPU, RAM…) กลับมาประกอบคอมพิวเตอร์ขายใน Hunter City — เป้าหมายคือเป็นนักล่าที่แข็งแกร่งและนักธุรกิจเทคโนโลยีที่รวยที่สุด

**Core loop:** Hunter City (เตรียมตัว/ซื้อ/อัปเกรด) → Dungeon Gate → สำรวจดันเจี้ยน (real-time) → ชนหุ่น = **Turn-Based Battle** → loot → บอส → กลับเมือง (วันใหม่: ออร์เดอร์/เควส/ราคาตลาดใหม่) → ประกอบ PC ขาย → ซื้ออุปกรณ์ → ดันเจี้ยนที่ยากขึ้น

## 2. World
- **Hunter City** (hub): Weapon Shop, Armor Shop, PC Workshop, Market, Hunter Guild, Quest Board, Storage, Co-op Lobby, Data Fountain (save), Dungeon Gate; NPC ประจำร้าน + NPC เดินไปมา
- **5 ภูมิภาค/ดันเจี้ยน** (ปลดล็อกตามลำดับเมื่อเคลียร์ Normal):

| ดันเจี้ยน | ภูมิภาค | Lv | Mini-boss | Boss | ธีม |
|---|---|---|---|---|---|
| Abandoned Data Center | Abandoned City | 1–6 | Elite Processor Bot | Server Golem | server racks, cyan |
| Cybernetic Factory | Cybernetic Factory | 5–11 | Elite Storage Beast | Titan Mech | pipes, amber |
| Nuclear Server Core | Nuclear Wasteland | 10–17 | Elite Power Core Golem | Reactor Beast | barrels, toxic green |
| AI Research Facility | AI Research Facility | 16–23 | Elite Graphics Guardian | Neural Overlord | labs, violet |
| Mechanical Abyss | Mechanical Abyss | 22–32 | Elite Storage Beast | Omega Machine | gears, crimson |

## 3. Turn-Based Combat (ระบบหลัก)
**Battle flow:** ชนศัตรู → เปลี่ยนฉาก Battle → แสดงทีม/ศัตรู → คำนวณ Turn Order → ผู้เล่นเลือกคำสั่งให้ทุก hunter (planning) → ประมวลผลตามลำดับ → ศัตรูทำงานตาม intent → ตรวจสถานะ → รอบใหม่/จบ

**Turn order:** เรียงตาม `priority` (Team Ultimate 5 > Switch 4 > Defend/Dodge 3 > Item/Flee 1 > ปกติ 0, Haste +1, Delayed −1) แล้วตาม **Speed จริง** (SPD Up +20%, SPD Down −20%, Chill −15%/stack, Crushed −10%) และ tiebreak แบบ seeded — แสดงใน timeline ด้านบน และอัปเดตทันทีเมื่อเลือกคำสั่ง (เช่นเลือก Defend แล้วตัวละครกระโดดขึ้นหน้า)

**คำสั่ง:** Attack · Skill · Ultimate · Defend (−50% dmg, +20 EN) · Dodge (70% หลบ single-target) · Item · Switch (single player, สลับกับ reserve) · Scan (เปิดจุดอ่อน + Weak Point +30% crit) · Team Combination · Team Ultimate · Escape

**ทรัพยากร:** HP · Energy (ใช้สกิล, ได้จาก attack/defend/scan) · Ultimate charge 0–100% · **Team Gauge** (จาก weakness, reaction, break, kill, chain)

**ศัตรูแสดง intent** (ชื่อท่า → เป้าหมาย) ท่าอันตรายมี ⚠ — ผู้เล่นวางแผน Defend/Dodge/Interrupt ได้

**Damage:** `ATK × power × 120/(120+DEF×(1−ignoreDef)) × weak 1.5 / resist 0.5 / immune 0 × (1+elemBonus) × crit × chain × broken 1.25 × guard 0.5 × barrier 0.2 × ±6%`

ระหว่างแอนิเมชันเล่น คำสั่งทั้งหมดถูกล็อก (UI "Resolving round… commands locked") — state จริงเปลี่ยนเฉพาะจากผลลัพธ์ของ engine

## 4. Tactical Combo & Elements
7 ธาตุ: Physical, Electric, Fire, Ice, Plasma, Gravity, Quantum → แต่ละธาตุติดสถานะ: Shock, Burn, Chill(→Frozen), Ionized, Crushed, Entangled

**Elemental Reactions** (เช็กสถานะ *ก่อน* ถูกตี แล้วค่อยติดสถานะใหม่ *หลัง* ตี — สถานะที่เพิ่งติดจากการโจมตีเดียวกันจะไม่ react กับตัวเอง):

| Reaction | เงื่อนไข | ผล |
|---|---|---|
| Plasma Burst | Electric→Ionized / Plasma→Shock | 120% Plasma + กระเด็น 50% ใส่ศัตรูอื่น, armor 30 |
| Shatter | Physical/Gravity→Frozen | 200% Physical |
| Thermal Shock | Fire→Chill/Frozen, Ice→Burn | armor damage 60 |
| Superconduct | Electric→Chill, Ice→Shock | DEF −40% |
| Overload | Fire→Shock, Electric→Burn | ระเบิด Fire ทุกตัว |
| Fusion Flare | Plasma→Burn, Fire→Ionized | 150% Fire + Burn |
| Singularity | Gravity→Entangled, Quantum→Crushed | Gravity ทุกตัว + Delay |
| Quantum Echo | Quantum→Shock/Burn/Ionized/Chill | ซ้ำธาตุนั้น 80% |
| Compression | Gravity→Shock/Burn/Ionized/Chill | กระจายสถานะไปศัตรูทุกตัว |

- **Chain:** ตีเป้าเดิมต่อเนื่องในรอบเดียว +10%/hit (สูงสุด +50%; Dual Plasma Blades +15%/hit สูงสุด 8)
- **Armor Break:** armor gauge หมด → Stun (เสียเทิร์น), รับดาเมจ +25%, **ยกเลิกท่าชาร์จ/รีเซ็ต countdown บอส**, Team Gauge +20, เปิด **Team Finisher**
- **Weak Point:** จาก Scan
- **Follow-up:** Static Echo (Katana), Overwatch (Railgun เมื่อศัตรู Break), Follow-up Protocol (skill tree)
- **Team Combination** (30 TG): สองคนตีพร้อมกัน — ธาตุคนแรกติดสถานะก่อน ธาตุคนที่สองจึง react ได้ทันที; ถ้าเป้า Broken จะเป็น **TEAM FINISHER** (240%×2)
- **Team Ultimate** (100 TG): ทุกคนปล่อยพลังใส่ศัตรูทุกตัวด้วยธาตุของตัวเอง (react กันเองเป็นลูกโซ่)
- ตัวอย่างตามบรีฟ: `Electric (Shock) → Plasma Burst → Armor Break → Team Finisher` มีใน unit test

## 5. Weapons (8)
| อาวุธ | ธาตุ | Skill | Ultimate | Passive |
|---|---|---|---|---|
| Energy Katana | Electric | Thunder Iai | Raijin: Thousand Cuts | Static Echo (follow-up บน Shock) |
| Dual Plasma Blades | Plasma | Plasma Flurry (4 hits) | Supernova Dance | Chain Master |
| Plasma Rifle | Plasma | Ion Volley (AoE) | Orbital Lance | Energy Siphon |
| Railgun | Electric | Piercing Rail (ignore DEF) | Hyper Rail | Overwatch |
| Gravity Hammer | Gravity | Event Horizon (armor + delay) | Collapse Star | Armor Breaker |
| Energy Greatsword | Fire | Solar Cleave (AoE burn) | Phoenix Calamity (heal) | Last Stand |
| Quantum Spear | Quantum | Time Lance (delay) | Quantum Overdrive (party Haste) | Phase Shift |
| Photon Scythe | Ice | Absolute Reap (execute) | Frozen Eclipse (freeze) | Reaper |

ทุกอาวุธมี Damage, Speed, Crit Rate, Crit DMG, rarity 6 ระดับ, Upgrade +0…+10 (ใช้ credits + scrap + copper; +5/+10 เพิ่ม skill power) และท่าโจมตี/แอนิเมชันตาม class

## 6. Characters & Progression
- สร้างตัวละคร: ชื่อ, ทรงผม 6, สีผม, สีตา, สีผิว, ชุด 4 แบบ + สี, สี neon accent, accessory 4, รูปร่าง 2, อาวุธเริ่มต้น 8
- แอนิเมชัน (keyframe จริงผ่าน `THREE.AnimationMixer`): idle, walk, run, attack (8 แบบตามอาวุธ), skill, ultimate, cast, buff, hit, dodge, defend, victory, defeat
- Stats: HP, ATK, DEF, SPD, Crit Rate, Crit DMG, Energy, Elemental Bonus
- EXP curve `60·L^1.55`, Lv สูงสุด 40, 1 skill point/level
- **Skill tree 17 nodes** 3 สาย (Offense/Defense/Tech) มี prerequisite: stat nodes, tech skills (Nano Repair, Barrier Field, Reboot Protocol, Overclock, Cryo Mine, Thermite, EMP Pulse) และ passives (Ultimate Amp, Follow-up Protocol); reset ได้ด้วย credits
- Equipment: weapon, armor, accessory (10 แบบ × rarity × upgrade)
- Party: สูงสุด 4 (3 ลงสนาม + 1 reserve), recruit companion 8 คนที่ Guild; ตัวที่ไม่ได้สั่งเองใช้ Auto/AI ได้

## 7. Enemies & Bosses
ศัตรู 7 แบบ แต่ละตัวมีบทบาท AI (utility scoring + cooldown + noise): Scrap Bot (brute), Processor Bot (buff ทีม), Graphics Guardian (shield พวก), Memory Drone (heal, บิน — immune Gravity), Storage Beast (tank, ฟื้น armor), Cooling Mech (freeze), Power Core Golem (ชาร์จระเบิด — ตัดด้วย Break)

| Boss | กลไก |
|---|---|
| Server Golem | เรียก Memory Drone → **Data Shield** (−80% dmg) จนกว่าโดรนตาย; Phase 2: Overclock + ชาร์จ Server Crash |
| Titan Mech | **Orbital Cannon** ชาร์จ 1 รอบ (Defend หรือ Break เพื่อยกเลิก); Phase 2 Missile Barrage + armor ใหม่ |
| Reactor Beast | **Meltdown** +1 stack/รอบ (+12% ATK), ครบ 5 = Reactor Explosion; ตีด้วย Ice ลด stack |
| Neural Overlord | **Mind Hack** (hunter ตีพวกเอง — แก้ด้วย Coolant Spray), **Adaptive Shell** เปลี่ยนจุดอ่อนทุก phase (ต้อง Scan ใหม่), 3 phases |
| Omega Machine | 3 phases กลับขั้วธาตุ (immune เปลี่ยน), เรียกทหาร, Phase 3 **Omega Countdown** 3→0 = ล้างทีม; Break รีเซ็ต countdown |

## 8. Dungeons
Procedural (seeded): ห้องบน grid เชื่อมแบบ spanning tree + loop, ประเภทห้อง: start (portal กลับเมือง), combat, treasure, event (terminal hack/merchant drone/EMP trap/shrine ฟื้นพลัง), resource (เก็บ scrap), elite (mini-boss + หีบ), boss, **hidden** (หลังกำแพงร้าว) — ศัตรูเดินลาดตระเวนและไล่ผู้เล่น (symbol encounter)

ความยาก Normal/Hard/Nightmare/Abyss: +0/+3/+6/+10 level, HP ×1/1.35/1.75/2.3, รางวัล ×1/1.5/2.2/3.4, rarity bias สูงขึ้น. **Balance:** budget ศัตรูต่อห้องตามความลึก+ความยาก+ขนาดปาร์ตี้, เลเวลศัตรูขยับตาม party ถ้า overlevel, ลด budget + เตือนถ้า underlevel; HP ทีมสะสมข้ามการต่อสู้ภายในดันเจี้ยน (ผลจาก balance simulation ดู TEST_REPORT.md)

## 9. Loot, Crafting & Business
- วัสดุ: Scrap Metal, Copper Wire; ชิ้นส่วน: CPU, GPU, RAM, SSD, HDD, Motherboard, Cooling Fan, Power Supply, Quantum Chip — แต่ละชิ้นมี spec (socket, cores, perf, watts, heat, RAM type/capacity, PCIe gen, form factor/ความยาว GPU, supply, cooling) และ quality 0–100
- Rarity: Common, Uncommon, Rare, Epic, Legendary, Mythic; **drop table แยกต่อหุ่น** (เช่น Graphics Guardian → GPU, Memory Drone → RAM/SSD)
- PC 6 แบบ: Basic, Office, Gaming, Workstation, High-end Gaming, Quantum — ตรวจ socket CPU/บอร์ด, ชนิด RAM, จำนวนสล็อต, PCIe + ความยาว GPU, PSU ≥ 110% ของไฟที่ใช้, cooling ≥ heat, วัสดุ; ราคา = basePrice × f(perf) × f(quality)
- ขาย: ตรงตลาด (ราคาผันผวนรายวัน), **Customer Orders** (+25–60%), **Special Contracts** ทุก 3 วัน (×2.4 + reputation); Market ซื้อ/ขายชิ้นส่วน

## 10. Multiplayer Co-op (2–4)
Room code 5 ตัว → Ready → host เลือกดันเจี้ยน/ความยาก → **Raid 3 waves** (ศัตรู → elite → บอส) แต่ละคนคุม main hunter ของตัวเอง (stats มาจาก save บนเซิร์ฟเวอร์) — แชร์แผนให้เพื่อนเห็นแบบ real-time, Lock-in, timer 30 วินาที, Team Ultimate ต้องทุกคนเลือก, Combo ข้ามผู้เล่นต้องเลือกจับคู่กัน, Revive ด้วย item/skill, รางวัลสุ่มฝั่งเซิร์ฟเวอร์แยกต่อคน. Single player ไม่มี timer

## 11. Art & Audio
Anime cel-shading (toon ramp 3 ระดับ + inverted-hull outline), ตาอนิเมะจาก canvas texture, neon emissive + bloom (High), VFX: energy slash, lightning, explosion, plasma ring, quantum ring, beam, orbital strike; เพลง procedural (WebAudio sequencer: title, city, dungeon, battle, boss, victory) และ SFX สังเคราะห์ต่อธาตุ/UI
