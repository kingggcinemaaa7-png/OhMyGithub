#!/usr/bin/env bash
# Kapadokya PRO statik onizleme sunucusu.
# Kaynak + derlenmis cikti PROJECT_DIR icinde (./dist); OPENCODE_WEB_DIR yalnizca
# worker metadata (deployment-output.json), RUNNER_TEMP yalnizca capture kaniti icin.
# PORT varsayilan 3000; on planda calisir (controller saglikliysa yeniden kullanir).
set -euo pipefail
# NOT: `cd` kabuk yerlesigidir; /usr/bin/time ile calistirilamaz. Zamanlama
# yalnizca harici komutlarda /usr/bin/time -p ile yapilir.
cd "$(dirname "$0")"
PROJECT_ROOT="$PWD"
PORT="${PORT:-3000}"
DIST_DIR="$PROJECT_ROOT/dist"
OPENCODE_WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
export PROJECT_ROOT DIST_DIR PORT OPENCODE_WEB_DIR
/usr/bin/time -p bash -n start.sh
/usr/bin/time -p node --version
/usr/bin/time -p test -f "$DIST_DIR/index.html"
# install dependencies + build only when needed (bu proje statik; package.json yoksa atla)
if [ -f "$PROJECT_ROOT/package.json" ]; then
  if [ -f "$PROJECT_ROOT/package-lock.json" ]; then
    /usr/bin/time -p npm --prefix "$PROJECT_ROOT" ci --no-audit --no-fund
  else
    /usr/bin/time -p npm --prefix "$PROJECT_ROOT" install --no-audit --no-fund
  fi
  if /usr/bin/time -p node -e 'process.exit(require(process.env.PROJECT_ROOT+"/package.json").scripts&&require(process.env.PROJECT_ROOT+"/package.json").scripts.build?0:1)'; then
    /usr/bin/time -p npm --prefix "$PROJECT_ROOT" run build
  fi
  /usr/bin/time -p test -f "$DIST_DIR/index.html"
fi
/usr/bin/time -p mkdir -p "$OPENCODE_WEB_DIR"
/usr/bin/time -p node -e 'const fs=require("fs"),path=require("path");const web=process.env.OPENCODE_WEB_DIR;fs.mkdirSync(web,{recursive:true});const out={project:process.env.PROJECT_ROOT,directory:process.env.DIST_DIR};fs.writeFileSync(path.join(web,"deployment-output.json"),JSON.stringify(out));console.log("deployment-output.json -> "+path.join(web,"deployment-output.json"));'
echo "serving $DIST_DIR on port $PORT (project $PROJECT_ROOT)"
/usr/bin/time -p node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const root=process.env.DIST_DIR,port=Number(process.env.PORT||3000);
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".wasm":"application/wasm",".glb":"model/gltf-binary"};
http.createServer((req,res)=>{try{const u=new URL(req.url,"http://x");let p=path.normalize(path.join(root,decodeURIComponent(u.pathname)));if(p!==root&&!p.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}try{if(fs.statSync(p).isDirectory())p=path.join(p,"index.html");}catch(e){p=path.join(root,"index.html");}res.writeHead(200,{"Content-Type":mime[path.extname(p)]||"application/octet-stream","Cache-Control":"no-cache"});fs.createReadStream(p).pipe(res);}catch(e){res.writeHead(404);res.end("Not found");}}).listen(port,"0.0.0.0",()=>console.log("listening "+port));
'
