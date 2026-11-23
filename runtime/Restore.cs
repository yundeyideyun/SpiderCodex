using System;using System.Diagnostics;using System.IO;using System.Threading;using System.Text;using System.Text.RegularExpressions;
using System.Collections.Generic;
class Restore{
 static bool HasClient(){foreach(var p in Process.GetProcessesByName("ChatGPT"))using(p){try{if(p.MainModule.FileName.IndexOf("\\WindowsApps\\OpenAI.Codex_",StringComparison.OrdinalIgnoreCase)>=0)return true;}catch{return true;}}return false;}
 static void RestoreNativeOffline(){
  if(HasClient())return;
  foreach(string path in Directory.GetFiles(Spider.State,"appearance-native-*.json"))try{
   string backupName=Path.GetFileName(path);if(!Regex.IsMatch(backupName,@"^appearance-native-\d{4,5}\.json$"))continue;var data=Spider.Read(backupName);object active,original;if(!data.TryGetValue("active",out active)||!(bool)active||!data.TryGetValue("original",out original))continue;
   string mode=(string)original;if(mode!="light"&&mode!="dark"&&mode!="system")continue;
   string home=Environment.GetEnvironmentVariable("CODEX_HOME");if(string.IsNullOrWhiteSpace(home))home=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),".codex");string expected=Path.GetFullPath(Path.Combine(home,"config.toml"));object recorded;string file=data.TryGetValue("configPath",out recorded)?Path.GetFullPath((string)recorded):expected;
   if(!string.Equals(file,expected,StringComparison.OrdinalIgnoreCase)||!File.Exists(file))continue;
   string text=File.ReadAllText(file);var section=Regex.Match(text,@"(?m)^\[desktop\][ \t]*\r?$");if(!section.Success)continue;int start=section.Index+section.Length;var next=Regex.Match(text.Substring(start),@"(?m)^\[");int end=next.Success?start+next.Index:text.Length;
   var match=Regex.Match(text.Substring(start,end-start),@"(?m)^[ \t]*appearanceTheme[ \t]*=[ \t]*""(dark|light|system)""");if(!match.Success)continue;
   if(match.Groups[1].Value!="dark"){data["active"]=false;Spider.Write(backupName,data);continue;}
   int at=start+match.Groups[1].Index;string changed=text.Substring(0,at)+mode+text.Substring(at+match.Groups[1].Length);
   byte[] prefix=new byte[3];bool bom=false;using(var stream=File.OpenRead(file)){bom=stream.Read(prefix,0,3)==3&&prefix[0]==239&&prefix[1]==187&&prefix[2]==191;}
   if(HasClient()||File.ReadAllText(file)!=text)throw new Exception("Native appearance config changed concurrently; skipped restoration.");
   string temporary=file+".spider-appearance-"+Process.GetCurrentProcess().Id+".tmp";
   try{File.WriteAllText(temporary,changed,new UTF8Encoding(bom));File.Replace(temporary,file,null);}finally{if(File.Exists(temporary))File.Delete(temporary);}
   data["active"]=false;data["restoredOffline"]=true;Spider.Write(backupName,data);Spider.Write("appearance-restore.json",new{restored=true,offline=true,appearance=mode,changedKey="desktop.appearanceTheme",otherSettingsPreserved=true});
  }catch(Exception error){Spider.Log("restore",error.ToString());Spider.Write("appearance-restore.json",new{restored=false,error=error.Message});}
 }
 static bool Signal(string name){
  try{using(var handle=EventWaitHandle.OpenExisting(Spider.Prefix+name)){handle.Set();return true;}}
  catch(WaitHandleCannotBeOpenedException){return false;}
 }
 static int Number(Dictionary<string,object> record,string key){
  object value;int number;
  return record.TryGetValue(key,out value)&&int.TryParse(Convert.ToString(value),out number)?number:0;
 }
 static long Stamp(Dictionary<string,object> record,string key){
  object value;long number;
  return record.TryGetValue(key,out value)&&long.TryParse(Convert.ToString(value),out number)?number:0;
 }
 static bool Matches(Dictionary<string,object> record,string key,string text){
  object value;
  return record.TryGetValue(key,out value)&&String.Equals(Convert.ToString(value),text,StringComparison.Ordinal);
 }
 static Process BoundClient(string suffix,string profile,int requestedPort,out int port){
  var binding=Spider.Read("attachment"+suffix+".json");
  if(binding.Count==0&&profile==""){
   // Migrate the previous release only when the live launcher still owns
   // the tagged primary HWND and the target is its actual loopback client.
   var previous=Spider.Read("session.json");
   int monitor=Number(previous,"pid");
   port=Number(previous,"port");
   IntPtr window=new IntPtr(Stamp(previous,"window"));
   int listener=port>=1024&&port<=65535?Native.LoopbackListener(port):0;
   if(!Matches(previous,"status","visible")||monitor<=0||listener<=0||!Native.IsWindow(window)||
      Native.GetProp(window,"SpiderCodex.PrimaryWindow.v3")!=new IntPtr(monitor))return null;
   uint owner;Native.GetWindowThreadProcessId(window,out owner);
   if(owner!=listener)return null;
   try{
    using(var launcher=Process.GetProcessById(monitor)){
     if(launcher.ProcessName!="SpiderCodex"||launcher.SessionId!=Process.GetCurrentProcess().SessionId)return null;
    }
    var old=Process.GetProcessById(listener);
    if(Native.IsOfficialClient(old))return old;
    old.Dispose();
   }catch(ArgumentException){}catch(InvalidOperationException){}
   return null;
  }
  port=Number(binding,"port");
  int id=Number(binding,"clientPid");
  if(port<1024||port>65535||id<=0||(requestedPort!=0&&port!=requestedPort)||
     !Matches(binding,"profileKey",Spider.ProfileKey(profile))||Native.LoopbackListener(port)!=id)return null;
  Process client=null;
  try{
   client=Process.GetProcessById(id);
   if(Native.IsOfficialClient(client)&&client.StartTime.ToUniversalTime().Ticks==Stamp(binding,"createdTicks"))return client;
  }catch(ArgumentException){}catch(InvalidOperationException){}
  if(client!=null)client.Dispose();
  return null;
 }
 static bool StopOwnedWallpaper(){
  var state=Spider.Read("wallpaper.json");
  int id=Number(state,"pid");
  if(!Matches(state,"status","running")||id<=0)return true;
  Process process;
  try{process=Process.GetProcessById(id);}catch(ArgumentException){return true;}
  using(process){
   if(process.ProcessName!="DesktopWallpaper"||process.SessionId!=Process.GetCurrentProcess().SessionId)return true;
   string expected=Path.Combine(Spider.Root,"DesktopWallpaper.exe");
   string actual=process.MainModule.FileName;
   if(!String.Equals(actual,expected,StringComparison.OrdinalIgnoreCase)){
    var parent=Directory.GetParent(Spider.Root.TrimEnd(Path.DirectorySeparatorChar));
    if(parent==null||!parent.Name.Equals("releases",StringComparison.OrdinalIgnoreCase)||
       !actual.StartsWith(parent.FullName+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)||
       !Path.GetFileName(actual).Equals("DesktopWallpaper.exe",StringComparison.OrdinalIgnoreCase)||
       !Regex.IsMatch(new FileInfo(actual).Directory.Name,@"^R[0-9]+$"))
     throw new IOException("正在运行的壁纸来自另一处安装。请在对应的安装目录恢复。");
   }
   return Signal("WallpaperStop")&&process.WaitForExit(8000);
  }
 }
 static Dictionary<string,object> RestoreTheme(string profile,int port){
  string node=RuntimeDependencies.ResolveNode(null);
  var info=new ProcessStartInfo(node,Spider.Quote(Path.Combine(Spider.Root,"runtime","connect.mjs"))+" --restore --port "+port){
   UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true
  };
  RuntimeDependencies.IsolateProfile(info,profile);
  var output=new StringBuilder();
  using(var connector=Process.Start(info)){
   connector.OutputDataReceived+=delegate(object sender,DataReceivedEventArgs args){if(args.Data!=null)output.AppendLine(args.Data);};
   connector.ErrorDataReceived+=delegate{};
   connector.BeginOutputReadLine();
   connector.BeginErrorReadLine();
   if(!connector.WaitForExit(25000))throw new IOException("恢复皮肤超过等待时间。");
   connector.WaitForExit();
   if(connector.ExitCode!=0)throw new IOException("原生客户端没有确认皮肤已还原。");
  }
  var result=Spider.Json.Deserialize<Dictionary<string,object>>(output.ToString());
  object restored;
  if(result==null||!result.TryGetValue("restored",out restored)||!Convert.ToBoolean(restored))
   throw new IOException("没有收到恢复确认。");
  return result;
 }
 [STAThread]static void Main(string[] args){
  Spider.Init();
  if(Array.IndexOf(args,"--native-appearance-only")>=0){RestoreNativeOffline();return;}
  string profile=Spider.Arg(args,"--profile","");
  string suffix=profile==""?"":".qa";
  string reportName="restore-result"+suffix+".json";
  int requested=0,port=0;
  try{
   if(profile!=""&&(!int.TryParse(Spider.Arg(args,"--port",""),out requested)||requested<1024||requested>65535))
    throw new ArgumentException("独立恢复需要明确指定测试端口。");
   using(var client=BoundClient(suffix,profile,requested,out port)){
    if(profile!=""&&client==null)throw new IOException("测试配置与当前附着记录不一致。");
    object theme=null;
    if(client!=null){
     Signal("SuspendTheme"+suffix);
     // Confirm ownership again immediately before talking to the renderer.
     if(client.HasExited||Native.LoopbackListener(port)!=client.Id)throw new IOException("恢复前客户端发生切换。");
     theme=RestoreTheme(profile,port);
    }else if(profile=="")RestoreNativeOffline();
    var session=Spider.Read("session"+suffix+".json");
    var request=Spider.Read("boot-request.json");
    if(Matches(session,"status","starting")&&Matches(request,"suffix",suffix)&&
       Number(session,"pid")>0&&Number(session,"pid")==Number(request,"ownerPid"))
     Signal("CancelBoot"+suffix);
    bool wallpaperStopped=profile==""&&StopOwnedWallpaper();
    if(profile==""&&!wallpaperStopped)throw new IOException("动态壁纸没有在等待时间内退出。");
    Spider.Write(reportName,new{status="restored",nativeStatus=client==null?"no-verified-attachment":"confirmed",wallpaperStopped,theme,
     wallpaperScope=profile==""?"daily-desktop":"shared-desktop-preserved",qa=profile!="",port,officialClientTerminated=false,at=DateTime.UtcNow.ToString("o")});
   }
  }catch(Exception error){
   Spider.Log("restore",error.Message);
   Spider.Write(reportName,new{status="incomplete",error=error.Message,qa=profile!="",port,officialClientTerminated=false,at=DateTime.UtcNow.ToString("o")});
   Environment.ExitCode=1;
  }
 }
}
