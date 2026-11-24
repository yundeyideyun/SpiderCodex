using System;using System.IO;using System.Text;using System.Diagnostics;using System.Collections.Generic;using System.Web.Script.Serialization;
using System.Xml;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
internal sealed class InstalledClient {
 const string OfficialFamily="OpenAI.Codex_2p2nqsd0c76g0";
 // Review both the registered entry and the actual interface before qualifying a version.
 static readonly HashSet<string> ReviewedVersions=new HashSet<string>(StringComparer.Ordinal){
  "26.1111.2228.0",
  "26.1117.3838.0",
  "26.1117.4957.0"
 };
 // These packages passed a real cold start, intro handoff and unauthenticated
 // theme check. The renderer still gates every individual supported surface.
 static readonly HashSet<string> StartupVerifiedVersions=new HashSet<string>(StringComparer.Ordinal){
  "26.1120.5083.0"
 };
 internal string Executable,InstallDirectory,PackageFamily,ApplicationId,Version,NativeAppId,CompatibilityReason;
 internal bool StartupOnlyVerified;
 internal bool CanTryAdaptiveTheme;
 internal bool ThemeCompatible {get{return CompatibilityReason==null;}}

 [ComImport,Guid("2e941141-7f97-4756-ba1d-9decde894a3d"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IApplicationActivationManager {
  [PreserveSig] int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appId,
      [MarshalAs(UnmanagedType.LPWStr)] string arguments,uint options,out uint processId);
 }

 internal static InstalledClient Assess(string family,string version,string directory,IEnumerable<string> registeredApps,InstalledClient protocolEntry){
  if(!String.Equals(family,OfficialFamily,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("无法确认官方 Codex 安装包身份。");
  var result=protocolEntry??new InstalledClient{InstallDirectory=directory};
  result.PackageFamily=family;
  result.Version=version;
  result.NativeAppId=null;
  result.CompatibilityReason=null;
  result.StartupOnlyVerified=StartupVerifiedVersions.Contains(version)&&!ReviewedVersions.Contains(version);
  var prefix=family+"!";
  var valid=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  foreach(var id in registeredApps)if(id!=null&&id.StartsWith(prefix,StringComparison.OrdinalIgnoreCase)&&Regex.IsMatch(id.Substring(prefix.Length),@"\A[A-Za-z0-9][A-Za-z0-9.-]{0,63}\z"))valid.Add(id);
  var preferred=prefix+result.ApplicationId;
  if(result.ApplicationId!=null&&valid.Contains(preferred))result.NativeAppId=preferred;
  else if(valid.Count==1)foreach(var id in valid)result.NativeAppId=id;
  if(!ReviewedVersions.Contains(version)&&!result.StartupOnlyVerified)result.CompatibilityReason="official-version-not-reviewed";
  else if(protocolEntry==null)result.CompatibilityReason="official-entry-changed";
  System.Version packageVersion;
  result.CanTryAdaptiveTheme=result.CompatibilityReason=="official-version-not-reviewed"&&protocolEntry!=null&&
   System.Version.TryParse(version,out packageVersion)&&packageVersion>new System.Version("26.1120.5083.0")&&
   String.Equals(result.ApplicationId,"App",StringComparison.OrdinalIgnoreCase)&&
   String.Equals(result.NativeAppId,prefix+result.ApplicationId,StringComparison.OrdinalIgnoreCase)&&
   String.Equals(result.Executable,Path.Combine(directory,"app","ChatGPT.exe"),StringComparison.OrdinalIgnoreCase);
  return result;
 }

 internal int ActivateNative(){
  if(String.IsNullOrEmpty(NativeAppId))throw new InvalidOperationException("此版本的官方开始菜单入口无法唯一确认。请从 Windows 开始菜单打开官方 Codex。");
  var manager=(IApplicationActivationManager)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("45ba127d-10a8-46ea-8ab7-56ea9078943c")));
  try{
   uint pid;
   Marshal.ThrowExceptionForHR(manager.ActivateApplication(NativeAppId,null,0,out pid));
   return checked((int)pid);
  }finally{Marshal.ReleaseComObject(manager);}
 }
 internal static string ValidateExecutable(string directory,string relative){string root=Path.GetFullPath(directory).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;string file=Path.GetFullPath(Path.Combine(root,relative.Replace('/',Path.DirectorySeparatorChar)));if(!file.StartsWith(root,StringComparison.OrdinalIgnoreCase)||!file.EndsWith(".exe",StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("应用入口超出官方安装目录。");return file;}
 internal static InstalledClient Resolve(){
  string shell=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"System32","WindowsPowerShell","v1.0","powershell.exe");
  const string script="[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false);$p=Get-AppxPackage -Name OpenAI.Codex|Sort-Object Version -Descending|Select-Object -First 1;if(-not $p){throw 'Official Codex package not installed'};$prefix=$p.PackageFamilyName+'!';$apps=@(Get-StartApps -ErrorAction SilentlyContinue|Where-Object {$_.AppID -and $_.AppID.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)}|ForEach-Object {$_.AppID});[pscustomobject]@{directory=$p.InstallLocation;family=$p.PackageFamilyName;version=[string]$p.Version;apps=$apps}|ConvertTo-Json -Compress";
  var info=new ProcessStartInfo(shell,"-NoProfile -NonInteractive -Command "+Spider.Quote(script)){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8};
  using(var p=Process.Start(info)){
   var stdout=new StringBuilder();
   p.OutputDataReceived+=delegate(object sender,DataReceivedEventArgs e){if(e.Data!=null)stdout.AppendLine(e.Data);};
   p.ErrorDataReceived+=delegate{};
   p.BeginOutputReadLine();p.BeginErrorReadLine();
   if(!p.WaitForExit(10000)){try{p.Kill();}catch{}throw new InvalidOperationException("读取官方客户端安装信息超时。");}
   p.WaitForExit();
   if(p.ExitCode!=0)throw new InvalidOperationException("无法读取当前用户已安装的官方 Codex 应用入口。");
   var data=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(stdout.ToString().Trim());
   string family=Convert.ToString(data["family"]),directory=Convert.ToString(data["directory"]),version=Convert.ToString(data["version"]);
   if(!String.Equals(family,OfficialFamily,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("无法确认官方 Codex 安装包身份。");
   var apps=new List<string>();
   var entries=data["apps"] as System.Collections.IEnumerable;
   if(entries!=null)foreach(var id in entries)if(id is string)apps.Add((string)id);
   InstalledClient protocolEntry=null;
   // Use the current protocol owner to disambiguate official Start-menu entries.
   // Reading the manifest does not qualify a package for theme attachment.
   try{
    using(var manifest=File.OpenRead(Path.Combine(directory,"AppxManifest.xml")))protocolEntry=FromProtocol(manifest,directory);
    if(!File.Exists(protocolEntry.Executable))protocolEntry=null;
   }catch(InvalidDataException){}catch(IOException){}catch(XmlException){}catch(UnauthorizedAccessException){}catch(InvalidOperationException){}
   return Assess(family,version,directory,apps,protocolEntry);
  }
 }
 // Use the same application that the package declares for Windows codex: links.
 // A package can contain several applications and an execution alias is a separate entry.
 internal static InstalledClient FromProtocol(Stream manifest,string directory) {
  var xml=new XmlDocument {XmlResolver=null};
  using(var reader=XmlReader.Create(manifest,new XmlReaderSettings{DtdProcessing=DtdProcessing.Prohibit,XmlResolver=null}))xml.Load(reader);
  const string path="/*[local-name()='Package']/*[local-name()='Applications']/*[local-name()='Application']/*[local-name()='Extensions']/*[local-name()='Extension' and @Category='windows.protocol']";
  InstalledClient result=null;
  foreach(XmlElement extension in xml.SelectNodes(path)){
   bool handlesCodex=false;
   foreach(XmlNode child in extension.ChildNodes){
    var protocol=child as XmlElement;
    if(protocol!=null && protocol.LocalName=="Protocol" && String.Equals(protocol.GetAttribute("Name"),"codex",StringComparison.OrdinalIgnoreCase))handlesCodex=true;
   }
   if(!handlesCodex)continue;
   if(result!=null)throw new InvalidDataException("官方包声明了多个 codex: 入口。");
   var app=(XmlElement)extension.ParentNode.ParentNode;
   string entry=app.GetAttribute("Executable");
   string overrideEntry=extension.GetAttribute("Executable");
   if(String.IsNullOrWhiteSpace(entry)||String.IsNullOrWhiteSpace(app.GetAttribute("Id")))throw new InvalidDataException("官方协议入口信息不完整。");
   string executable=ValidateExecutable(directory,entry);
   if(overrideEntry!="" && !String.Equals(executable,ValidateExecutable(directory,overrideEntry),StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("此版本的回跳处理程序使用独立可执行文件，需要兼容性复核。");
   result=new InstalledClient{Executable=executable,ApplicationId=app.GetAttribute("Id"),InstallDirectory=directory};
  }
  if(result==null)throw new InvalidDataException("官方包缺少 codex: 协议入口。");
  return result;
 }
 internal object Describe(){return new{executable=Executable,packageFamily=PackageFamily,applicationId=ApplicationId,packageVersion=Version,
  entryKind=ThemeCompatible||CanTryAdaptiveTheme?"registered-package-executable":"registered-native-app",activationProtocol=ThemeCompatible||CanTryAdaptiveTheme?"codex":null,
  appUserModelId=NativeAppId,themeCompatible=ThemeCompatible,compatibilityReason=CompatibilityReason,
  startupOnlyVerified=StartupOnlyVerified,adaptiveThemeEligible=CanTryAdaptiveTheme,usesDeprecatedAlias=false};}
}
