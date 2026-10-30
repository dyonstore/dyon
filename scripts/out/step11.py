import json, os, re
os.chdir('/home/user/webapp')
def sub(p,a,b):
    s=open(p).read()
    if a not in s: raise SystemExit(f'missing in {p}: {a[:70]}')
    open(p,'w').write(s.replace(a,b,1))
en=json.load(open('locales/en.json')); ar=json.load(open('locales/ar.json'))
sub('js/views2.js',"(t('views2.chain_broken')) + r.reason","t('views2.chain_broken', { reason: r.reason })")
en['views2.chain_broken']='Chain broken: {reason}'; ar['views2.chain_broken']=ar['views2.chain_broken'].strip()+' {reason}'
sub('js/views2.js',"(t('views2.last_checked')) + C.WELLBEING.checked","t('views2.last_checked', { date: C.WELLBEING.checked })")
en['views2.last_checked']='Last checked: {date}'; ar['views2.last_checked']=ar['views2.last_checked'].strip()+' {date}'
sub('js/views2.js',"el('p', {}, [el('b', { text: t('views2.date') }), el('span', { text: formatDateDual(S.todayISO()) })]),",
    "el('p', { text: t('views2.date_line', { date: formatDateDual(S.todayISO()) }) }),")
en['views2.date_line']='Date: {date}'; ar['views2.date_line']=ar['views2.date'].strip()+' {date}'
en.pop('views2.date'); ar.pop('views2.date')
json.dump(en,open('locales/en.json','w'),ensure_ascii=False,indent=1)
json.dump(ar,open('locales/ar.json','w'),ensure_ascii=False,indent=1)
s=open('js/flows.js').read()
if not re.search(r"import \{[^}]*formatNumber[^}]*\} from './i18n.js'", s):
    s=s.replace(", intlTag } from './i18n.js';",", intlTag, formatNumber } from './i18n.js';",1)
open('js/flows.js','w').write(s)
print(ar['views2.chain_broken'], '|', ar['views2.date_line'])
