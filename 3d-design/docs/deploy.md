# เปิดเป็นเว็บไซต์ฟรี: Render + Supabase

ใช้บริการฟรีสองตัว:

- **Render** (web service ฟรี) รันแอปทั้งหมดเป็นบริการเดียว ทั้ง API และหน้าเว็บ
- **Supabase** (โปรเจกต์ฟรี) เป็นฐานข้อมูล Postgres และที่เก็บไฟล์ GLB/ภาพย่อ

ทั้งสองไม่ต้องใส่บัตรเครดิต ไฟล์ตั้งค่า Render คือ [`render.yaml`](../../render.yaml) ที่ root ของ repo
ส่วนวิธี build อยู่ใน [`Dockerfile`](../Dockerfile)

## ข้อจำกัดของแผนฟรี

| ข้อจำกัด                                                   | ผลต่อผู้ใช้                                                                                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render หยุดบริการเมื่อไม่มีคนเข้า 15 นาที                  | คนแรกที่เข้าหลังจากนั้นรอประมาณ 1 นาทีให้เครื่องตื่น                                                                                                 |
| Render ไม่เก็บไฟล์ในเครื่องข้ามการรีสตาร์ต                 | จึงต้องใช้ Supabase เก็บข้อมูลและไฟล์ (ตั้งไว้ใน `render.yaml` แล้ว)                                                                                 |
| Render ฟรี 750 ชั่วโมงต่อเดือน                             | พอสำหรับบริการเดียวเปิดทั้งเดือน                                                                                                                     |
| Supabase พักโปรเจกต์ถ้าไม่มีการใช้ฐานข้อมูล 7 วัน          | ต้องกด Restore ในหน้า Supabase                                                                                                                       |
| Supabase ฐานข้อมูล 500 MB, ไฟล์ 1 GB, egress 5 GB ต่อเดือน | โมเดลหนึ่งชิ้นประมาณ 20–500 KB จึงเก็บได้หลายพันชิ้น                                                                                                 |
| ตัวสร้างโมเดลเป็น `mock`                                   | **ฟรีแต่ไม่ใช่ AI** ถ้าจะใช้ AI จริงต้องมี API key ของ Meshy หรือ Tripo ซึ่งมีเครดิตฟรีจำกัด ตรวจเงื่อนไขของแต่ละเจ้าว่าแผนฟรีใช้ผ่าน API ได้หรือไม่ |

