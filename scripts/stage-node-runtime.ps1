param([Parameter(Mandatory)][string]$Destination)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$spec=(Get-Content -LiteralPath (Join-Path $root 'dependencies.lock.json') -Raw|ConvertFrom-Json).optionalNodeRuntime
if($spec.version -notmatch '^\d+\.\d+\.\d+$' -or $spec.platform -ne 'win-x64'){throw 'Unexpected Node lock record'}
$version=$spec.version
$prefix="node-v$version-win-x64"
$url="https://nodejs.org/dist/v$version/$prefix.zip"
if($spec.url -ne $url){throw 'Node source URL does not match the official release'}
$dest=[IO.Path]::GetFullPath($Destination)
if(Test-Path -LiteralPath $dest){throw 'Node destination already exists'}
$scratch=Join-Path ([IO.Path]::GetTempPath()) ('spider-node-'+[guid]::NewGuid().ToString('N')+'.zip')
try{
 Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $scratch -TimeoutSec 50
 if((Get-FileHash -LiteralPath $scratch).Hash -ne $spec.archiveSha256){throw 'Node archive checksum mismatch'}
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $archive=[IO.Compression.ZipFile]::OpenRead($scratch)
 try{
  New-Item -ItemType Directory -Path $dest -Force|Out-Null
  foreach($name in 'node.exe','LICENSE'){
   $entry=$archive.GetEntry("$prefix/$name")
   if(!$entry){throw "Node archive entry is missing: $name"}
   [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,(Join-Path $dest $name),$false)
  }
 }finally{$archive.Dispose()}
 if((Get-FileHash -LiteralPath (Join-Path $dest 'node.exe')).Hash -ne $spec.exeSha256){throw 'Node executable checksum mismatch'}
 [ordered]@{version=$version;source=$url;archiveSha256=$spec.archiveSha256;exeSha256=$spec.exeSha256;license='LICENSE'}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $dest 'runtime-origin.json') -Encoding UTF8
}finally{if(Test-Path -LiteralPath $scratch){Remove-Item -LiteralPath $scratch}}
