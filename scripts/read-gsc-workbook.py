import sys,json,zipfile,xml.etree.ElementTree as E
n={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
with zipfile.ZipFile(sys.argv[1]) as z:
    strings=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        strings=[''.join(x.itertext()) for x in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',n)]
    rel={r.attrib['Id']:r.attrib['Target'] for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheets={}
    for s in E.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',n):
        target=rel[s.attrib['{'+n['r']+'}id']]
        target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
        rows=[]
        for row in E.fromstring(z.read(target)).findall('m:sheetData/m:row',n):
            cells={}
            for c in row.findall('m:c',n):
                v=c.find('m:v',n)
                value=v.text if v is not None else ''.join(c.find('m:is',n).itertext()) if c.find('m:is',n) is not None else ''
                if c.attrib.get('t')=='s':value=strings[int(value)]
                cells[c.attrib['r']]=value
            rows.append(cells)
        sheets[s.attrib['name']]=rows
    print(json.dumps(sheets,ensure_ascii=False))
