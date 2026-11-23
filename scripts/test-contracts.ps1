param([string]$OutputDirectory)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
if(!$OutputDirectory){$OutputDirectory=Join-Path $root ('test-results\contracts-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))}
$output=[IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $output -Force|Out-Null
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$reports=@()
foreach($test in @(@{name='StateFileContracts';files=@('runtime\Common.cs','tests\StateFileContracts.cs')},@{name='NativeContracts';files=@('runtime\Common.cs','runtime\InstalledClient.cs','tests\NativeContracts.cs')},@{name='ResizeFrameContracts';files=@('runtime\Common.cs','runtime\ResizePreview.cs','tests\ResizeFrameContracts.cs')},@{name='StartupGuardContracts';files=@('runtime\Common.cs','runtime\StartupWindowGuard.cs','tests\StartupGuardContracts.cs')},@{name='DependencyContracts';files=@('runtime\Common.cs','runtime\RuntimeDependencies.cs','tests\DependencyContracts.cs')},@{name='BootstrapContracts';files=@('runtime\Common.cs','runtime\Bootstrap.cs','runtime\ReleasePointer.cs','tests\BootstrapContracts.cs')})){
 $binary=Join-Path $output ($test.name+'.exe')
 $arguments=@('/nologo','/target:exe',('/main:'+$test.name),'/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.Web.Extensions.dll',('/out:'+$binary))+@($test.files|ForEach-Object{Join-Path $root $_})
 & $compiler @arguments
 if($LASTEXITCODE -ne 0){throw ('Test compilation failed: '+$test.name)}
 $text=& $binary
 if($LASTEXITCODE -ne 0){throw ('Test failed: '+$test.name)}
 $report=$text|ConvertFrom-Json
 if(!$report.passed){throw ('Test did not pass: '+$test.name)}
 $reports+=@{name=$test.name;result=$report}
}
$nodeOutput=& node --test (Join-Path $root 'tests\target-scope.test.mjs') (Join-Path $root 'tests\scene-geometry.test.mjs') (Join-Path $root 'tests\alpha-video.test.mjs') (Join-Path $root 'tests\keeper-payload.test.mjs') (Join-Path $root 'tests\theme-artwork.test.mjs') (Join-Path $root 'tests\native-client-session.test.mjs')
if($LASTEXITCODE -ne 0){throw 'Page scope tests failed'}
$nodeOutput|Set-Content -LiteralPath (Join-Path $output 'node-tests.txt') -Encoding utf8
[ordered]@{passed=$true;native=$reports;nodePageScopePassed=$true;fullClientAcceptancePassed=$false;at=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $output 'result.json') -Encoding utf8
Get-Content -LiteralPath (Join-Path $output 'result.json')
