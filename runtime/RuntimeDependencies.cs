using System;using System.IO;using System.Text;using System.Diagnostics;using System.Text.RegularExpressions;
internal static class RuntimeDependencies {
 internal static void IsolateProfile(ProcessStartInfo info,string profile){if(string.IsNullOrWhiteSpace(profile))return;string isolated=Path.GetFullPath(profile);info.UseShellExecute=false;info.CreateNoWindow=true;info.EnvironmentVariables["CODEX_ELECTRON_USER_DATA_PATH"]=isolated;info.EnvironmentVariables["CODEX_HOME"]=Path.Combine(isolated,"agent-home");}
 internal static string WebViewRuntimeVersion(string releaseRoot=null){
  try{var assembly=System.Reflection.Assembly.LoadFrom(Path.Combine(releaseRoot??Spider.Root,"Microsoft.Web.WebView2.Core.dll"));var type=assembly.GetType("Microsoft.Web.WebView2.Core.CoreWebView2Environment",true);var method=type.GetMethod("GetAvailableBrowserVersionString",new[]{typeof(string)});string version=(string)method.Invoke(null,new object[]{null});if(string.IsNullOrWhiteSpace(version))throw new InvalidOperationException();return version;}
  catch{throw new InvalidOperationException("动态壁纸与开场需要 Microsoft Edge WebView2 Runtime。可继续使用客户端主题。");}
 }
 internal static string ResolveNode(string requested,string releaseRoot=null) {
  string candidate=requested;
  if(string.IsNullOrWhiteSpace(candidate)){
   string bundled=Path.Combine(releaseRoot??Spider.Root,"tools","node","node.exe");
   if(File.Exists(bundled))candidate=bundled;
   else foreach(string item in (Environment.GetEnvironmentVariable("PATH")??"").Split(Path.PathSeparator)){
    try{string file=Path.Combine(item.Trim().Trim('"'),"node.exe");if(File.Exists(file)){candidate=Path.GetFullPath(file);break;}}catch{}
   }
  }
  if(string.IsNullOrWhiteSpace(candidate)||!File.Exists(candidate))throw new InvalidOperationException("需要 Node.js 22 或更新版本。请安装后重试，或将便携版 node.exe 放到 tools\\node；不会自动修改系统环境。");
  candidate=Path.GetFullPath(candidate);
  var info=new ProcessStartInfo(candidate,"--version"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
  using(var process=Process.Start(info)){
   var output=new StringBuilder();process.OutputDataReceived+=delegate(object sender,DataReceivedEventArgs e){if(e.Data!=null)output.AppendLine(e.Data);};process.ErrorDataReceived+=delegate{};process.BeginOutputReadLine();process.BeginErrorReadLine();
   if(!process.WaitForExit(5000)){try{process.Kill();}catch{}throw new InvalidOperationException("Node.js 启动超时；尚未启动客户端或开场。");}
   process.WaitForExit();var match=Regex.Match(output.ToString().Trim(),@"^v(\d+)\.");int major;
   if(process.ExitCode!=0||!match.Success||!int.TryParse(match.Groups[1].Value,out major)||major<22)throw new InvalidOperationException("需要 Node.js 22 或更新版本；当前运行时不支持本地主题连接。");
  }
  return candidate;
 }
 internal static void ValidateTheme(string releaseRoot=null){
  RequireFiles(releaseRoot,new[]{"runtime/connect.mjs","runtime/theme-keeper.mjs","runtime/target-scope.mjs","runtime/native-appearance.mjs","runtime/spider-theme.js","assets/client-brighter.png"});
 }
 internal static void ValidateDesktop(string releaseRoot=null){
  RequireFiles(releaseRoot,new[]{"DesktopWallpaper.exe","DesktopBoot.exe","Microsoft.Web.WebView2.Core.dll","Microsoft.Web.WebView2.WinForms.dll","WebView2Loader.dll","assets/city.mp4","assets/desktop-v8.html","assets/v6/visual.js","assets/v6/alpha-video.js","assets/v6/scene-geometry.mjs","assets/v6/red-color.mp4","assets/v6/red-collapse.mp4","assets/v6/red-collapse.json","assets/v5/mask-base.png","assets/v5/mask-eyes.png","assets/v5/title-spiderman.png","assets/v5/title-workspace.png","assets/v5/reference-ui.json","assets/v5/web-screen.mp4","assets/v5/shot-screen.mp4","assets/v5/rings.png","assets/v5/rings-source.json"});
  var scenePath=Path.Combine(releaseRoot??Spider.Root,"assets","v5","reference-ui.json");
  var scene=Spider.Json.Deserialize<System.Collections.Generic.Dictionary<string,object>>(File.ReadAllText(scenePath));
  if(scene.ContainsKey("foregroundSilkBox"))RequireFiles(releaseRoot,new[]{"assets/v6/foreground-silk.mp4"});
 }
 internal static void ValidateMedia(string releaseRoot=null){
  ValidateTheme(releaseRoot);ValidateDesktop(releaseRoot);
  RequireFiles(releaseRoot,new[]{"ResizeCompanion.exe"});
 }
 static void RequireFiles(string root,string[] files){
  foreach(string relative in files){
   string file=Path.Combine(root??Spider.Root,relative.Replace('/',Path.DirectorySeparatorChar));
   if(!File.Exists(file)||new FileInfo(file).Length==0)throw new FileNotFoundException("安装内容不完整，缺少 "+relative+"。请重新解压完整安装包；不会关闭现有客户端。",file);
  }
 }
}
