param([switch]$Sim)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = Get-Location }
Set-Location $root
function Step($name, [scriptblock]$b) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  & $b
  $sw.Stop()
  Write-Host ("[süre] {0}: {1:N1} sn" -f $name, $sw.Elapsed.TotalSeconds)
}
$tikuser = $env:TIKTOK_USER
if (-not $tikuser -and (Test-Path "$root\bridge\.env")) {
  $m = Select-String -Path "$root\bridge\.env" -Pattern '^\s*TIKTOK_USER\s*=\s*(.+)' | Select-Object -First 1
  if ($m) { $tikuser = $m.Matches[0].Groups[1].Value.Trim() }
}
if (-not $tikuser -and -not $Sim) {
  $tikuser = Read-Host 'TikTok kullanici adin (@ olmadan, bos birakirsan son kullanilan)'
  if ($tikuser) {
    if (-not (Test-Path "$root\bridge\.env")) { Copy-Item "$root\bridge\.env.example" "$root\bridge\.env" }
    $env:TIKTOK_USER = $tikuser
    (Get-Content "$root\bridge\.env") -replace '^(TIKTOK_USER\s*=).*', "`$1$tikuser" | Set-Content "$root\bridge\.env"
  }
}
Step 'Node kontrol' { node --version }
Step 'Bridge bagimlilik' { Push-Location "$root\bridge"; npm install --no-audit --no-fund; Pop-Location }
Step 'TTS bagimlilik (mock calisir, gercek ses icin pip)' {
  if (Get-Command python -ErrorAction SilentlyContinue) { python --version }
  if (Test-Path "$root\tts\requirements.txt") { Write-Host 'Gercek Chatterbox sesi icin: pip install -r tts/requirements.txt (ilk sefer ~2GB model)' }
}
$tts = Start-Process python -ArgumentList "`"$root\tts\server.py`"" -PassThru -WindowStyle Minimized
$env:TTS_PORT = '5002'
Step 'Three.js yerli kopya' { node -e "fetch('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js').then(r=>r.arrayBuffer()).then(b=>{require('fs').mkdirSync('game/vendor',{recursive:true});require('fs').writeFileSync('game/vendor/three.module.js',Buffer.from(b));console.log('Three.js hazir')}).catch(e=>console.log('CDN sonraya birakildi'))" }
Write-Host '== Kapadokya PRO basliyor ==  TTS: Chatterbox (:5002)'
if ($Sim) { node "$root\bridge\server.js" --sim } else { node "$root\bridge\server.js" }
if ($tts -and -not $tts.HasExited) { Stop-Process -Id $tts.Id -Force }
