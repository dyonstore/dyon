import json, os, re
os.chdir('/home/user/webapp')
def sub(p,a,b):
    s=open(p).read()
    if a not in s: raise SystemExit(f'missing in {p}: {a[:70]}')
    open(p,'w').write(s.replace(a,b,1))
en=json.load(open('locales/en.json')); ar=json.load(open('locales/ar.json'))
def setk(k,e,a):
    en[k]=e; ar[k]=a
def drop(*ks):
    for k in ks: en.pop(k,None); ar.pop(k,None)

sub('js/app.js',"""        text: (t('app.that_pin_not_right')) +
          (attempts >= 3
            ? (t('app.if_have_forgotten_clearing'))
            : '')""","""        text: t('app.pin_wrong', { hint: attempts >= 3 ? 'yes' : 'no' })""")
setk('app.pin_wrong',"That PIN is not right.{hint, select, yes { If you have forgotten it, clearing this site’s browser data starts fresh.} other {}}",
     "رقم غير صحيح.{hint, select, yes { إن نسيته، يمكنك مسح بيانات المتصفح لهذا الموقع للبدء من جديد.} other {}}")
drop('app.that_pin_not_right','app.if_have_forgotten_clearing')

sub('js/auth.js',"el('span', { text: t('auth.continue_with') + p.label }),","el('span', { text: t('auth.continue_with', { provider: p.label }) }),")
setk('auth.continue_with','Continue with {provider}','المتابعة عبر {provider}')
sub('js/auth.js',"toast(t('auth.sign_in_failed') + e.message, 'warn')","toast(t('auth.sign_in_failed', { reason: e.message }), 'warn')")
setk('auth.sign_in_failed','Sign-in failed: {reason}','فشل الدخول: {reason}')
sub('js/auth.js',"el('small', { text: (a.email ? a.email + ' · ' : '') + p.label + (a.preview ? t('auth.preview_2') : '') })",
    "el('small', { text: t('auth.account_line', { email: a.email || '', hasEmail: a.email ? 'yes' : 'no', provider: p.label, preview: a.preview ? 'yes' : 'no' }) })")
setk('auth.account_line','{hasEmail, select, yes {{email} · } other {}}{provider}{preview, select, yes { · preview} other {}}',
     '{hasEmail, select, yes {{email} · } other {}}{provider}{preview, select, yes { · تجريبي} other {}}')
drop('auth.preview_2')
en['auth.why_now']='Why now?'; ar['auth.why_now']='لماذا الآن؟'
sub('js/auth.js',"el('b', { text: t('auth.why_now') }),","el('b', { text: t('auth.why_now') }), ' ',")

sub('js/flows.js',"t('flows.which_currency_candidates', { r: r.unit_candidates.join(', '), r2: r.unit_candidates.join('، ') })",
    "t('flows.which_currency_candidates', { list: new Intl.ListFormat(intlTag(), { type: 'disjunction' }).format(r.unit_candidates) })")
setk('flows.which_currency_candidates','Which currency? Candidates: {list}','أي عملة تقصد؟ المرشحون: {list}')
s=open('js/flows.js').read()
s=re.sub(r"import \{ t, ([^}]*)\} from './i18n.js';", lambda m: "import { t, "+m.group(1).rstrip()+(", intlTag" if 'intlTag' not in m.group(1) else '')+" } from './i18n.js';", s, 1)
open('js/flows.js','w').write(s)
sub('js/flows.js',"t('flows.mb_per_file_images', { MAX_FILE_MB: VAL.MAX_FILE_MB })","t('flows.mb_per_file_images', { mb: formatNumber(VAL.MAX_FILE_MB) })")
for d in (en,ar): d['flows.mb_per_file_images']=d['flows.mb_per_file_images'].replace('{MAX_FILE_MB}','{mb}')
sub('js/flows.js',"note: (t('flows.text')) + nameInput.value.trim() }","note: t('flows.to_name', { name: nameInput.value.trim() }) }")
setk('flows.to_name','To {name}', ar.get('flows.text','إلى ').strip()+' {name}')
drop('flows.text')
sub('js/flows.js',"t('flows.one_record_two_views', { unit_code: formatAmount(c.amount_minor, c.unit_code), incurred_on: formatDate(c.incurred_on) })",
    "t('flows.one_record_two_views', { amount: formatAmount(c.amount_minor, c.unit_code), date: formatDate(c.incurred_on) })")
for d in (en,ar): d['flows.one_record_two_views']=d['flows.one_record_two_views'].replace('{unit_code}','{amount}').replace('{incurred_on}','{date}')
sub('js/flows.js',"t('flows.are_about_release_from', { cp: cp?.alias || '' })","t('flows.are_about_release_from', { name: cp?.alias || '' })")
for d in (en,ar): d['flows.are_about_release_from']=d['flows.are_about_release_from'].replace('{cp}','{name}')

sub('js/guide.js',"el('span', { text: ' ' + (t('guide.chapter')) + L(e.chapter.title) })","el('span', { text: t('guide.chapter_link', { title: L(e.chapter.title) }) })")
setk('guide.chapter_link','Chapter: {title}','الفصل: {title}'); drop('guide.chapter')
sub('js/guide.js',"formatNumber(GUIDE.length) + (t('guide.chapters'))","t('guide.chapters_count', { count: GUIDE.length })")
setk('guide.chapters_count','{count, plural, one {# chapter} other {# chapters}}','{count, plural, one {فصل واحد} two {فصلان} few {# فصول} many {# فصلًا} other {# فصل}}'); drop('guide.chapters')

sub('js/qr.js',"t('qr.qr_code') + kindLabel(payload.k)","t('qr.qr_code', { kind: kindLabel(payload.k) })")
setk('qr.qr_code','QR code: {kind}','رمز QR: {kind}')
sub('js/qr.js',"t('qr.proposed_date') + formatDate(payload.nd)","t('qr.proposed_date', { date: formatDate(payload.nd) })")
setk('qr.proposed_date','Proposed date: {date}','الموعد المقترح: {date}')
sub('js/qr.js',"(p.f || t('qr.someone')) + (p.pv ? t('qr.unverified') : '')","t('qr.from_name', { name: p.f || t('qr.someone'), unverified: p.pv ? 'yes' : 'no' })")
setk('qr.from_name','{name}{unverified, select, yes { (unverified)} other {}}','{name}{unverified, select, yes { (غير موثّق)} other {}}'); drop('qr.unverified')
json.dump(en,open('locales/en.json','w'),ensure_ascii=False,indent=1)
json.dump(ar,open('locales/ar.json','w'),ensure_ascii=False,indent=1)
print('ok', len(en))
