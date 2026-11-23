param([Parameter(Mandatory)][string]$Destination)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$target=[IO.Path]::GetFullPath($Destination)
if(Test-Path -LiteralPath $target){throw 'Source export destination must be new.'}
New-Item -ItemType Directory -Path $target | Out-Null
foreach($dir in @('runtime','scripts','tests','docs','third-party')){New-Item -ItemType Directory -Path (Join-Path $target $dir)|Out-Null}
foreach($file in @('README.md','package.json','build.ps1','dependencies.lock.json','.gitignore','需求与验收清单.json','需求与验收清单.md')){Copy-Item -LiteralPath (Join-Path $root $file) -Destination $target}
$obsolete=@('DesktopBoot.cs','Effects.cs','FaceReference.cs','WebReference.cs')
Get-ChildItem -LiteralPath (Join-Path $root 'runtime') -File|Where-Object{$_.Name -notin $obsolete -and $_.Extension -in '.cs','.mjs','.js','.manifest'}|Copy-Item -Destination (Join-Path $target 'runtime')
foreach($dir in @('scripts','tests','docs','third-party')){Get-ChildItem -LiteralPath (Join-Path $root $dir) -File|Where-Object{$_.Extension -in '.ps1','.cs','.mjs','.md','.txt','.json','.html'}|Copy-Item -Destination (Join-Path $target $dir)}
foreach($dir in @('assets','assets\v5','assets\v6')){New-Item -ItemType Directory -Path (Join-Path $target $dir) -Force|Out-Null}
foreach($file in @('desktop-v8.html','v6\visual.js','v6\alpha-video.js','v6\scene-geometry.mjs','v6\red-collapse.json','v5\reference-ui.json','v5\rings-source.json')){Copy-Item -LiteralPath (Join-Path $root ('assets\'+$file)) -Destination (Join-Path $target ('assets\'+$file))}
# Explicit allowlists above exclude caches, profiles, screenshots, recorded chats,
# copied official app code, binaries and copyrighted reference media.
$files=@(Get-ChildItem -LiteralPath $target -Recurse -File|Sort-Object FullName|ForEach-Object{[ordered]@{path=$_.FullName.Substring($target.TrimEnd('\').Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}})
[ordered]@{schemaVersion=1;kind='unpublished-source-review';codeLicenseSelected=$false;referenceMediaIncluded=$false;officialClientCodeIncluded=$false;profilesIncluded=$false;files=$files}|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $target 'source-manifest.json') -Encoding utf8
& (Join-Path $PSScriptRoot 'audit-package.ps1') -Directory $target -Kind Source | Out-Null
if($LASTEXITCODE -ne 0){throw 'Source export privacy audit failed'}
Write-Output $target
