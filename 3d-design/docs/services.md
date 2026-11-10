# API key และบริการภายนอก

ทุกค่าตั้งใน `apps/api/.env` (คัดลอกจาก `apps/api/.env.example`) ไม่มี key ใดอยู่ฝั่งเบราว์เซอร์
MVP รันได้โดยไม่ต้องมีบริการภายนอกเลย ตารางนี้บอกว่าเมื่อไรต้องใช้อะไร

| บริการ                                     | ใช้ทำอะไร                                      | จำเป็นเมื่อ                       | ตัวแปร                                                                   | สถานะในโค้ด                                  |
| ------------------------------------------ | ---------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| ผู้ให้บริการ text-to-3D (Meshy หรือ Tripo) | สร้างโมเดลด้วย AI จริง                         | ต้องการผลลัพธ์จริงแทน mock        | `AI_PROVIDER`, `MESHY_API_KEY` / `TRIPO_API_KEY`                         | adapter เขียนแล้ว ยังไม่ได้ทดสอบกับ key จริง |
| PostgreSQL                                 | ผู้ใช้, งาน, โมเดล, บัญชีเครดิต                | production / หลายโปรเซส           | `DATABASE_URL`                                                           | ทดสอบแล้ว (Postgres 16)                      |
| Redis                                      | คิว BullMQ, rate limit ข้ามเครื่อง             | มี worker แยก / API หลาย instance | `REDIS_URL`                                                              | ทดสอบแล้ว (Redis 7)                          |
| S3-compatible storage (Cloudflare R2)      | เก็บ GLB และภาพย่อ                             | production                        | `STORAGE_DRIVER=s3`, `S3_*`                                              | เขียนแล้ว ยังไม่ได้ทดสอบกับ bucket จริง      |
| Session secret                             | ลงชื่อ cookie                                  | production (บังคับ)               | `SESSION_SECRET`                                                         | ใช้งานแล้ว                                   |
| Auth.js (NextAuth) + Google OAuth          | สมัคร/เข้าสู่ระบบด้วยอีเมลหรือ Google          | phase 2                           | `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY` | ยังไม่ทำ (ดู roadmap)                        |
| Stripe                                     | ซื้อเครดิต/แพ็กเกจ                             | phase 2                           | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                             | ยังไม่ทำ                                     |
| Moderation API                             | กรองข้อความ/รูปเชิงความหมาย (นอกจาก word list) | ก่อนเปิดสาธารณะ                   | เช่น `OPENAI_API_KEY`                                                    | ยังไม่ทำ                                     |
| ClamAV                                     | สแกนมัลแวร์ไฟล์อัปโหลด                         | เมื่อเปิด image-to-3D             | `CLAMAV_HOST`                                                            | ยังไม่ทำ                                     |

## 1. ผู้ให้บริการ text-to-3D

ตัวเลือกถูกเลือกด้วย `AI_PROVIDER` ใน `apps/api/src/server/providers/index.ts`

### Meshy (`AI_PROVIDER=meshy`)

1. สมัครที่ meshy.ai → Settings → API → สร้าง API key
2. ตั้ง `MESHY_API_KEY=msy_...` และ `AI_PROVIDER=meshy`
3. การทำงาน (`providers/remote/meshy.ts`): `POST /openapi/v2/text-to-3d` mode `preview`
   (ขึ้นรูปไม่มีเท็กซ์เจอร์) → poll ทุก 3 วินาที → ถ้าคุณภาพไม่ใช่ "ร่าง" ส่ง mode `refine` พร้อม `enable_pbr`
   → ดาวน์โหลด `model_urls.glb` (ตรวจว่าเป็น GLB จริงและไม่เกิน 200 MB)
4. Meshy คิดราคาเป็นเครดิตของ Meshy เอง ตั้งราคาเครดิตของเราใน `packages/shared/src/presets.ts`
   ให้ครอบคลุมต้นทุน preview + refine

### Tripo (`AI_PROVIDER=tripo`)

1. สมัครที่ platform.tripo3d.ai → API Keys
2. ตั้ง `TRIPO_API_KEY=tsk_...` และ `AI_PROVIDER=tripo`
3. การทำงาน (`providers/remote/tripo.ts`): `POST /v2/openapi/task` type `text_to_model` พร้อม `face_limit`
   ตามคุณภาพ, `texture`/`pbr` สำหรับมาตรฐานและสูง → poll → ดาวน์โหลด `output.pbr_model`

