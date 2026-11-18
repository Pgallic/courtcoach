import json, sys
import os
root=os.path.dirname(os.path.abspath(__file__))+'/'
local = '--local' in sys.argv
css=open(root+'src/styles.css').read()
av=json.load(open(root+'assets/avatars.json'))
js=''.join(open(root+'src/'+f).read()+'\n' for f in ['logic.js','plays.js','app1.js','app2.js','app3.js','app4.js','app5.js','app7.js','app8.js','app6.js'])
V=root+'vendor/'
cdn = {
 'preact':'https://cdn.jsdelivr.net/npm/preact@10.24.3/dist/preact.umd.js',
 'hooks':'https://cdn.jsdelivr.net/npm/preact@10.24.3/hooks/dist/hooks.umd.js',
 'htm':'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js',
 'jspdf':'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'}
loc = {
 'preact':'file://'+V+'preact-10.24.3/package/dist/preact.umd.js',
 'hooks':'file://'+V+'preact-10.24.3/package/hooks/dist/hooks.umd.js',
 'htm':'file://'+V+'htm-3.1.1/package/dist/htm.umd.js',
 'jspdf':'file://'+V+'jspdf-2.5.1/package/dist/jspdf.umd.min.js'}
src = loc if local else cdn
page=f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CourtCoach</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800;900&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders:wght@600;800;900&display=swap" rel="stylesheet" />
<style>
{css}
</style>
</head>
<body>
<div id="root"><p style="padding:24px;font-family:system-ui">Loading CourtCoach…</p></div>
<script src="{src['preact']}"></script>
<script src="{src['hooks']}"></script>
<script src="{src['htm']}"></script>
<script>
const AVATARS = {json.dumps(av)};
const JSPDF_SRC = {json.dumps(src['jspdf'])};
{js}
</script>
</body>
</html>
'''
out = root+('dist/local.html' if local else 'dist/index.html')
open(out,'w').write(page)
print(out, round(len(page)/1024,1),'KB')
