# خدمة Glow Bot

هذا المجلد يشغّل بوت Glow عبر Discord Gateway بشكل مستقل عن موقع الداشبورد. الخدمة تبقى متصلة بـ Discord وتتعامل مع أوامر السلاش، الترحيب، الرولات التلقائية، اللفلات، الردود والتفاعلات التلقائية، والرومات الصوتية المؤقتة، وتقرأ إعدادات السيرفر من Supabase.

## متغيرات البيئة

ضع القيم في Secrets لدى مزود الاستضافة، ولا تضعها في Git أو ترسلها في المحادثة:

```text
DISCORD_BOT_TOKEN=توكن البوت الجديد
SUPABASE_URL=رابط مشروع Supabase
SUPABASE_SERVICE_ROLE_KEY=مفتاح service role السري
PUBLIC_APP_URL=https://your-public-dashboard.example.com
```

`DISCORD_CLIENT_SECRET` و`DISCORD_REDIRECT_URI` مطلوبان أيضاً لخدمة الويب إذا كانت خدمة البوت وخدمة الداشبورد تعملان في نفس البيئة.

## التشغيل المحلي

```bash
pnpm install
pnpm bot
```

لتسجيل أوامر السلاش مرة واحدة يدوياً:

```bash
pnpm bot:commands
```

## Discord Developer Portal

من صفحة **Bot → Privileged Gateway Intents** فعّل **Server Members Intent** و**Message Content Intent**. يحتاج البوت أيضاً إلى الصلاحيات اللازمة داخل السيرفر: View Channels، Send Messages، Embed Links، Add Reactions، Manage Roles، Manage Channels، Moderate Members، وMove Members حسب الوحدات التي ستفعّلها.

أعد دعوة البوت بعد تجديد التوكن فقط إذا تغيّرت الصلاحيات أو scopes. رابط الدعوة يجب أن يستخدم `bot` و`applications.commands`، وليس رابط OAuth2 الخاص بتسجيل دخول المستخدم.

## النشر الدائم

استخدم خدمة Node Worker/Background Worker دائمة أو حاوية Docker، واجعل أمر التشغيل:

```bash
pnpm bot
```

استخدم ملف `Dockerfile.bot` إذا كان مزود الاستضافة يعتمد على Docker. يجب أن تعمل الخدمة كعملية مستقلة طوال الوقت؛ تشغيل موقع الداشبورد وحده لا يشغّل Discord Gateway.

## تشخيص سريع

إذا ظهر `TokenInvalid` أو `401 Unauthorized`، أعد ضبط التوكن من Discord ثم حدّث Secret في مزود الاستضافة وأعد تشغيل الخدمة. إذا أغلق Discord الاتصال برمز `4014`، فعّل الـ privileged intents المطلوبة في Developer Portal. إذا ظهر البوت Online لكن الأوامر لا تظهر، نفّذ `pnpm bot:commands` أو انتظر مزامنة الأوامر العامة.
