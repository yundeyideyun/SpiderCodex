using System;
using System.Collections.Generic;
internal static class Diagnostics {
 internal static Dictionary<string,object> Check(string releaseRoot){
  var report=new Dictionary<string,object>();
  var issues=new List<string>();
  var warnings=new List<string>();
  report["schemaVersion"]=1;
  report["productVersion"]=Spider.Version;
  report["windowsVersion"]=Environment.OSVersion.Version.ToString();
  report["systemDpi"]=Native.GetDpiForSystem();
  report["monitorCount"]=System.Windows.Forms.Screen.AllScreens.Length;
  if(!Environment.Is64BitOperatingSystem)issues.Add("需要 64 位 Windows。");
  try{
   var client=InstalledClient.Resolve();
   report["officialClient"]=new{installed=true,packageVersion=client.Version,packageFamily=client.PackageFamily,
    entryKind=client.ThemeCompatible?"registered-package-executable":"registered-native-app",
    themeCompatible=client.ThemeCompatible,compatibilityReason=client.CompatibilityReason,nativeEntryAvailable=client.NativeAppId!=null};
   if(!client.ThemeCompatible)warnings.Add("此官方客户端版本或启动入口需要兼容性复核。SpiderCodex 先打开原生客户端。");
  }catch(Exception error){
   issues.Add("请先安装适用于当前 Windows 用户的官方 Codex。"+error.Message);
   report["officialClient"]=new{installed=false,error=error.Message};
  }
  try{RuntimeDependencies.ResolveNode(null,releaseRoot);report["node"]=new{supported=true,minimumMajor=22};}
  catch(Exception error){issues.Add(error.Message);report["node"]=new{supported=false,error=error.Message};}
  try{RuntimeDependencies.ValidateMedia(releaseRoot);report["installationFiles"]=new{present=true};}
  catch(Exception error){issues.Add(error.Message);report["installationFiles"]=new{present=false,error=error.Message};}
  try{
   string version=RuntimeDependencies.WebViewRuntimeVersion(releaseRoot);
   report["webView2Runtime"]=new{installed=true,version=version};
   report["desktopEffectsAvailable"]=true;
  }catch(Exception error){
   warnings.Add(error.Message);
   report["webView2Runtime"]=new{installed=false,error=error.Message};
   report["desktopEffectsAvailable"]=false;
  }
  report["issues"]=issues;
  report["warnings"]=warnings;
  report["preflightPassed"]=issues.Count==0;
  report["fullClientAcceptancePassed"]=false;
  report["uiInputs"]=0;
  report["clientTerminations"]=0;
  report["accountDataRead"]=false;
  report["at"]=DateTime.UtcNow.ToString("o");
  return report;
 }
 internal static string InstallEnvironmentMessage(string releaseRoot){
  // Called after integrity verification and before taking ownership of the install directory.
  var report=Check(releaseRoot);
  var issues=(List<string>)report["issues"];
  if(issues.Count>0)throw new InvalidOperationException("安装前检查发现以下问题。"+Environment.NewLine+Environment.NewLine+String.Join(Environment.NewLine,issues));
  return String.Join(Environment.NewLine,(List<string>)report["warnings"]);
 }
 internal static void RequireInstallReady(string releaseRoot){InstallEnvironmentMessage(releaseRoot);}
 internal static void Run(){Spider.Write("diagnostics.json",Check(Spider.Root));}
}