ตัวเลขข้างบนอ้างจากหน้าราคาและบทความ ณ ปลายปี 2026 เงื่อนไขเปลี่ยนได้ ตรวจที่ [render.com/docs/free](https://render.com/docs/free)
และหน้า Pricing ของ Supabase ก่อนใช้งาน

## ขั้นที่ 1 — Supabase: สร้างโปรเจกต์และฐานข้อมูล

1. เข้า [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
   - แนะนำให้สร้างโปรเจกต์ใหม่ ไม่ใช้ร่วมกับเกมเดิม เพราะแอปนี้สร้างตารางชื่อ `users`, `jobs`, `models` ใน schema `public`
   - **Region:** Southeast Asia (Singapore)
   - ตั้ง **Database password** แล้วจดไว้
2. เมื่อโปรเจกต์พร้อม กดปุ่ม **Connect** ด้านบน → เลือก **Session pooler** แล้วคัดลอก connection string
   หน้าตาประมาณนี้
   ```
   postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```
3. แทน `[YOUR-PASSWORD]` ด้วยรหัสผ่านจริง แล้ว**ต่อท้าย**ด้วย `?uselibpqcompat=true&sslmode=require`
   ```
   postgresql://postgres.abcdefghijkl:รหัสผ่าน@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?uselibpqcompat=true&sslmode=require
   ```
   นี่คือค่า `DATABASE_URL` ไม่ต้องสร้างตารางเอง แอปรัน migration ให้ทุกครั้งที่เริ่มทำงาน

> **ต้องใช้ Session pooler** ไม่ใช่ Direct connection เพราะ Direct connection ของ Supabase เป็น IPv6 อย่างเดียว ซึ่ง Render เชื่อมไม่ได้
> ถ้ารหัสผ่านมีอักขระพิเศษ (`@ : / ? #`) ให้เปลี่ยนรหัสผ่านเป็นตัวอักษรกับตัวเลขอย่างเดียว จะได้ไม่ต้อง encode

## ขั้นที่ 2 — Supabase: ที่เก็บไฟล์

1. เมนูซ้าย **Storage** → **New bucket** → ชื่อ `models` → **ปิด** Public bucket (ไฟล์ส่งผ่านแอปที่ตรวจสิทธิ์ก่อน)
2. **Storage** → **Settings** (หรือ Project Settings → Storage) → ส่วน **S3 Connection**
   - เปิด S3 connection ถ้ายังไม่เปิด
   - คัดลอก **Endpoint** เช่น `https://abcdefghijkl.supabase.co/storage/v1/s3` → ค่า `S3_ENDPOINT`
   - คัดลอก **Region** เช่น `ap-southeast-1` → ค่า `S3_REGION`
3. ในส่วน **S3 Access Keys** กด **New access key**
   - **Access key ID** → ค่า `S3_ACCESS_KEY_ID`
   - **Secret access key** → ค่า `S3_SECRET_ACCESS_KEY` (แสดงครั้งเดียว คัดลอกเก็บไว้ก่อนปิดหน้าต่าง)

## ขั้นที่ 3 — Render: deploy

1. ถ้ายังไม่ได้ merge branch `ccr-96b6d7d8-n80fgq` เข้า `main` ให้ merge ก่อน หรือเลือก branch นี้ในข้อ 3
2. เข้า [dashboard.render.com](https://dashboard.render.com) สมัครด้วยบัญชี GitHub และอนุญาตให้ Render เห็น repo `omg2253r-ui/game`
3. **New** → **Blueprint** → เลือก repo `omg2253r-ui/game` (และ branch) Render จะอ่าน `render.yaml` และแสดงบริการ `3d-design` แผน Free
4. กรอกค่าที่ Render ถาม

   | ตัวแปร                 | ค่าจาก          |
   | ---------------------- | --------------- |
   | `DATABASE_URL`         | ขั้นที่ 1 ข้อ 3 |
   | `S3_ENDPOINT`          | ขั้นที่ 2 ข้อ 2 |
   | `S3_REGION`            | ขั้นที่ 2 ข้อ 2 |
   | `S3_ACCESS_KEY_ID`     | ขั้นที่ 2 ข้อ 3 |
   | `S3_SECRET_ACCESS_KEY` | ขั้นที่ 2 ข้อ 3 |

   `SESSION_SECRET` Render สุ่มให้เอง ค่าอื่นตั้งไว้ใน `render.yaml` แล้ว

5. กด **Apply** แล้วรอ build ครั้งแรกประมาณ 5–10 นาที ดูความคืบหน้าในแท็บ **Logs**
   เมื่อเห็น `migrations applied` และ `Ready` แปลว่าพร้อม
6. เปิดที่อยู่ที่ Render ให้ เช่น `https://3d-design.onrender.com` (ชื่อจริงอาจมีตัวอักษรต่อท้าย)

## ขั้นที่ 4 — ตรวจว่าใช้งานได้

- เปิด `https://<ที่อยู่ของคุณ>/api/health` ควรเห็น `"database":"postgres"` และ `"storage":"s3"`
- เปิดหน้าเว็บ สร้างโมเดลหนึ่งชิ้น ดาวน์โหลด GLB แล้วดูว่าขึ้นในคลังโมเดล
- จะรันชุดทดสอบ e2e กับเว็บจริงก็ได้ (สร้างโมเดลทดสอบในฐานข้อมูลจริงหลายชิ้น)
  ```bash
  cd 3d-design
  E2E_BASE_URL=https://<ที่อยู่ของคุณ> pnpm e2e
  ```

## เปลี่ยนเป็น AI จริงภายหลัง

Render → บริการ `3d-design` → **Environment**:

- ตั้ง `AI_PROVIDER` เป็น `meshy` แล้วเพิ่ม `MESHY_API_KEY`
- หรือตั้ง `AI_PROVIDER` เป็น `tripo` แล้วเพิ่ม `TRIPO_API_KEY`

กด **Save** แล้ว Render จะ deploy ใหม่ให้ วิธีสมัครดูใน [services.md](services.md)
adapter ทั้งสองยังไม่เคยทดสอบกับ key จริง ให้ลองสร้างหนึ่งงานแล้วดู Logs ก่อนเปิดให้คนอื่นใช้

## แก้ปัญหา

| อาการใน Logs                                                         | สาเหตุและวิธีแก้                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `self-signed certificate in certificate chain`                       | `DATABASE_URL` ไม่มี `?uselibpqcompat=true&sslmode=require` ต่อท้าย |
| `ENETUNREACH` หรือ `getaddrinfo` กับ `db.xxx.supabase.co`            | ใช้ Direct connection อยู่ เปลี่ยนเป็น Session pooler               |
| `password authentication failed`                                     | รหัสผ่านใน `DATABASE_URL` ผิด หรือมีอักขระพิเศษที่ต้อง encode       |
| `Invalid environment configuration`                                  | ขาดตัวแปรที่บอกไว้ในข้อความ เช่น `S3_ENDPOINT`                      |
| สร้างโมเดลแล้วขึ้น error ตอนบันทึก / `AccessDenied` / `NoSuchBucket` | ตรวจชื่อ bucket `models`, access key และ region ของ S3              |
| เว็บโหลดนานมากครั้งแรก                                               | Render กำลังปลุกบริการจากการหยุดพัก (ปกติของแผนฟรี)                 |
| Supabase แจ้งว่าโปรเจกต์ถูก pause                                    | เข้า Supabase dashboard แล้วกด Restore                              |

## สิ่งที่ทดสอบแล้วและยังไม่ได้ทดสอบ

**ทดสอบแล้วในเครื่อง:** build แบบ production, `start.sh` (รัน migration แล้วเปิด server), เสิร์ฟหน้าเว็บกับ API จากโปรเซสเดียว
และ e2e ทั้ง 7 ข้อผ่านบน production build ที่ต่อกับ Postgres หน่วยความจำประมาณ 180 MB ต่ำกว่าขีด 512 MB ของแผนฟรี

**ยังไม่ได้ทดสอบ:**

- build Docker image จริง (สภาพแวดล้อมที่พัฒนาไม่มี Docker daemon)
- การ deploy บน Render
- การเชื่อม Supabase จริง (pooler และ S3 Storage)

ถ้าติดตรงไหน ส่งข้อความจากแท็บ Logs มาได้
