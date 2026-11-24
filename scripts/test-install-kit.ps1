param([Parameter(Mandatory)][string]$OlderRelease,[Parameter(Mandatory)][string]$NewRelease,[Parameter(Mandatory)][string]$Results,[switch]$WithoutDesktopRuntime,[switch]$BackendOnly)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$resultsRoot=[IO.Path]::GetFullPath($Results)
New-Item -ItemType Directory -Path $resultsRoot -Force|Out-Null
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$testPrograms=if($BackendOnly){@('SetupIntegration')}else{@('SetupIntegration','SetupWindowIntegration')}
foreach($main in $testPrograms){
 $binary=Join-Path $resultsRoot ($main+'.exe')
 $sources=@('runtime\Common.cs','runtime\InstalledClient.cs','runtime\RuntimeDependencies.cs','runtime\Diagnostics.cs','runtime\UserSetup.cs','runtime\ClientShutdown.cs','runtime\CompatibilityRepair.cs','runtime\ReleaseSelection.cs','runtime\ReleasePointer.cs','runtime\SetupWindow.cs',('tests\'+$main+'.cs'))|ForEach-Object {Join-Path $root $_}
 & $compiler /nologo /target:exe ('/main:'+$main) /r:Microsoft.CSharp.dll /r:System.Web.Extensions.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll ('/out:'+$binary) @sources
 if($LASTEXITCODE -ne 0){throw 'Test compilation failed'}
 $fixture=Join-Path $resultsRoot ('fixture-'+[guid]::NewGuid().ToString('N'))
 $inputPaths=if($main -eq 'SetupIntegration'){@($OlderRelease,$NewRelease,$fixture)}else{@($fixture,$NewRelease)}
 $priorBrowserFolder=$env:WEBVIEW2_BROWSER_EXECUTABLE_FOLDER
 try{
  if($WithoutDesktopRuntime){
   $env:WEBVIEW2_BROWSER_EXECUTABLE_FOLDER=Join-Path $resultsRoot 'absent-webview-runtime'
   if($main -eq 'SetupWindowIntegration'){$inputPaths+='--expect-desktop-warning'}
  }
  & $binary @inputPaths |Tee-Object -FilePath (Join-Path $resultsRoot ($main+'.json'))
  if($LASTEXITCODE -ne 0){throw $main}
 }finally{$env:WEBVIEW2_BROWSER_EXECUTABLE_FOLDER=$priorBrowserFolder}
}
