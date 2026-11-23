param(
 [Parameter(Mandatory)][string]$Directory,
 [Parameter(Mandatory)][ValidateSet('Release','Source')][string]$Kind
)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath($Directory).TrimEnd('\')
$rootItem=Get-Item -LiteralPath $root -Force
if(!$rootItem.PSIsContainer -or ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Package root must be an ordinary directory'}
$manifestName=if($Kind -eq 'Release'){'release-manifest.json'}else{'source-manifest.json'}
$manifestPath=Join-Path $root $manifestName
if((Get-Item -LiteralPath $manifestPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Package manifest is redirected'}
$manifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
$records=@{}
foreach($record in $manifest.files){$records.Add($record.path,$record)}
$findings=[Collections.Generic.List[object]]::new()
$pending=[Collections.Generic.Stack[string]]::new()
$pending.Push($root)
$scanned=0
$media=0
$mediaExtensions=@('.png','.jpg','.jpeg','.ico','.svg','.mp4','.wav','.webp','.gif')
$releaseMedia=@(
 'assets/city.mp4','assets/client-brighter.png','assets/client-glass-frost.webp','assets/client-glass-clear.webp','assets/spider-knot.ico',
 'assets/v5/mask-base.png','assets/v5/mask-eyes.png','assets/v5/rings.png',
 'assets/v5/shot-screen.mp4','assets/v5/title-spiderman.png','assets/v5/title-workspace.png',
 'assets/v5/web-screen.mp4','assets/v6/red-collapse.mp4','assets/v6/red-color.mp4','assets/v6/foreground-silk.mp4'
)
$textExtensions=@('.cs','.js','.mjs','.html','.css','.md','.txt','.json','.ps1','.manifest')
$credentialPatterns=@(
 '(?i)\b(?:access_token|refresh_token|api[_-]?key|client_secret)["'']?\s*[:=]\s*["''][A-Za-z0-9_-][A-Za-z0-9._-]{23,}',
 '(?i)(?:bearer\s+[A-Za-z0-9._-]{24,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)',
 '(?i)https?://[^\s)"'']+[?&](?:code|access_token|id_token|device_code)=[A-Za-z0-9_-]{8,}'
)
while($pending.Count){
 foreach($entry in Get-ChildItem -LiteralPath $pending.Pop() -Force){
  $name=$entry.FullName.Substring($root.Length+1).Replace('\','/')
  if($entry.Attributes -band [IO.FileAttributes]::ReparsePoint){
   $findings.Add(@{category='redirected-entry';path=$name});continue
  }
  if($entry.PSIsContainer){
   if($entry.Name -match '^(\.git|\.codex|profiles?|Cache|Cookies|Login Data|Local Storage|Sessions|IndexedDB|node_modules)$'){
    $findings.Add(@{category='local-runtime-directory';path=$name});continue
   }
   $pending.Push($entry.FullName);continue
  }
  if($name -eq $manifestName){continue}
  if(!$records.ContainsKey($name)){
   $findings.Add(@{category='undeclared-file';path=$name});continue
  }
  $record=$records[$name]
  $records.Remove($name)
  if((Get-FileHash -LiteralPath $entry.FullName -Algorithm SHA256).Hash -ne $record.sha256){
   $findings.Add(@{category='manifest-hash-mismatch';path=$name});continue
  }
  $extension=$entry.Extension.ToLowerInvariant()
  if($name -match '(?i)(^|/)(\.env($|\.)|auth\.json$|cookies($|\.)|local state$|login data($|\.)|settings\.local)' -or
     $extension -in '.log','.sqlite','.sqlite3','.db','.dmp','.pem','.key','.lnk'){
   $findings.Add(@{category='local-state-or-sensitive-file';path=$name});continue
  }
  if($extension -in $mediaExtensions){
   $media++
   if($Kind -eq 'Release' -and $name -notin $releaseMedia){
    $findings.Add(@{category='media-outside-runtime-allowlist';path=$name});continue
   }
  }
  if($Kind -eq 'Source' -and ($extension -in $mediaExtensions -or $extension -in '.exe','.dll','.pdb','.zip')){
   $findings.Add(@{category='binary-or-media-in-source';path=$name})
  }
  if($extension -in $textExtensions -and $entry.Length -le 2MB){
   $data=Get-Content -LiteralPath $entry.FullName -Raw
   $scanned++
   if($data -match '(?i)(?:[A-Z]:[/\\]{1,2}Users[/\\]|/home/|[/\\]AppData[/\\]Local[/\\]Packages[/\\])[\p{L}\p{N}_.-]+[/\\]'){
    $findings.Add(@{category='machine-specific-path';path=$name})
   }
   foreach($pattern in $credentialPatterns){
    if($data -match $pattern){$findings.Add(@{category='possible-inline-credential';path=$name});break}
   }
  }
 }
}
foreach($name in $records.Keys){$findings.Add(@{category='declared-file-missing';path=$name})}
[ordered]@{
 kind=$Kind;passed=$findings.Count -eq 0;declaredFiles=@($manifest.files).Count
 textFilesScanned=$scanned;mediaFiles=$media;findings=@($findings.ToArray())
 scope='checks package paths, allowed media placement, hashes and selected plaintext patterns without reporting matched content'
 mediaContentsReviewed=$false;redistributionRightsReviewed=$false
}|ConvertTo-Json -Depth 5
if($findings.Count){exit 1}
exit 0
