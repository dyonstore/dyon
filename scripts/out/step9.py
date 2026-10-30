import json, os
os.chdir('/home/user/webapp')
def sub(p,a,b,cnt=1, required=True):
    s=open(p).read()
    if a not in s:
        if required: raise SystemExit(f'missing in {p}: {a[:60]}')
        return
    s=s.replace(a,b,cnt); open(p,'w').write(s)
en=json.load(open('locales/en.json')); ar=json.load(open('locales/ar.json'))
sub('js/auth.js',"el('span', { text: L(why.en, why.ar) + t('auth.involves_another_person_so') })",
    "el('span', { text: t('auth.gate_reason', { feature: tr(why) }) })")
sub('js/auth.js',"import { getLocale } from './i18n.js';","import { t, tr } from './i18n.js';")
sub('js/auth.js',"const isAR = () => getLocale() === 'ar';\nconst L = (en, ar) => (isAR() ? ar : en);\n","")
sub('js/qr.js',"const isAR = () => getLocale() === 'ar';\nconst L = (en, ar) => (isAR() ? ar : en);\n","")
sub('js/qr.js',"return L(x.en, x.ar); };","return tr(x); };")
sub('js/qr.js',"import { t, getLocale, formatDate } from './i18n.js';","import { t, tr, getDir, formatDate } from './i18n.js';")
sub('js/guide.js',"const isAR = () => getLocale() === 'ar';\nconst L = (obj) => (obj ? (isAR() ? (obj.ar ?? obj.en) : (obj.en ?? obj.ar)) : '');","const L = (obj) => tr(obj);")
sub('js/guide.js',"import { t, getLocale, getDir, formatNumber } from './i18n.js';","import { t, tr, getLocale, getDir, formatNumber } from './i18n.js';")
for f in ['js/flows.js','js/validate.js','js/views.js','js/views2.js']:
    sub(f,"const isAR = () => getLocale() === 'ar';\n","")
