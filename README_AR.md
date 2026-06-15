# 🎮 خَلّد — منصة ألعاب أبو خالد

منصة عربية تضم **9 ألعاب** و **+8900 سؤال وتحدٍّ** لا تتكرر عليك:

| # | اللعبة | الوصف |
|---|--------|-------|
| 1 | 🧠 سين جيم | لوحة فئات ونقاط + وسائل مساعدة + **أونلاين بين الأجهزة** |
| 2 | 🖼️ تحدي الصور | القط المختلف، اللقطة المقرّبة، ولغز الإيموجي |
| 3 | 🔤 الحروف مع أبو خالد | عجلة تختار الحرف + مؤقّت |
| 4 | 🧩 فوازير | ألغاز منطقية وكلامية |
| 5 | 📊 فاميلي فيود | استطلاع رأي وبطاقات تنقلب |
| 6 | 🎭 بنك الكلمات | تمثيل/رسم/شرح بثلاث مستويات |
| 7 | 🕵️ من أنا؟ | تلميحات من الصعب للسهل |
| 8 | ⚡ من الشخصية؟ | جولات سريعة بـ3 تلميحات |
| 9 | 🏁 مين أسرع واحد؟ | أوامر لحظية |

**مميزات إضافية:** قاعدة أسئلة قابلة للبحث والإضافة، تسجيل دخول بقوقل، لوحة متصدرين، أصوات ومؤثرات، تصميم متجاوب بالكامل، ومنع تكرار الأسئلة عبر الجلسات.

---

## 🚀 النشر السريع (3 أوامر)
```bash
npm install
npx wrangler login
npm run deploy
```
يعطيك رابطاً مثل `https://khallad.<اسمك>.workers.dev` 🎉

> اللعب المحلي وكل الألعاب الثمانية تشتغل فوراً. الأونلاين والمتصدرون يحتاجون النشر.

---

## 🗄️ تفعيل قاعدة البيانات (اختياري — للمتصدرين والأسئلة المشتركة)
```bash
# 1) أنشئ قاعدة D1
npx wrangler d1 create khallad-db
# 2) انسخ database_id وأزل # عن قسم [[d1_databases]] في wrangler.toml
# 3) أنشئ الجداول
npx wrangler d1 execute khallad-db --remote --file=schema.sql
# 4) أعد النشر
npm run deploy
```
بدون D1، الأسئلة المضافة تُحفظ محلياً على جهاز كل مستخدم فقط.

---

## 🔐 تفعيل الدخول بقوقل (اختياري)
1. افتح [Google Cloud Console](https://console.cloud.google.com/) ← **APIs & Services ← Credentials**
2. أنشئ **OAuth 2.0 Client ID** نوع *Web application*
3. في **Authorized JavaScript origins** أضف رابط موقعك (مثل `https://khallad.xxx.workers.dev`)
4. انسخ **Client ID** وضعه في أول `public/index.html`:
   ```js
   const GOOGLE_CLIENT_ID = "ضع-المعرف-هنا.apps.googleusercontent.com";
   ```
5. أعد النشر. السيرفر يتحقق من الرمز عبر Google tokeninfo تلقائياً.

---

## 🔄 الربط مع GitHub (نشر تلقائي مع كل تعديل)
```bash
git init && git add . && git commit -m "khallad platform"
git branch -M main
git remote add origin https://github.com/zv3z/khallad.git
git push -u origin main
```
ثم في مستودع GitHub ← **Settings ← Secrets and variables ← Actions** أضف:
- `CLOUDFLARE_API_TOKEN` (من Cloudflare ← My Profile ← API Tokens ← Edit Cloudflare Workers)
- `CLOUDFLARE_ACCOUNT_ID` (من لوحة Cloudflare)

بعدها أي `git push` على فرع `main` ينشر الموقع تلقائياً عبر ملف `.github/workflows/deploy.yml` ✅

---

## ➕ إضافة آلاف الأسئلة دفعة واحدة
الأسئلة تُولَّد بسكربتات بايثون (مرفقة):
```bash
python3 gen_bank.py    # يولّد public/questions.js (سين جيم)
python3 gen_games.py   # يولّد public/games.js (الألعاب الثمانية)
```
عدّل المصفوفات داخلها (كل سؤال: `{"p":600,"q":"...","a":"..."}`) ثم أعد التوليد والنشر.
المولّد يمنع التكرار عالمياً تلقائياً.

---

## 🗂️ البنية
```
khallad-online/
├── wrangler.toml            إعدادات كلاودفلير + D1
├── schema.sql               جداول قاعدة البيانات
├── package.json
├── gen_bank.py              مولّد بنك سين جيم (+7100 سؤال)
├── gen_games.py             مولّد الألعاب الثمانية
├── .github/workflows/
│   └── deploy.yml           نشر تلقائي عند الدفع
├── src/worker.js            السيرفر (غرف + D1 + قوقل + متصدرون)
└── public/
    ├── index.html           المنصة كاملة (9 ألعاب)
    ├── questions.js          بنك سين جيم
    └── games.js              بنوك الألعاب الثمانية
```

---
صُنع بحب لـ **أبو خالد** ⚡
