# RecruiterFlow — Backend Foundation (Step 6)

## Nimalar tayyor?
- `index.html` — RecruiterFlow interfeysi; skript matnlari login’dan keyin Supabase’dan yuklanadi.
- `supabase/migrations/001_initial_schema.sql` — jadvallar, rollar va RLS siyosatlari.
- `supabase/migrations/002_audit_triggers.sql` — skript va rol o‘zgarishlari uchun server-side audit yozuvlari.
- `supabase-app.js` — Supabase Auth, umumiy skript kutubxonasi, rol boshqaruvi va audit jurnalini ulaydi.
- `supabase-config.js` — faqat brauzerda ishlatish uchun Supabase Project URL va publishable key konfiguratsiyasi.
- Rollar: `owner`, `admin`, `editor`, `user`. Yangi ro‘yxatdan o‘tganlar avtomatik `user` bo‘ladi.
- Skript yozish huquqi Owner/Admin’da yoki `can_edit_scripts` ruxsati yoqilgan Editor’da bo‘ladi. User skriptlarni faqat o‘qiydi.

## O‘rnatish
1. Supabase’da loyiha yarating va SQL Editor’da avval `supabase/migrations/001_initial_schema.sql`, keyin `supabase/migrations/002_audit_triggers.sql` fayllarini to‘liq ishga tushiring.
2. Authentication → Providers bo‘limida Email provider yoqilganini tekshiring. Email tasdiqlash sozlamasiga qarab, yangi foydalanuvchi emailini tasdiqlashi kerak bo‘lishi mumkin.
3. Supabase Project Settings → API’dan Project URL va **publishable** key (`sb_publishable_...`; eski loyihalarda `anon` key) qiymatlarini oling va `supabase-config.js` ichiga kiriting.
4. Sayt: https://mezfis.github.io/recruiterflow-backend-foundation/ . Supabase Authentication → URL Configuration’da Site URL va Redirect URLs shu manzilga sozlangan.
5. Ilovada hisob yarating. U `user` rolida ochiladi. Birinchi Owner’ni quyidagi SQL bilan qo‘lda tayinlang:

```sql
update public.profiles
set role = 'owner', can_edit_scripts = true
where lower(email) = lower('SENING_EMAILING');
```

6. Owner hisobidan qayta kiring. Skript matnlarini HTML yoki GitHub’ga joylamang: ular Supabase’dagi `scripts` jadvalida saqlanadi va faqat login qilgan foydalanuvchiga RLS orqali beriladi.
7. Owner ilova ichida boshqa profillarga `admin`, `editor` yoki `user` rolini, shuningdek Editor ruxsatini beradi. Admin rollarni boshqara olmaydi.

## Xavfsizlik va audit
- Brauzerga faqat Supabase Project URL va publishable/anon key qo‘yiladi. `service_role` yoki boshqa maxfiy kalitni hech qachon HTML/JavaScript’ga joylamang.
- HTML manbaida skript kutubxonasi bo‘lmasligi kerak. Bu statik saytni ommaviy host qilganda skript matnlarining login’siz tarqalishini oldini oladi.
- Frontend’dagi rol tekshiruvlari interfeys uchun; haqiqiy ruxsatlar `001_initial_schema.sql` dagi RLS siyosatlari bilan serverda tekshiriladi.
- Audit jadvaliga client yozolmaydi. `002_audit_triggers.sql` ishonchli DB triggerlari orqali skript yaratish/tahrirlash/o‘chirish va profil ruxsatlari o‘zgarishini qayd etadi.
- Owner audit jurnalidagi barcha yozuvlarni ko‘radi; boshqa foydalanuvchilar faqat o‘zlari bajargan yozuvlarni ko‘ra oladi.
- `supabase-config.js` ichidagi publishable key ommaviy qiymat, biroq loyiha URL’i va Auth redirect sozlamalari to‘g‘ri bo‘lishi kerak. RLS’ni test qilmasdan ishlab chiqarishga chiqarmang.

## Tekshirish
- Supabase SQL Editor’da migration’lar xatosiz bajarilganini va Owner tayinlanganini tekshiring.
- `user` bilan kirib skript boshqaruv tugmasi ko‘rinmasligini, `admin` yoki ruxsatli `editor` bilan esa yozish ishlashini sinang.
- Skript yaratish/tahrirlash/o‘chirish va rol o‘zgarishidan keyin audit jurnalini tekshiring.
- 2026-11-05 kuni `supabase-config.js` dagi loyiha bilan Auth health endpointi hamda `profiles` va `scripts` REST endpointlari tekshirildi; barchasi HTTP 200 qaytardi.
- Bu tekshiruv hisob bilan kirish, RLS ruxsatlari, audit triggerlari yoki Owner tayinlanganini tasdiqlamaydi. Bularni haqiqiy foydalanuvchi hisoblari bilan yuqoridagi tartibda sinang.
