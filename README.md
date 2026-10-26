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
- Oylik vedomosti: jonli hisob → qoralama → tasdiqlangan → to'langan (qulflanadi)
- **Xodim kabineti:** xodim faqat o'z oyligini ko'radi, buxgalter biror narsani o'zgartirsa sahifa Socket.io orqali darhol yangilanadi
- O'quv markazi: guruhlar, o'quvchilar, oylik to'lovlar, qarzdorlar filtri
- Rollar: `admin`, `accountant` (buxgalter), `employee` (xodim)

## Stek

| Qism | Texnologiya |
|---|---|
| Backend | Node.js 22, Express 5, TypeScript (tsx), Zod |
| Ma'lumotlar bazasi | SQLite (Node'ning o'rnatilgan `node:sqlite` moduli, native paket shart emas) |
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

Server `client/dist` ni o'zi beradi. Ma'lumotlar bazasi fayli: `server/data/bugalter.db` (`DB_FILE` bilan o'zgartiriladi).

### Bepul serverga joylash (Render.com)

1. [render.com](https://render.com) da GitHub orqali ro'yxatdan o'ting.
2. **New → Blueprint** ni bosing va shu repozitoriyani tanlang. `render.yaml` hamma sozlamani o'zi o'qiydi.
3. **Apply** ni bosing. 3–5 daqiqadan keyin `https://bugalter-xxxx.onrender.com` manzili ochiladi.

Bepul tarif cheklovlari:
- 15 daqiqa ishlatilmasa server uxlaydi, birinchi ochilishi ~1 daqiqa kutadi.
- Disk saqlanmaydi: server qayta ishga tushganda kiritilgan ma'lumotlar o'chadi va demo ma'lumotlar qaytadan yaratiladi. Haqiqiy ishlatish uchun PostgreSQL (masalan Neon yoki Render Postgres) ga o'tish kerak.

### Testlar

```bash
npm test
```

## Tuzilma

```
server/src/
  db.ts         sxema va SQLite yordamchilari
  payroll.ts    oylik hisoblash (sof funksiya + vedomost)
  routes.ts     REST API
  realtime.ts   Socket.io xonalari (tashkilot / xodim)
  auth.ts       JWT, rollar
client/src/
  pages/        Bosh sahifa, Vedomost, Xodimlar, Tabel, Bonuslar, Guruhlar, O'quvchilar, Sozlamalar, Mening oyligim
```
