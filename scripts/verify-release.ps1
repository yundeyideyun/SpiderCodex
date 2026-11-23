param([Parameter(Mandatory)][string]$Directory)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath($Directory).TrimEnd('\')
$base=Get-Item -LiteralPath $root -Force
if(!$base.PSIsContainer -or ($base.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Release root must be an ordinary directory'}
if(Test-Path -LiteralPath (Join-Path $root 'INCOMPLETE.txt')){throw 'Incomplete packaging marker present'}

# Check each directory before entering it. File hashes alone do not validate its parent.
$actual=@{}
$pending=[Collections.Generic.Stack[string]]::new()
$pending.Push($root)
while($pending.Count -gt 0){
 foreach($entry in Get-ChildItem -LiteralPath $pending.Pop() -Force){
  if($entry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Release contains a redirected file or directory'}
  if($entry.PSIsContainer){$pending.Push($entry.FullName);continue}
  $name=$entry.FullName.Substring($root.Length+1).Replace('\','/')
  if($name -ne 'release-manifest.json'){$actual.Add($name,$entry)}
 }
}
$manifest=Get-Content -LiteralPath (Join-Path $root 'release-manifest.json') -Raw|ConvertFrom-Json
if($manifest.schemaVersion -ne 1 -or @($manifest.files).Count -eq 0){throw 'Invalid release manifest'}
$count=0
foreach($record in $manifest.files){
 $name=([string]$record.path).Replace('\','/')
 if(!$actual.ContainsKey($name) -or $name.Contains(':') -or $name -match '(^|/)\.{1,2}(/|$)'){throw 'Missing, duplicate or invalid path in the release manifest'}
 $file=$actual[$name]
 if($file.Length -ne $record.length -or (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -cne $record.sha256){throw ('Release file changed: '+$name)}
 $actual.Remove($name)
 $count++
}
if($actual.Count){throw 'Release contains untracked files'}
[ordered]@{filesVerified=$count;hashesMatched=$true;ordinaryDirectoryTree=$true;kind=$manifest.kind;publicReleaseApproved=[bool]$manifest.publicReleaseApproved;fullAcceptancePassed=[bool]$manifest.fullAcceptancePassed}|ConvertTo-Json
