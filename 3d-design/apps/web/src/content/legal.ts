import type { Locale } from '../i18n';

/**
 * Plain-language summaries for the MVP. They state the product's actual
 * behaviour; a lawyer must review them before launch (see docs/legal.md).
 */
export interface LegalDoc {
  title: string;
  updated: string;
  sections: { heading: string; body: string[] }[];
}

export const TERMS: Record<Locale, LegalDoc> = {
  th: {
    title: 'ข้อกำหนดการใช้งาน',
    updated: 'ฉบับร่าง 2026-11 — รอการตรวจทานทางกฎหมาย',
    sections: [
      {
        heading: 'ใครเป็นเจ้าของโมเดลที่สร้าง',
        body: [
          'คุณเป็นเจ้าของโมเดลที่สร้างจากบัญชีของคุณ และนำไปใช้ได้ทั้งงานส่วนตัวและเชิงพาณิชย์ รวมถึงขายเป็นส่วนหนึ่งของเกมหรือสินค้า',
          'เราไม่อ้างสิทธิ์ในโมเดลของคุณ เราเก็บไฟล์ไว้เพื่อให้บริการ (แสดงในคลัง ดาวน์โหลด แชร์) เท่านั้น',
          'เมื่อคุณเปิดลิงก์แชร์ คนที่ได้ไฟล์ใช้ได้เฉพาะงานส่วนตัว เว้นแต่คุณเปิด "อนุญาตให้ผู้อื่นใช้เชิงพาณิชย์" ข้อความสิทธิ์นี้ฝังอยู่ในไฟล์ GLB',
          'ถ้าผู้ให้บริการโมเดล AI ภายนอกมีเงื่อนไขเพิ่ม (เช่น การระบุแหล่งที่มา) เงื่อนไขนั้นมีผลกับผลงานที่สร้างผ่านผู้ให้บริการนั้นด้วย',
        ],
      },
      {
        heading: 'สิ่งที่ห้ามสร้าง',
        body: [
          'ตัวละคร โลโก้ หรือการออกแบบที่มีลิขสิทธิ์หรือเครื่องหมายการค้าของผู้อื่น',
          'ชิ้นส่วนอาวุธปืนที่ใช้งานได้จริงสำหรับพิมพ์ 3 มิติ',
          'เนื้อหาทางเพศที่เกี่ยวกับผู้เยาว์ สัญลักษณ์ที่สร้างความเกลียดชัง หรือเนื้อหาผิดกฎหมายอื่น',
          'ระบบกรองคำอธิบายก่อนสร้าง และเราอาจลบโมเดลหรือปิดบัญชีที่ละเมิดข้อนี้',
        ],
      },
      {
        heading: 'เครดิต',
        body: [
          'การสร้างแต่ละครั้งใช้เครดิตตามคุณภาพที่เลือก ราคาแสดงก่อนยืนยันทุกครั้ง',
          'ถ้าการสร้างล้มเหลว ระบบคืนเครดิตอัตโนมัติ การลบโมเดลไม่คืนเครดิต',
        ],
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    updated: 'Draft 2026-11 — pending legal review',
    sections: [
      {
        heading: 'Who owns what you create',
        body: [
          'You own the models created from your account and may use them personally and commercially, including selling them as part of a game or product.',
          'We claim no rights in your models. We store the files only to provide the service (library, download, sharing).',
          'When you turn on a share link, people who get the file may use it for personal purposes only, unless you enable "Allow others to use commercially". This notice is embedded in the GLB.',
          'If an external AI provider adds conditions (such as attribution), those apply to results generated through that provider.',
        ],
      },
      {
        heading: 'What you may not create',
        body: [
          "Characters, logos or designs protected by someone else's copyright or trademark.",
          'Functional firearm parts for 3D printing.',
          'Sexual content involving minors, hate symbols, or other illegal content.',
          'Descriptions are filtered before generation, and we may remove models or close accounts that break these rules.',
        ],
      },
      {
        heading: 'Credits',
        body: [
          'Each creation uses credits according to the chosen quality. The price is shown before every confirmation.',
          'If a creation fails, the credits are refunded automatically. Deleting a model does not refund credits.',
        ],
      },
    ],
  },
};

export const PRIVACY: Record<Locale, LegalDoc> = {
  th: {
    title: 'นโยบายความเป็นส่วนตัว',
    updated: 'ฉบับร่าง 2026-11 — รอการตรวจทานทางกฎหมาย (PDPA)',
    sections: [
      {
        heading: 'ข้อมูลที่เก็บ',
        body: [
          'คุกกี้เซสชันหนึ่งตัว (d3_sid) เพื่อจำบัญชีของคุณ ไม่มีคุกกี้โฆษณาหรือตัวติดตามของบุคคลที่สาม',
          'คำอธิบาย ตัวเลือก และไฟล์โมเดลที่คุณสร้าง รวมถึงภาพย่อที่เบราว์เซอร์ของคุณสร้างจาก viewer',
          'ที่อยู่ IP ใช้จำกัดอัตราการใช้งานเท่านั้น และไม่ถูกบันทึกลงฐานข้อมูล',
        ],
      },
      {
        heading: 'ใครเห็นข้อมูลของคุณ',
        body: [
          'คำอธิบายถูกส่งไปยังผู้ให้บริการโมเดล 3D ที่ระบบตั้งค่าไว้เพื่อสร้างโมเดล',
          'โมเดลเป็นส่วนตัวจนกว่าคุณเปิดลิงก์แชร์ หน้าแชร์ไม่แสดงคำอธิบาย seed หรือรหัสบัญชีของคุณ',
        ],
      },
      {
        heading: 'การลบ',
        body: ['การลบโมเดลจะลบไฟล์และภาพย่อออกจากที่เก็บทันที และปิดลิงก์แชร์'],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Draft 2026-11 — pending legal review (PDPA/GDPR)',
    sections: [
      {
        heading: 'What we collect',
        body: [
          'One session cookie (d3_sid) to remember your account. No advertising cookies or third-party trackers.',
          'The descriptions, options and model files you create, plus the thumbnail your browser renders from the viewer.',
          'Your IP address, used only for rate limiting and never written to the database.',
        ],
      },
      {
        heading: 'Who sees your data',
        body: [
          'Descriptions are sent to the configured 3D model provider to generate the model.',
          'Models are private until you turn on a share link. Share pages never show your description, seed or account id.',
        ],
      },
      {
        heading: 'Deletion',
        body: [
          'Deleting a model removes its file and thumbnail from storage immediately and disables its share link.',
        ],
      },
    ],
  },
};
