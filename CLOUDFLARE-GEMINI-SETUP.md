# ربط EVO CORE مع Google Gemini عبر Cloudflare Workers

هذه الإضافة تنشئ وسيطاً خلفياً. مفتاح Google لا يصل إلى المتصفح ولا يوضع في مستودع GitHub.

## ما تحتاجه
- حساب Google لإنشاء مفتاح Gemini API من Google AI Studio.
- حساب Cloudflare لتشغيل Worker. يمكن البدء بخطة Workers Free ضمن حدودها الحالية.
- نشر نسخة EVO CORE على GitHub Pages.

## 1) إنشاء مفتاح Gemini المجاني
1. افتح https://aistudio.google.com/app/apikey
2. سجّل الدخول بحساب Google.
3. أنشئ API key لمشروع على Free Tier.
4. انسخ المفتاح واحتفظ به لنفسك. لا ترسله في المحادثة ولا تضعه في ملفات GitHub.
5. راجع صفحة Usage / Rate limits في AI Studio؛ الحصة تختلف حسب الحساب والنموذج وقد تتغير.

النموذج الافتراضي في هذا المشروع هو gemini-3.5-flash-lite، ويمكن تغييره في متغير GEMINI_MODEL. توافره المجاني والحصة الفعلية يجب تأكيدهما في مشروعك داخل AI Studio.

## 2) نشر Worker
1. افتح https://dash.cloudflare.com/
2. ادخل Workers & Pages ثم Create application ثم Create Worker.
3. افتح محرر الكود، واستبدل الكود الافتراضي بمحتوى worker/index.js من هذا المستودع.
4. انشر Worker.
5. من Settings ثم Variables and Secrets:
   - أضف Secret باسم GEMINI_API_KEY وضع فيه مفتاح AI Studio.
   - أضف Text variable باسم ALLOWED_ORIGIN بقيمة عنوان GitHub Pages الفعلي لموقعك.
   - أضف Text variable باسم GEMINI_MODEL بقيمة gemini-3.5-flash-lite (إذا كان النموذج متاحاً على حسابك).
6. أعد نشر Worker بعد إضافة المتغيرات إن طلبت لوحة Cloudflare ذلك.
7. انسخ عنوان Worker، مثل https://اسم-worker.اسم-الحساب.workers.dev.

لا تفترض أن عنوان GitHub Pages هو المذكور أعلاه إذا كان المستودع يستخدم نطاقاً مخصصاً. ضع نطاق الموقع المنشور الفعلي في ALLOWED_ORIGIN.

## 3) وصل الموقع بالخادم
1. افتح EVO CORE بعد نشر تحديث الواجهة.
2. في قسم محادثة العقل الذكي، اكتب عنوان Worker متبوعاً بـ /api/chat.
3. اضغط حفظ العنوان.
4. أرسل رسالة اختبار. إذا ظهر رد Gemini فقد اكتمل الربط.

## 4) فحص الاتصال
افتح عنوان Worker متبوعاً بـ /health. يجب أن يظهر JSON فيه ok=true وprovider=Google Gemini.

## 5) حدود الأمان والتكلفة
- لا تضع GEMINI_API_KEY في HTML أو JavaScript أو GitHub Secrets الخاصة بواجهة Pages.
- CORS يقيّد المتصفحات المسموح لها، لكنه ليس مصادقة ولا يمنع الطلبات المباشرة من البرامج. قبل مشاركة الموقع علناً، أضف حماية من الإساءة مثل Cloudflare Rate Limiting وTurnstile أو بوابة وصول للمستخدمين.
- لا توجد قاعدة بيانات للمحادثات في الخادم؛ سجل المحادثة في هذه النسخة محلي داخل متصفحك.
- Gemini Free Tier له حدود RPM وTPM وRPD تختلف حسب النموذج والمشروع. عند نفاد الحصة ستظهر رسالة انتظار/تجاوز الحد؛ لا يعني ذلك أن الربط تعطل.
- في Free Tier قد تستخدم Google الطلبات والردود لتحسين منتجاتها وفق شروطها. لا ترسل معلومات سرية أو شخصية حساسة.
- Cloudflare Workers Free له حدود تشغيل وطلبات، ويمكن أن تتغير. راجع لوحة حسابك والوثائق الرسمية.

## عقد API
يرسل الموقع POST /api/chat بجسم JSON يحتوي messages. يعيد Worker { "reply": "..." } وهو الشكل الذي تقرؤه واجهة EVO CORE الحالية.
