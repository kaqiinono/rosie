from pathlib import Path
import subprocess, shutil, hashlib, json
root=Path.cwd(); target=Path('/private/tmp/final-fix-production-build');target.mkdir(exist_ok=True)
paths=subprocess.check_output(['git','ls-files','-z']).decode().split('\0')
paths += ['apps/web/src/lib/material-file-type.ts','apps/web/tests/materials/scan-preview-integration.test.tsx']
manifest={}
for name in sorted(set(paths)):
 if not name or any(p.startswith('.env') or p=='env.local' for p in Path(name).parts):continue
 src=root/name
 if not src.is_file():continue
 dst=target/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
 if name.startswith(('apps/web/src/','packages/','apps/web/public/')) and not name.endswith(('.md','.tsbuildinfo')):
  manifest[name]=hashlib.sha256(src.read_bytes()).hexdigest()
log=Path('/Users/meinuo/github/rosie/.superpowers/sdd/2026-10-29-course-task-material-capacity/final-fix-logs')
(log/'source-hashes.json').write_text(json.dumps(manifest,indent=2));print(len(manifest),'source hashes',hashlib.sha256(json.dumps(manifest,sort_keys=True).encode()).hexdigest())
