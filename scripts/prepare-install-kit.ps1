param([Parameter(Mandatory)][string]$Destination,[string]$ReleaseDirectory,[string]$AssetPackDirectory,[switch]$BundleNode)
$ErrorActionPreference='Stop'
$kit=[IO.Path]::GetFullPath($Destination)
if(Test-Path -LiteralPath $kit){throw 'Choose a new install-kit directory.'}
$payload=Join-Path $kit 'payload'
if($ReleaseDirectory -and ($AssetPackDirectory -or $BundleNode)){throw 'A complete release already specifies its media and runtime.'}
if($ReleaseDirectory){
 $source=[IO.Path]::GetFullPath($ReleaseDirectory).TrimEnd('\')
 if($kit.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Install kit must be outside the source release.'}
 & (Join-Path $PSScriptRoot 'verify-release.ps1') -Directory $source
 New-Item -ItemType Directory -Path $kit|Out-Null
 Copy-Item -LiteralPath $source -Destination $payload -Recurse
}else{
 & (Join-Path $PSScriptRoot 'prepare-release.ps1') -Destination $payload -LocalPreview -AssetPackDirectory $AssetPackDirectory -BundleNode:$BundleNode
}
& (Join-Path $PSScriptRoot 'verify-release.ps1') -Directory $payload
& (Join-Path $PSScriptRoot 'audit-package.ps1') -Directory $payload -Kind Release | Out-Null
if($LASTEXITCODE -ne 0){throw 'Installer payload privacy audit failed'}
$installer='安装 Spider Codex.exe'
Copy-Item -LiteralPath (Join-Path $payload $installer) -Destination (Join-Path $kit $installer)
if((Get-FileHash -LiteralPath (Join-Path $kit $installer)).Hash -ne (Get-FileHash -LiteralPath (Join-Path $payload $installer)).Hash){throw 'Setup entry copy failed verification.'}
$nodeNote=if(Test-Path -LiteralPath (Join-Path $payload 'tools\node\node.exe')){'安装包内已包含便携 Node.js。'}else{'系统还需 Node.js 22 或以上版本。'}
@"
SpiderCodex 本地安装预览版

保持本目录和 payload 文件夹在一起，双击“安装 Spider Codex.exe”。安装程序按当前 Windows 用户安装，需已有官方 Codex。$nodeNote

安装前可点击“检查环境”。WebView2 Runtime 用于动态壁纸和开场，它不可用时仍可安装和使用客户端皮肤。Node 不可用时，已安装的桌面入口可打开原生客户端。

安装前可选“完整体验”（皮肤、壁纸和开场）或“轻量体验”（只启用皮肤）。完成后从同一个桌面 Spider Codex 图标打开。要切换，打开安装程序选择后点“保存体验”，下次完全退出官方客户端并从图标重开时生效。未适配的官方版本会打开原生客户端。

首次启用皮肤时，如果官方 Codex 已经打开，请先完成正在进行的工作，使用官方“文件 → 退出”，再从 Spider Codex 图标打开。直接点击窗口右上角的关闭按钮时，官方客户端可能继续在后台运行。

如果桌面原有同名入口，安装程序保留原入口，请从 %LOCALAPPDATA%\Programs\SpiderCodex\SpiderCodex.exe 打开本次安装。

保留本安装包。升级时从新的安装包运行安装程序。安装目录里的“版本管理.exe”可切换已安装版本，所选版本在完全退出客户端后的下次启动生效。

卸载时，先在安装包中打开“安装 Spider Codex.exe”，点击“恢复原外观”，正常退出客户端，再点击“卸载”。程序保留用户改动过的文件、个人数据和其他软件的快捷方式。

本包供本地测试使用。当前的参考媒体仍待取得公开分发许可。
"@ | Set-Content -LiteralPath (Join-Path $kit '使用说明.txt') -Encoding utf8
Write-Output $kit
