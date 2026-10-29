# Bugalter — oylik hisoblash platformasi

Korxona va o'quv markazlari uchun oylik maoshni hisoblash va boshqarish web ilovasi.

## Imkoniyatlar

- **Ikki rejim:** korxona va o'quv markazi (Sozlamalarda almashtiriladi)
- **Oylik turlari:**
  - Oklad: ishlangan kunlarga mutanosib (tabel bo'yicha)
  - Soatbay: soat × stavka
  - O'quvchi boshiga: shu oy to'lov qilgan o'quvchilar soni × stavka
  - Tushumdan foiz: o'qituvchi guruhlaridan tushgan pulning N%
  - Har biriga qat'iy qism (oklad) qo'shish mumkin
- Bonus, avans, ushlanmalar; daromad solig'i (standart 12%, sozlanadi)
- **Qo'lga berilgan pullar:** o'qituvchi/xodimga oy davomida naqd berilgan summalar (sana, izoh bilan) alohida yoziladi va oylikning qoldig'idan ayiriladi; kabinetda ham ko'rinadi
- Oylik vedomosti: jonli hisob → qoralama → tasdiqlangan → to'langan (qulflanadi)
- **Xodim kabineti:** xodim faqat o'z oyligini ko'radi, buxgalter biror narsani o'zgartirsa sahifa Socket.io orqali darhol yangilanadi
- O'quv markazi: guruhlar, o'quvchilar, oylik to'lovlar, qarzdorlar filtri
- Rollar: `admin`, `accountant` (buxgalter), `employee` (xodim)

## Stek

| Qism | Texnologiya |
|---|---|
| Backend | Node.js 22, Express 5, TypeScript (tsx), Zod |
| Ma'lumotlar bazasi | PostgreSQL (`DATABASE_URL`); lokalda o'rnatish shart emas, o'rniga fayldagi PGlite ishlaydi |
| Real vaqt | Socket.io |
| Auth | JWT + bcrypt |
| Frontend | React 19, Vite, Tailwind CSS 4, React Router |

## Ishga tushirish

Node.js **22.5+** kerak.

```bash
npm install
npm run seed      # demo ma'lumotlar
npm run dev       # API :4000, frontend :5173
```

Demo loginlar (parol `123456`):

| Login | Kim |
|---|---|
| admin@korxona.uz | Korxona administratori |
| buxgalter@korxona.uz | Korxona buxgalteri |
| xodim@korxona.uz | Korxona xodimi (kabinet) |
| admin@markaz.uz | O'quv markazi administratori |
| oqituvchi@markaz.uz | O'qituvchi (o'quvchi boshiga oylik) |

Real vaqtni sinash: bir oynada `oqituvchi@markaz.uz`, boshqasida `admin@markaz.uz` bilan kiring va o'quvchiga to'lov qabul qiling. O'qituvchi oyligi darhol o'zgaradi.

### Production

```bash
npm run build
JWT_SECRET=uzun-maxfiy-kalit PORT=4000 npm start
```

Server `client/dist` ni o'zi beradi.

Muhit o'zgaruvchilari:

| Nomi | Vazifasi |
|---|---|
| `DATABASE_URL` | PostgreSQL ulanish manzili. Berilmasa, `server/data/pglite` papkasidagi lokal baza ishlatiladi (`PGLITE_DIR` bilan o'zgartiriladi) |
| `JWT_SECRET` | Token imzosi uchun maxfiy kalit (production'da majburiy) |
| `ADMIN_RESET_KEY` | Parolni tiklash kaliti. Kirish sahifasidagi "Parolni unutdingizmi?" faqat shu o'rnatilganda ishlaydi |

### Bepul serverga joylash (Render.com + Neon)

**1. Baza (Neon, bepul PostgreSQL):**
1. [neon.tech](https://neon.tech) da GitHub orqali ro'yxatdan o'ting va yangi loyiha yarating (region: Frankfurt).
2. **Connect** tugmasini bosib, `postgresql://...neon.tech/neondb?sslmode=require` ko'rinishidagi ulanish manzilini nusxalang.

**2. Server (Render):**
1. [render.com](https://render.com) da **New → Blueprint** ni bosing va shu repozitoriyani tanlang.
2. `DATABASE_URL` so'ralganda Neon manzilini qo'ying va **Apply** ni bosing.
3. Mavjud service bo'lsa: service → **Environment** → `DATABASE_URL` qo'shing va saqlang.

`ADMIN_RESET_KEY` avtomatik yaratiladi, uni service → **Environment** bo'limida ko'rish mumkin.

Demo ma'lumotlar production'da avtomatik yaratilmaydi. Kerak bo'lsa, lokal kompyuterdan `DATABASE_URL=... npm run seed` bilan qo'shing (demo parollar `123456`, shuning uchun haqiqiy ishlatishda qo'shmang).

Bepul tarifda server 15 daqiqa ishlatilmasa uxlaydi va birinchi ochilishi ~1 daqiqa kutadi. Ma'lumotlar Neon'da saqlangani uchun o'chmaydi.

### Testlar

```bash
npm test
```

## Tuzilma

```
server/src/
  db.ts         sxema va PostgreSQL / PGlite yordamchilari
  payroll.ts    oylik hisoblash (sof funksiya + vedomost)
  routes.ts     REST API
  realtime.ts   Socket.io xonalari (tashkilot / xodim)
  auth.ts       JWT, rollar
client/src/
  pages/        Bosh sahifa, Vedomost, Xodimlar, Tabel, Bonuslar, Guruhlar, O'quvchilar, Sozlamalar, Mening oyligim
```