en['auth.gate_reason']='{feature} involves another person, so DYON needs to know who is writing.'
ar['auth.gate_reason']='{feature} يشمل شخصًا آخر، فيحتاج ديون أن يعرف من الكاتب.'
for d in (en,ar): d.pop('auth.involves_another_person_so',None)
new = {
 'date.dual': ('{main} · {secondary}','{main} · {secondary}'),
 'amount.currency': ('{unit} {amount}','{amount} {unit}'),
 'amount.unit': ('{amount} {unit}','{amount} {unit}'),
 'list.numbered': ('{n}. {text}','{n}. {text}'),
 'wellbeing.note': ('DYON is not therapy or legal advice. Helplines vary by country and change over time — please verify a current local list.',
   'ديون ليس علاجًا ولا استشارة قانونية. خطوط الدعم تختلف حسب البلد وتتغير مع الوقت — يُرجى التحقق من قائمة محلية حديثة.'),
 'share.message': ("Hello {name},\nI've recorded: {amount} ({type}) dated {date}{hasDue, select, yes {, due {due}} other {}}.\nDoes this match what you have? I just want our notes to agree.\n\n— Written with DYON. {disclaimer}",
   "السلام عليكم {name}،\nسجّلت عندي: {amount} ({type}) بتاريخ {date}{hasDue, select, yes {، الاستحقاق {due}} other {}}.\nهل هذا مطابق لما عندك؟ أردت فقط أن تتطابق أوراقنا.\n\n— سجل مكتوب عبر تطبيق ديون. {disclaimer}"),
 'tpl.remind.gentle': ("Hi {name}, just a friendly note about the {amount} from {date}. No pressure at all. Let me know what works for you 🌿","أهلًا {name}، تذكير لطيف بخصوص {amount} من {date}. لا ضغط أبدًا، أخبرني بما يناسبك 🌿"),
 'tpl.remind.neutral': ("Reminder: {amount}, dated {date}. You can confirm a date that suits you.","تذكير: {amount}، بتاريخ {date}. يمكنك تأكيد موعد مناسب لك."),
 'tpl.remind.formal': ("This is a reminder regarding the outstanding amount of {amount} agreed on {date}.","نود تذكيركم بالمبلغ المستحق وقدره {amount} المتفق عليه بتاريخ {date}."),
 'tpl.remind.islamic': ("Assalamu alaikum {name}. A gentle reminder about the {amount}. And if you are in hardship, ask for respite and I will give it, in shaa Allah.","السلام عليكم يا {name}، تذكير لطيف بـ {amount}. وإن كنت في عسرة فاطلب الإنظار وأنا أُنظرك إن شاء الله ﴿فَنَظِرَةٌ إِلَىٰ مَيْسَرَةٍ﴾"),
 'tpl.hardship': ("Hi {name}, no worry at all about the {amount}. Whenever things ease, tell me a timing that suits you. Take the time you need.","أهلًا {name}، لا داعي لأي قلق بشأن {amount}. متى ما تيسّر الأمر أخبرني بموعد يناسبك، ولك كل الوقت."),
 'tpl.ask_for_me': ("Hi {name}, I'm tidying my records in DYON and it shows {amount}. Does that match what you have? No rush at all — I just want our notes to agree.","أهلًا {name}، أرتّب سجلاتي في تطبيق \"ديون\" وظهر عندي {amount}. هل الرقم صحيح عندك؟ لا استعجال إطلاقًا، أردت فقط أن تكون أوراقنا متطابقة."),
 'tpl.thanks': ("Thank you so much, {name}. Received and settled — and thank you for your patience.","جزاك الله خيرًا يا {name}. وصلني وتم الوفاء، وأشكرك على سعة صدرك."),
 'tpl.release': ("{name}, I've released you from the {amount}. Nothing is owed — please don't carry it any more.","يا {name}، أبرأت ذمتك من {amount}. لا شيء عليك، ولا تذكره بعد اليوم."),
 'tpl.respite_request': ("Hello {name}, I'm in a tight spot right now regarding the {amount}. Could I ask for respite until {date}? I fully intend to fulfil it.","السلام عليكم {name}، أنا في ضيق هذه الفترة بخصوص {amount}. أطلب إنظارًا إلى {date} إن تكرمت، وسأوفي إن شاء الله."),
 'insight.no_due': ("{count, plural, one {# item has no due date.} other {# items have no due date.}} Adding one can lower uncertainty.","{count, plural, one {بند واحد بلا موعد.} two {بندان بلا موعد.} few {# بنود بلا موعد.} many {# بندًا بلا موعد.} other {# بند بلا موعد.}} إضافة موعد تقلّل الغموض."),
 'insight.approximate': ("{count, plural, one {# record is approximate.} other {# records are approximate.}} A quick check with the other person makes them solid.","{count, plural, one {سجل واحد تقريبي.} two {سجلان تقريبيان.} few {# سجلات تقريبية.} many {# سجلًا تقريبيًا.} other {# سجل تقريبي.}} مراجعة سريعة مع الطرف الآخر تجعلها دقيقة."),
 'insight.unshared': ("{count, plural, one {# record is private only.} other {# records are private only.}} Sharing one invites agreement before memory fades (2:282).","{count, plural, one {سجل واحد خاص فقط.} two {سجلان خاصان فقط.} few {# سجلات خاصة فقط.} many {# سجلًا خاصًا فقط.} other {# سجل خاص فقط.}} مشاركة أحدها تبني الاتفاق قبل أن تضعف الذاكرة."),
 'insight.no_evidence': ("{count, plural, one {# larger record has no attachment.} other {# larger records have no attachment.}} A photo of a receipt prevents future disputes.","{count, plural, one {سجل كبير واحد بلا مرفق.} two {سجلان كبيران بلا مرفق.} few {# سجلات كبيرة بلا مرفق.} many {# سجلًا كبيرًا بلا مرفق.} other {# سجل كبير بلا مرفق.}} صورة إيصال تمنع خلافًا لاحقًا."),
 'insight.stale': ("{count, plural, one {# record hasn't moved in six months.} other {# records haven't moved in six months.}} A gentle check-in may be kind.","{count, plural, one {سجل واحد لم يتحرك منذ ستة أشهر.} two {سجلان لم يتحركا منذ ستة أشهر.} few {# سجلات لم تتحرك منذ ستة أشهر.} many {# سجلًا لم يتحرك منذ ستة أشهر.} other {# سجل لم يتحرك منذ ستة أشهر.}} مراجعة لطيفة قد تكون طيبة."),
 'insight.no_plan': ("A plan is just a kinder order of steps. Building one takes a minute.","الخطة مجرد ترتيب ألطف للخطوات، وبناؤها يأخذ دقيقة."),
 'insight.no_executor': ("Naming an executor means your records help your family rather than confuse them.","تسمية وصيّ تجعل سجلاتك عونًا لأهلك لا حَيرة لهم."),
}
for k,(e,a) in new.items(): en[k]=e; ar[k]=a
json.dump(en,open('locales/en.json','w'),ensure_ascii=False,indent=1)
json.dump(ar,open('locales/ar.json','w'),ensure_ascii=False,indent=1)
print('keys', len(en))
