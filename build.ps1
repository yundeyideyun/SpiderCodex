param([string]$OutputDirectory=$PSScriptRoot,[string]$IconPath)
$ErrorActionPreference='Stop'
$projectDir=$PSScriptRoot
$output=[IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $output -Force | Out-Null
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$manifest=Join-Path $projectDir 'runtime\native.manifest'
if(!(Test-Path -LiteralPath $compiler)){throw 'Windows .NET Framework 4 compiler not found.'}
$match=[regex]::Match((Get-Content -LiteralPath (Join-Path $projectDir 'runtime\Common.cs') -Raw),'AssemblyInformationalVersion\("([^"]+)"\)')
if(!$match.Success){throw 'Build version missing from Common.cs'}
$version=$match.Groups[1].Value
$icon=if($IconPath){[IO.Path]::GetFullPath($IconPath)}else{Join-Path $projectDir 'assets\spider-knot.ico'}
$core=@('/nologo','/target:winexe',('/win32manifest:'+$manifest),'/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.Web.Extensions.dll')
$units=@(
 @{name='SpiderCodex.exe';sources=@('Common.cs','ReleasePointer.cs','StartupWindowGuard.cs','InstalledClient.cs','RuntimeDependencies.cs','Diagnostics.cs','DailyLauncher.cs');extra=@('/r:System.Management.dll');icon=$true},
 @{name='DesktopBoot.exe';sources=@('Common.cs','BootController.cs');extra=@();icon=$false},
 @{name='DesktopWallpaper.exe';sources=@('Common.cs','DesktopWallpaper.cs');extra=@('/platform:x64','/r:Accessibility.dll',('/r:'+(Join-Path $projectDir 'Microsoft.Web.WebView2.Core.dll')),('/r:'+(Join-Path $projectDir 'Microsoft.Web.WebView2.WinForms.dll')));icon=$false},
 @{name='恢复原界面和桌面.exe';sources=@('Common.cs','RuntimeDependencies.cs','Restore.cs');extra=@();icon=$true},
 @{name='ResizeCompanion.exe';sources=@('Common.cs','ResizePreview.cs','ResizeCompanion.cs');extra=@('/r:System.Management.dll');icon=$false},
 @{name='安装 Spider Codex.exe';sources=@('Common.cs','ReleaseSelection.cs','InstalledClient.cs','RuntimeDependencies.cs','Diagnostics.cs','ReleasePointer.cs','UserSetup.cs','SetupWindow.cs');extra=@('/main:SetupWindow','/r:Microsoft.CSharp.dll');icon=$true},
 @{name='版本管理.exe';sources=@('Common.cs','ReleaseSelection.cs');extra=@();icon=$true},
 @{name='SpiderCodex.Start.exe';sources=@('Common.cs','ReleasePointer.cs','Bootstrap.cs');extra=@();icon=$true}
)
foreach($unit in $units){
 $arguments=$core+@('/out:'+(Join-Path $output $unit.name))+$unit.extra
 if($unit.icon -and (Test-Path -LiteralPath $icon)){$arguments+=('/win32icon:'+$icon)}
 $arguments+=@($unit.sources|ForEach-Object{Join-Path $projectDir ('runtime\'+$_)})
 & $compiler @arguments
 if($LASTEXITCODE -ne 0){throw ('Compilation failed: '+$unit.name)}
}
foreach($dependency in @('Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','WebView2Loader.dll')){
 $source=Join-Path $projectDir $dependency
 if(!(Test-Path -LiteralPath $source)){throw ('Missing pinned build dependency: '+$dependency+'. See docs\BUILD.md.')}
 $target=Join-Path $output $dependency
 if(![string]::Equals([IO.Path]::GetFullPath($source),$target,[StringComparison]::OrdinalIgnoreCase)){Copy-Item -LiteralPath $source -Destination $target -Force}
}
$programs=@($units|ForEach-Object{
 $file=Join-Path $output $_.name
 $info=[Diagnostics.FileVersionInfo]::GetVersionInfo($file)
 if($info.ProductVersion -ne $version){throw ('Compiled version mismatch: '+$_.name)}
 [ordered]@{name=$_.name;sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash;version=$info.ProductVersion}
})
$sources=@(Get-ChildItem -LiteralPath (Join-Path $projectDir 'runtime') -File|Where-Object{$_.Extension -in '.cs','.mjs','.js','.manifest' -and $_.Name -notin 'DesktopBoot.cs','Effects.cs','FaceReference.cs','WebReference.cs'}|Sort-Object Name|ForEach-Object{[ordered]@{name=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}})
[ordered]@{revision=$version;builtUtc=[DateTime]::UtcNow.ToString('o');compiler='Windows .NET Framework 4 C#';byteDeterministic=$false;programs=$programs;sources=$sources}|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $output 'build-verification.json') -Encoding utf8
Write-Output ('Built '+$version+' to '+$output)