> ทั้งสอง adapter เขียนตามเอกสาร API สาธารณะ ณ เวลาที่เขียน ก่อนใช้จริงให้ลองสร้างหนึ่งงานแล้วดู log
> (`[pipeline] job … failed`) ชื่อฟิลด์ของผู้ให้บริการเปลี่ยนได้

### เพิ่มผู้ให้บริการอื่น (Hunyuan3D, TripoSR บน GPU ของเราเอง ฯลฯ)

implement `GenerationProvider` ใน `apps/api/src/server/types.ts` แล้วเพิ่ม case ใน `providers/index.ts`

```ts
export class MyProvider implements GenerationProvider {
  readonly id = 'my-provider';
  async generate(req, { onProgress, signal }) {
    await onProgress({ stage: 'shaping', progress: 0.3 });
    return { glb: bytes }; // Uint8Array ของไฟล์ GLB
  }
}
```

ไม่ต้องจัดการเครดิต สิทธิ์ สถิติ หรือการเก็บไฟล์ pipeline ทำให้ ถ้า throw ระบบคืนเครดิตเอง

## 2. PostgreSQL

- ในเครื่อง: `docker compose up -d postgres` → `DATABASE_URL=postgres://design3d:design3d@localhost:5432/design3d`
- Production: Neon, Supabase, RDS หรือ Postgres ใดก็ได้ที่เป็นเวอร์ชัน 14 ขึ้นไป
- รัน migration: `pnpm db:migrate` แก้ schema ที่ `apps/api/src/server/db/schema.ts` แล้ว `pnpm db:generate`

## 3. Redis

- ในเครื่อง: `docker compose up -d redis` → `REDIS_URL=redis://localhost:6379`
- Production: Upstash, Redis Cloud, ElastiCache ต้องเป็น Redis ที่รองรับ BullMQ (ไม่ใช่ REST-only)
- ถ้าตั้ง `REDIS_URL` ต้องตั้ง `DATABASE_URL` ด้วย (worker คนละโปรเซสต้องเห็นข้อมูลชุดเดียวกัน) config จะแจ้ง error ตอน start ถ้าลืม
- แยก worker: ตั้ง `RUN_WORKER_IN_API=false` ใน API แล้วรัน `pnpm worker` บนเครื่องอื่นกี่ตัวก็ได้

## 4. Cloudflare R2 (หรือ S3/MinIO)

1. Cloudflare dashboard → R2 → Create bucket (เช่น `design3d-models`) ปล่อยเป็น private
2. R2 → Manage R2 API Tokens → สร้าง token สิทธิ์ Object Read & Write เฉพาะ bucket นี้
3. ตั้งค่า

   ```env
   STORAGE_DRIVER=s3
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=design3d-models
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   ```

4. การดาวน์โหลดใช้ presigned URL อายุ 5 นาทีหลังตรวจสิทธิ์แล้ว (API redirect ไป) bucket จึงไม่ต้องเปิดสาธารณะ
   ถ้าเว็บกับ bucket คนละโดเมน ให้ตั้ง CORS ของ bucket ให้อนุญาต `GET` จากโดเมนเว็บ ไม่เช่นนั้นปุ่มดาวน์โหลดจะ
   fallback เป็นการเปิดลิงก์ตรง (ยังใช้ได้ แต่ไม่มี toast ยืนยัน)

ทดสอบในเครื่องด้วย MinIO: `docker compose --profile s3 up -d` แล้วใช้ `S3_ENDPOINT=http://localhost:9000`,
`S3_ACCESS_KEY_ID=design3d`, `S3_SECRET_ACCESS_KEY=design3d-secret`

## 5. Session secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

ตั้งเป็น `SESSION_SECRET` ใน production (API ไม่ยอม start ถ้าไม่มี) การเปลี่ยนค่าจะทำให้ทุก session เดิมหมดอายุ

## 6. บริการ phase 2 (ยังไม่มีในโค้ด)

- **Auth.js + Google:** Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web)
  redirect URI `https://<โดเมน>/api/auth/callback/google` ส่วนอีเมลแบบ magic link ใช้ Resend หรือ SMTP
- **Stripe:** สร้าง Product "เครดิต" หลายราคา, webhook `checkout.session.completed` → เพิ่มเครดิตผ่าน `adjustCredits(..., 'purchase')`
  ตาราง `credit_transactions` รองรับอยู่แล้ว
- **Moderation:** เรียกก่อน `checkPrompt` ผ่าน adapter เดียวกับ provider เพื่อสลับเจ้าได้
- **ClamAV:** รัน `clamav/clamav` container แล้วสแกน buffer ผ่าน clamd ก่อนส่งรูปให้ provider
