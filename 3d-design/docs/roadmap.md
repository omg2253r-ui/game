# แผนฟีเจอร์ phase ถัดไป

เรียงตามสิ่งที่ปลดล็อกการใช้งานจริงก่อน แต่ละ phase บอกว่าจะต่อกับโค้ดตรงไหน

## Phase 1 — MVP (เสร็จแล้ว)

Text-to-3D, คิว + ความคืบหน้าแบบเรียลไทม์, 3D viewer, สถิติ mesh และความเข้ากันได้ของเอนจิน, ดาวน์โหลด GLB
พร้อมสิทธิ์ในไฟล์, library (ค้นหา แท็ก ลบ แชร์), ระบบเครดิตแบบ guest, ไทย/อังกฤษ, โหมดมืด/สว่าง

## Phase 2 — บัญชี การชำระเงิน และผู้ให้บริการจริง

| งาน                           | รายละเอียด                                                                                                       | ต่อกับ                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| เปิดใช้ Meshy หรือ Tripo จริง | ทดสอบ adapter กับ key จริง, ตั้งราคาเครดิตตามต้นทุน, ตั้ง alert เมื่อ provider ล้มเกิน x%                        | `providers/remote/*`, `presets.ts`    |
| สมัครและเข้าสู่ระบบ           | Auth.js: อีเมล magic link + Google ผูกอีเมลเข้ากับ guest user id เดิม library จึงไม่หาย                          | `session.ts`, ตาราง `users.email`     |
| ระบบเครดิตและแพ็กเกจ          | Stripe Checkout + webhook → `adjustCredits(…, 'purchase')`, หน้า "เติมเครดิต", ประวัติการใช้                     | `credit_transactions`, `CreditReason` |
| Moderation เชิงความหมาย       | เพิ่ม moderation API ก่อน word list, คิวรีวิวสำหรับงานที่ถูกกัน                                                  | `shared/moderation.ts`                |
| ดาวน์โหลดหลายฟอร์แมต          | OBJ / STL / USDZ ฝั่ง client ด้วย three exporters (ทำได้เร็ว), FBX ฝั่ง worker ด้วย Blender headless หรือ Assimp | `ExportPanel`, worker job ใหม่        |
| ZIP + LICENSE.txt             | รวมหลายฟอร์แมตหรือหลายโมเดลเป็น ZIP พร้อมไฟล์สิทธิ์ (สำหรับฟอร์แมตที่ฝังข้อความไม่ได้)                           | route `/api/exports`                  |
| Observability                 | Sentry ทั้งสองฝั่ง, log แบบ structured, dashboard เวลาเฉลี่ยต่อคุณภาพ (ใช้ปรับ ETA)                              | `pipeline.ts`                         |

## Phase 3 — Image-to-3D และเครื่องมือปรับแต่ง

| งาน               | รายละเอียด                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image-to-3D       | drag & drop / เลือกไฟล์ PNG/JPG ≤ 10 MB, ตรวจ MIME + magic bytes (`sniffImage` มีแล้ว), สแกน ClamAV, กรองรูปด้วย moderation, ลบ EXIF ก่อนส่ง provider |
| ลดโพลิกอน         | `@gltf-transform/functions` `simplify` + meshoptimizer ใน worker เลือกเป้าเป็นจำนวนสามเหลี่ยม เห็นผลบน viewer ก่อนบันทึกเป็นเวอร์ชันใหม่              |
| Optimize for game | LOD 3 ระดับ, บีบอัดเท็กซ์เจอร์ KTX2/Basis, meshopt compression ตั้งเป้าตามแพลตฟอร์ม (มือถือ/PC/Roblox)                                                |
| Retopology และ UV | ผ่าน provider ที่รองรับ (remesh) หรือ worker Blender (Quad remesher, Smart UV)                                                                        |
| วัสดุและ PBR      | เปลี่ยนสี, roughness/metallic ต่อวัสดุบน viewer (แก้ใน glTF ด้วย gltf-transform), สร้างเท็กซ์เจอร์ใหม่ (re-texture) ผ่าน provider                     |
| ปรับสเกลและแกน    | ตั้งหน่วย (ซม./ม.), แกน Y-up/Z-up, จุดหมุนที่ฐาน ก่อนส่งออก                                                                                           |
| เวอร์ชัน          | ทุกการแก้เก็บเป็นเวอร์ชันของโมเดลเดิม ย้อนกลับได้                                                                                                     |

## Phase 4 — Rigging และ Animation

| งาน                  | รายละเอียด                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| ตรวจว่าเป็น humanoid | จัดประเภทจาก prompt + รูปทรง ก่อนเสนอปุ่ม rig                                                   |
| Auto-rigging         | โครงกระดูกมาตรฐาน (Mixamo/Unity Humanoid-compatible naming) ผ่าน provider ที่รองรับ หรือ worker |
| ไลบรารี animation    | idle, walk, run, jump เล่นบน viewer ได้ (R3F `useAnimations`)                                   |
| Retarget             | map ชื่อกระดูกไปยังโครงอื่น (Unreal Mannequin, Unity Humanoid) ก่อนส่งออก                       |

## Phase 5 — ชุมชน

| งาน                | รายละเอียด                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| โฟลเดอร์ใน library | ย้าย/จัดกลุ่ม, เลือกหลายชิ้นเพื่อดาวน์โหลด ZIP หรือลบพร้อมกัน                                                             |
| Gallery สาธารณะ    | ผู้สร้างเลือกเผยแพร่ และกำหนดว่าอนุญาตเชิงพาณิชย์หรือไม่ (`allowCommercialUse` มีแล้ว), ค้นหาตามแท็ก/สไตล์, รายงานเนื้อหา |
| Remix              | สร้างต่อจากโมเดลใน gallery ด้วยคำอธิบายและ seed เดิม (ข้อมูล recipe เก็บไว้แล้ว)                                          |
| ทีม                | workspace ร่วม, แชร์เครดิต, สิทธิ์ผู้ดู/ผู้แก้                                                                            |
