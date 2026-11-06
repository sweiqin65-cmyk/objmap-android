from pathlib import Path
import json, shutil
root = Path.cwd()
if not (root/'index.html').exists() or not (root/'src/MapBase.ts').exists():
    raise SystemExit('必须从克隆的 zeldamods/objmap 根目录执行 install.py')
source = Path(__file__).resolve().parent
html = root/'index.html'
s = html.read_text(encoding='utf-8')
tag = '<script type="module" src="/mobile-overlay.js"></script>'
if tag not in s:
    s = s.replace('</body>', f'  {tag}\n</body>')
    html.write_text(s, encoding='utf-8')
# 直接从原版 Leaflet MapBase 发布地图实例，避免猜测 DOM 中的私有 Leaflet 属性。
mapfile = root/'src/MapBase.ts'
s = mapfile.read_text(encoding='utf-8')
needle = '    this.rc = new L.RasterCoords(this.m, map.MAP_SIZE);'
injection = '''    // ObjMap Android 2.0: 供手机收集路线层使用的地图桥接。
    (window as any).__objmapMobileLeaflet = L;
    (window as any).__objmapMobileMap = this.m;
    window.dispatchEvent(new Event('objmap-mobile-map-ready'));
'''
if '__objmapMobileMap' not in s:
    if needle not in s:
        raise SystemExit('原版 MapBase.ts 结构变化，停止打补丁以避免构建损坏')
    mapfile.write_text(s.replace(needle, injection+needle, 1), encoding='utf-8')
(root/'public').mkdir(exist_ok=True)
shutil.copyfile(source/'mobile-overlay'/'mobile-overlay.js',root/'public'/'mobile-overlay.js')
(root/'capacitor.config.json').write_text(json.dumps({'appId':'org.zeldamods.objmap.mobile','appName':'海拉鲁地图助手','webDir':'dist','server':{'androidScheme':'https'}},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('ObjMap 2.0 第一阶段补丁安装完成')
