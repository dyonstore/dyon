import json, os
os.chdir('/home/user/webapp')
def sub(p,a,b):
    s=open(p).read()
    if a not in s: raise SystemExit(f'missing in {p}: {a[:70]}')
    open(p,'w').write(s.replace(a,b,1))
en=json.load(open('locales/en.json')); ar=json.load(open('locales/ar.json')); fr=json.load(open('locales/fr.json'))
sub('js/validate.js',"t('validate.field_need_attention', { n: formatNumber(n), n2: n === 1 ? '' : 's', n3: n === 1 ? 's' : '' })","t('validate.field_need_attention', { count: n })")
en['validate.field_need_attention']='{count, plural, one {# field needs your attention:} other {# fields need your attention:}}'
ar['validate.field_need_attention']='{count, plural, one {حقل واحد يحتاج انتباهك:} two {حقلان يحتاجان انتباهك:} few {# حقول تحتاج انتباهك:} many {# حقلًا يحتاج انتباهك:} other {# حقل يحتاج انتباهك:}}'
sub('js/guide.js',"t('guide.short_chapters_explaining_every', { count: GUIDE.length, count2: formatNumber(GUIDE.length) })","t('guide.short_chapters_explaining_every', { count: GUIDE.length })")
en['guide.short_chapters_explaining_every']='{count, plural, one {# short chapter} other {# short chapters}} explaining every screen, every button and every term, plus an A–Z glossary of every word. Read in order, or jump to what you need.'
ar['guide.short_chapters_explaining_every']='{count, plural, one {فصل قصير واحد يشرح} two {فصلان قصيران يشرحان} few {# فصول قصيرة تشرح} many {# فصلًا قصيرًا تشرح} other {# فصل قصير يشرح}} كل شاشة وكل زر وكل مصطلح، ومسرد أبجدي لكل كلمة. اقرأها بالترتيب، أو اقفز إلى ما تحتاجه.'
# fix the checker: plural branch keys aren't variables -> only top-level vars. Fix fr count.people word 'Personne'
fr['count.people']='{count, plural, =0 {Aucune personne} one {# personne} other {# personnes}}'
for d in (en,ar,fr): json.dump(d,open(f"locales/{'en' if d is en else 'ar' if d is ar else 'fr'}.json",'w'),ensure_ascii=False,indent=1)
print('ok')
