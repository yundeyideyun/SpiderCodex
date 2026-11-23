param([switch]$VerifyOnly)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$lock=Get-Content -LiteralPath (Join-Path $root 'dependencies.lock.json') -Raw|ConvertFrom-Json
$missing=@($lock.files|Where-Object{ $file=Join-Path $root $_.file;!(Test-Path -LiteralPath $file) -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $_.sha256 })
if(!$missing.Count){Write-Output 'Pinned SDK files verified.';return}
if($VerifyOnly){throw ('Pinned SDK files missing or changed: '+($missing.file -join ', '))}
$expected='https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/'+$lock.version+'/microsoft.web.webview2.'+$lock.version+'.nupkg'
if($lock.source -cne $expected){throw 'Unexpected SDK source in dependency lock'}
$temporary=Join-Path ([IO.Path]::GetTempPath()) ('SpiderCodex-WebView2-'+[guid]::NewGuid()+'.nupkg')
try{
 Invoke-WebRequest -Uri $lock.source -OutFile $temporary -UseBasicParsing
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $archive=[IO.Compression.ZipFile]::OpenRead($temporary)
 try{
  # Extract only locked entries into temporary files. Never expand an arbitrary archive path.
  foreach($record in $lock.files){
   if($record.file -notin @('Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','WebView2Loader.dll')){throw 'Unexpected locked filename'}
   $entry=$archive.GetEntry($record.entry)
   if(!$entry){throw ('SDK entry missing: '+$record.entry)}
   $target=Join-Path $root $record.file
   $staged=$target+'.dependency-'+[guid]::NewGuid()+'.tmp'
   try{
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$staged,$false)
    if((Get-FileHash -LiteralPath $staged -Algorithm SHA256).Hash -ne $record.sha256){throw ('SDK SHA256 mismatch: '+$record.file)}
    Move-Item -LiteralPath $staged -Destination $target -Force
   }finally{if(Test-Path -LiteralPath $staged){Remove-Item -LiteralPath $staged}}
  }
 }finally{$archive.Dispose()}
}finally{if(Test-Path -LiteralPath $temporary){Remove-Item -LiteralPath $temporary}}
Write-Output 'Pinned SDK restored and verified; no runtime or system settings were installed.'
