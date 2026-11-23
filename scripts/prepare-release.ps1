param([Parameter(Mandatory)][string]$Destination,[switch]$LocalPreview,[string]$AssetPackDirectory,[switch]$BundleNode)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$target=[IO.Path]::GetFullPath($Destination)
if(Test-Path -LiteralPath $target){throw 'Release destination must be new; existing releases are preserved.'}
if(!$LocalPreview){throw 'Public release is gated pending full acceptance, a selected code license and distributable media rights. LocalPreview creates only a local review candidate.'}
& (Join-Path $PSScriptRoot 'bootstrap-deps.ps1') -VerifyOnly
if(!$AssetPackDirectory){
 & node (Join-Path $PSScriptRoot 'media-pack.mjs') check (Join-Path $root 'assets')
 if($LASTEXITCODE -ne 0){throw 'Bundled assets did not pass the media check.'}
}
New-Item -ItemType Directory -Path $target | Out-Null
$complete=$false
try{
 $assetTarget=Join-Path $target 'assets'
 if($AssetPackDirectory){
  & node (Join-Path $PSScriptRoot 'media-pack.mjs') import ([IO.Path]::GetFullPath($AssetPackDirectory)) $assetTarget
  if($LASTEXITCODE -ne 0){throw 'Media pack import failed'}
 }
 $build=@{OutputDirectory=$target}
 if($AssetPackDirectory){$build.IconPath=Join-Path $assetTarget 'spider-knot.ico'}
 & (Join-Path $root 'build.ps1') @build
 foreach($subdir in @('runtime','assets','assets\v5','assets\v6','third-party','docs')){New-Item -ItemType Directory -Path (Join-Path $target $subdir) -Force|Out-Null}
 $obsolete=@('DesktopBoot.cs','Effects.cs','FaceReference.cs','WebReference.cs')
 Get-ChildItem -LiteralPath (Join-Path $root 'runtime') -File|Where-Object{$_.Name -notin $obsolete -and $_.Extension -in '.cs','.mjs','.js','.manifest'}|Copy-Item -Destination (Join-Path $target 'runtime')
 $codeAssets=@('desktop-v8.html','v6\visual.js','v6\alpha-video.js','v6\scene-geometry.mjs')
 $mediaAssets=@('city.mp4','client-brighter.png','spider-knot.ico','v5\mask-base.png','v5\mask-eyes.png','v5\title-spiderman.png','v5\title-workspace.png','v5\reference-ui.json','v5\web-screen.mp4','v5\shot-screen.mp4','v5\rings.png','v5\rings-source.json','v6\red-color.mp4','v6\red-collapse.mp4','v6\red-collapse.json')
 $copyAssets=$codeAssets
 if(!$AssetPackDirectory){
  $copyAssets+=$mediaAssets
  $scene=Get-Content -LiteralPath (Join-Path $root 'assets/v5/reference-ui.json') -Raw|ConvertFrom-Json
  if($scene.foregroundSilkBox){$copyAssets+='v6\foreground-silk.mp4'}
  $textures=Join-Path $root 'assets/client-glass-textures.json'
  if(Test-Path -LiteralPath $textures){
   $recipe=Get-Content -LiteralPath $textures -Raw|ConvertFrom-Json
   $original=Join-Path $root 'assets/client-brighter.png'
   if($recipe.version -eq 1 -and $recipe.sourceSha256 -eq (Get-FileHash -LiteralPath $original).Hash){
    $copyAssets+=@('client-glass-textures.json','client-glass-frost.webp','client-glass-clear.webp')
   }
  }
 }
 foreach($file in $copyAssets){
  $asset=Join-Path $root ('assets\'+$file)
  if(!(Test-Path -LiteralPath $asset)){throw ('Media pack incomplete: '+$file)}
  Copy-Item -LiteralPath $asset -Destination (Join-Path $assetTarget $file)
 }
 foreach($file in @('README.md','package.json','dependencies.lock.json','需求与验收清单.json','需求与验收清单.md')){Copy-Item -LiteralPath (Join-Path $root $file) -Destination $target}
 Get-ChildItem -LiteralPath (Join-Path $root 'third-party') -File|Copy-Item -Destination (Join-Path $target 'third-party')
 Get-ChildItem -LiteralPath (Join-Path $root 'docs') -File|Copy-Item -Destination (Join-Path $target 'docs')
 if($BundleNode){& (Join-Path $PSScriptRoot 'stage-node-runtime.ps1') -Destination (Join-Path $target 'tools\node')}
 $records=@(Get-ChildItem -LiteralPath $target -Recurse -File|Sort-Object FullName|ForEach-Object{[ordered]@{path=$_.FullName.Substring($target.TrimEnd('\').Length+1).Replace('\','/');length=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}})
 [ordered]@{schemaVersion=1;kind='local-review-only';publicReleaseApproved=$false;fullAcceptancePassed=$false;files=$records;at=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $target 'release-manifest.json') -Encoding utf8
 & (Join-Path $PSScriptRoot 'audit-package.ps1') -Directory $target -Kind Release | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Release privacy audit failed'}
 $complete=$true
 Write-Output $target
}finally{if(!$complete){Set-Content -LiteralPath (Join-Path $target 'INCOMPLETE.txt') -Value 'Packaging failed. Do not install or treat this directory as a release.' -Encoding utf8}}
