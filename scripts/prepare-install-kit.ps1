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
$installer=Join-Path $payload '安装 Spider Codex.exe'
foreach($entry in @('打开 Spider Codex.exe','管理 Spider Codex.exe')){
 $target=Join-Path $kit $entry
 Copy-Item -LiteralPath $installer -Destination $target
 if((Get-FileHash -LiteralPath $target).Hash -ne (Get-FileHash -LiteralPath $installer).Hash){throw 'Setup entry copy failed verification.'}
}
$nodeNote=if(Test-Path -LiteralPath (Join-Path $payload 'tools\node\node.exe')){'安装包内已包含便携 Node.js。'}else{'系统还需 Node.js 22 或以上版本。'}
@"
SpiderCodex 本地安装预览版

完整解压，双击“打开 Spider Codex.exe”。已安装就直接打开。首次使用会询问是否安装，完成后再询问是否打开。电脑需已有官方 Codex。$nodeNote

安装后请从桌面 Spider Codex 图标打开。误开 payload 里的程序时，已有安装会转到已安装的版本；首次使用会提示从外层安装程序开始。

安装会自动检查环境并创建桌面图标。首次打开任一外层入口都会询问是否安装。打开“管理 Spider Codex.exe”，从“设置与卸载”可定位或补建桌面图标。

如果官方更新后聊天页面的皮肤没加载，先从桌面图标打开一次有问题的页面，再到“设置与卸载”点“修复兼容性”。已登录的官方 Codex 会根据本机保存的界面标记提出修复，通过校验后可确认应用或取消。确认后在下次完整启动时生效。失败时原版保留，也可用“撤销兼容修复”退回。本功能只修布局识别。

更换启动效果时，选“皮肤、动态壁纸和蛛丝开场”或“只用客户端皮肤”，再点“应用并打开”。蛛丝开场会在客户端下次完整启动时播放。WebView2 Runtime 不可用时，仍可使用皮肤。官方 Codex 更新后仍用同一个桌面图标。遇到尚未适配的版本，Spider Codex 会打开官方界面，完整体验下动态壁纸独立启动。皮肤和开场需要等适配，重装同一个包无法改变兼容性。

“退出 Codex”请求正常关闭当前 Windows 会话里的官方 Codex、Spider Codex 和它们的关联进程。请先等任务完成并保存草稿。仍有程序等待退出时，管理窗口会保留并显示说明。

首次启用皮肤时，如果官方 Codex 已经打开，请先完成正在进行的工作，使用官方“文件 → 退出”，再从 Spider Codex 图标打开。直接点击窗口右上角的关闭按钮时，官方客户端可能继续在后台运行。

如果桌面上有其他程序占用同名图标，安装会保留原图标并创建“Spider Codex (主题版)”。

“设置与卸载”里可以更换启动效果、更新、切回官方外观或卸载 Spider Codex。“切回官方外观”移除当前主题并恢复 Windows 原来的壁纸，继续保留聊天窗口。“卸载 Spider Codex”会先询问确认，完成后显示结果。它移除 Spider Codex 的安装文件及桌面图标，保留官方 Codex 和个人数据。

本包供本地测试使用。当前的参考媒体仍待取得公开分发许可。
"@ | Set-Content -LiteralPath (Join-Path $kit '使用说明.txt') -Encoding utf8
Write-Output $kit
