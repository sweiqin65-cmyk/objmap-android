from pathlib import Path
import json, shutil
root=Path.cwd()
if not (root/'index.html').exists() or not (root/'package.json').exists():
    raise SystemExit('Run from the root of a cloned zeldamods/objmap repository.')
source=Path(__file__).resolve().parent
html=root/'index.html'
s=html.read_text(encoding='utf-8')
tag='<script type="module" src="/mobile-overlay.js"></script>'
if tag not in s:
    s=s.replace('</body>', f'  {tag}\n</body>')
    html.write_text(s,encoding='utf-8')
shutil.copyfile(source/'mobile-overlay'/'mobile-overlay.js',root/'public'/'mobile-overlay.js')
(root/'capacitor.config.json').write_text(json.dumps({
 'appId':'org.zeldamods.objmap.mobile',
 'appName':'ObjMap Collector',
 'webDir':'dist',
 'server':{'androidScheme':'https'}
},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Installed overlay and Capacitor config. Continue with README build steps.')
