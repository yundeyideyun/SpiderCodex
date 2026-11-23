# 构建

在项目根目录运行 `powershell -NoProfile -File scripts/bootstrap-deps.ps1`，按依赖锁从官方 NuGet 恢复三个 WebView2 SDK 文件；脚本逐个验证 SHA256，不安装运行时、不改系统设置。已经准备好文件时可加 `-VerifyOnly` 离线检查。

运行 `powershell -NoProfile -File build.ps1 -OutputDirectory <新目录>`。使用 Windows 自带 .NET Framework C# 编译器，生成八个程序及构建记录，包括固定入口和版本管理工具。源码中的 AssemblyInformationalVersion 是本地构建版本的唯一来源。无图标资源的源码仍可编译，完整视觉运行需要单独准备媒体包。

这是可重复执行的构建流程；当前旧编译器输出不宣称逐字节确定一致，构建记录明确标记 `byteDeterministic: false`。

`scripts/prepare-release.ps1 -Destination <不存在的新目录> -LocalPreview` 创建仅供本机复核的完整候选包。它不会覆盖旧发行目录、修改桌面入口或启动／关闭客户端。任何失败会留下 INCOMPLETE 标记。发布开关目前保持关闭，完整验收、代码许可和素材分发权限未完成前不生成公开发行标记。

`scripts/export-source.ps1 -Destination <不存在的新目录>` 用明确文件清单导出干净源码，不遍历复制整个开发工作目录。首次构建导出的源码需要恢复 SDK，并自行准备有权使用的媒体包。

本地安装预览包提供按用户安装、升级、回滚和卸载。已在隔离目录测试，暂未在无依赖的干净 Windows 实机上验证。

使用 scripts/prepare-install-kit.ps1 -Destination <新的目录> 创建安装预览包。保留整个解压目录，双击“安装 Spider Codex.exe”安装、升级、恢复外观或卸载。

加上 `-BundleNode` 可把 Windows x64 便携运行时放进安装包。构建脚本从 Node.js 官方资源站取得锁定版本，校验 ZIP 和 node.exe 的 SHA256，并随程序保留官方 LICENSE。打包只复制这两个发行文件和来源记录。

[Node.js 24.22.3 发行目录](https://nodejs.org/dist/v24.22.3/) · [官方文件校验值](https://nodejs.org/dist/v24.22.3/SHASUMS256.txt)
