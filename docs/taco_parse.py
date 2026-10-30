import re, sys, json
txt = open(sys.argv[1], encoding='utf-8').read().split('\n')
# Tabela 1: "  N   Descrição   umid  kcal  kJ  prot  lip  col  carb  fibra  cinzas  Ca ..."
t1 = {}
for ln in txt:
    m = re.match(r'^\s*(\d+)\s{2,}([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n]*?)\s{2,}([\d,]+|Tr|NA)\s+([\d,]+|Tr|NA)\s+([\d,]+|Tr|NA)\s+([\d,]+|Tr|NA)\s+([\d,]+|Tr|NA)\s+([\d,]+|Tr|NA|\*)\s+([\d,]+|Tr|NA)\s+([\d,]+|Tr|NA)\s+', ln)
    if m:
        n = int(m.group(1)); nome = m.group(2).strip()
        vals = [m.group(i) for i in range(3, 11)]
        if n not in t1: t1[n] = dict(nome=nome, umid=vals[0], kcal=vals[1], kj=vals[2], prot=vals[3], lip=vals[4], col=vals[5], carb=vals[6], fibra=vals[7])
# Tabela 2 (minerais/vitaminas): "  N   Mn  P  Fe  Na  K ..." — linhas só com número e valores
t2 = {}
for ln in txt:
    m = re.match(r'^\s*(\d+)\s{2,}([\d,]+|Tr|NA)\s+([\d,]+|Tr|NA)\s+([\d,]+|Tr|NA)\s+([\d,]+|Tr|NA)\s+([\d,]+|Tr|NA)', ln)
    if m and int(m.group(1)) in t1 and int(m.group(1)) not in t2:
        t2[int(m.group(1))] = dict(mn=m.group(2), p=m.group(3), fe=m.group(4), na=m.group(5), k=m.group(6))
def val(v):
    if v in ('Tr',): return 0.0
    if v in ('NA', '*', None): return None
    return float(v.replace(',', '.'))
out = {}
for n, r in t1.items():
    out[r['nome']] = dict(num=n, kcal=val(r['kcal']), prot=val(r['prot']), gord=val(r['lip']), carb=val(r['carb']), fibra=val(r['fibra']), sodio=val(t2.get(n, {}).get('na')))
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('itens tabela 1:', len(t1), '| com sódio:', sum(1 for n in t1 if n in t2))
for q in sys.argv[3:]:
    hits = [k for k in out if q.lower() in k.lower()]
    for h in hits[:4]: print(' ', h, out[h])
