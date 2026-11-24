using System;using System.IO;using System.Diagnostics;using System.Collections.Generic;
class NativeContracts{
 [STAThread]static void Main(string[] args){
  if(args.Length>1&&args[0]=="--child"){var data=new string[args.Length-2];Array.Copy(args,2,data,0,data.Length);File.WriteAllText(args[1],Spider.Json.Serialize(data));return;}
  string output=Path.Combine(Path.GetTempPath(),"spider-contract-"+Guid.NewGuid()+".json");
  var samples=new[]{"","plain","a b","中文 空格","C:\\A B\\","a\"b","\\\\server\\share\\","a\\\"b","ends\\\\","line\nbreak"};
  string command="--child "+Spider.Quote(output);foreach(string sample in samples)command+=" "+Spider.Quote(sample);
  using(var child=Process.Start(new ProcessStartInfo(Process.GetCurrentProcess().MainModule.FileName,command){UseShellExecute=false,CreateNoWindow=true})){if(!child.WaitForExit(5000)||child.ExitCode!=0)throw new Exception("Argument fixture failed");}
  try{var actual=Spider.Json.Deserialize<string[]>(File.ReadAllText(output));if(actual.Length!=samples.Length)throw new Exception("Argument count changed");for(int i=0;i<samples.Length;i++)if(actual[i]!=samples[i])throw new Exception("Argument changed at "+i);}finally{if(File.Exists(output))File.Delete(output);}
  foreach(string url in new[]{"app://-/index.html","app://-/index.html#home","app://-/index.html?workspace=team#settings"})if(!Spider.IsMainPageUrl(url))throw new Exception("App route rejected: "+url);
  foreach(string url in new[]{"https://auth.openai.com/index.html","app://elsewhere/index.html","app://-:9999/index.html","app://user@-/index.html","app://-/index.html#AVATAR-OVERLAY","app://-/detached-window.html"})if(Spider.IsMainPageUrl(url))throw new Exception("Unrelated page accepted");
  string root=Path.GetTempPath();InstalledClient.ValidateExecutable(root,"app\\ChatGPT.exe");
  foreach(string relative in new[]{"..\\outside.exe","app\\file.txt"}){bool rejected=false;try{InstalledClient.ValidateExecutable(root,relative);}catch(InvalidOperationException){rejected=true;}if(!rejected)throw new Exception("Invalid package entry accepted");}
  const string protocol="<Extension Category='windows.protocol'><Protocol Name='codex'/></Extension>";
  string declaration="<Package><Applications><Application Id='Decoy' Executable='ignored.exe'/><Application Id='Shell' Executable='app/ChatGPT.exe'><Extensions>"+protocol+"</Extensions></Application></Applications></Package>";
  using(var stream=new MemoryStream(System.Text.Encoding.UTF8.GetBytes(declaration))){
   var owner=InstalledClient.FromProtocol(stream,root);
   if(owner.ApplicationId!="Shell"||owner.Executable!=Path.Combine(root,"app","ChatGPT.exe"))throw new Exception("Protocol owner mismatch");
  }
  foreach(string broken in new[]{declaration.Replace(protocol,""),declaration.Replace(protocol,protocol+protocol),declaration.Replace("Category='windows.protocol'","Category='windows.protocol' Executable='separate.exe'")}){
   bool refused=false;
   using(var stream=new MemoryStream(System.Text.Encoding.UTF8.GetBytes(broken)))try{InstalledClient.FromProtocol(stream,root);}catch(InvalidDataException){refused=true;}
   if(!refused)throw new Exception("Unsupported activation layout accepted");
  }
  const string family="OpenAI.Codex_2p2nqsd0c76g0",reviewed="26.1111.2228.0";
  var nativeApp=family+"!Shell";
  var foreignApp="Unrelated.Package!Shell";
  using(var stream=new MemoryStream(System.Text.Encoding.UTF8.GetBytes(declaration))){
   var registered=InstalledClient.FromProtocol(stream,root);
   var known=InstalledClient.Assess(family,reviewed,root,new[]{nativeApp,foreignApp},registered);
   if(!known.ThemeCompatible||known.NativeAppId!=nativeApp)throw new Exception("Reviewed version lost its entry");
   var verifiedUpdate=InstalledClient.Assess(family,"26.1117.3838.0",root,new[]{nativeApp,family+"!Companion",foreignApp},registered);
   if(!verifiedUpdate.ThemeCompatible||verifiedUpdate.NativeAppId!=nativeApp)throw new Exception("Verified update lost its protocol owner");
   var currentUpdate=InstalledClient.Assess(family,"26.1117.4957.0",root,new[]{nativeApp,family+"!Companion",foreignApp},registered);
   if(!currentUpdate.ThemeCompatible||currentUpdate.NativeAppId!=nativeApp)throw new Exception("Current official update lost its protocol owner");
   var startupUpdate=InstalledClient.Assess(family,"26.1120.5083.0",root,new[]{nativeApp},registered);
   if(!startupUpdate.ThemeCompatible||!startupUpdate.StartupOnlyVerified)
       throw new InvalidOperationException("Startup-verified package did not retain its limited review status");
   var nextUpdate=InstalledClient.Assess(family,"26.1120.5084.0",root,new[]{nativeApp},registered);
   if(nextUpdate.ThemeCompatible||nextUpdate.StartupOnlyVerified)
       throw new InvalidOperationException("An unverified successor incorrectly inherited compatibility");
   var unverifiedPatch=InstalledClient.Assess(family,"26.1117.4958.0",root,new[]{nativeApp},registered);
   if(unverifiedPatch.ThemeCompatible)throw new Exception("A different patch version inherited approval");
   var changed=InstalledClient.Assess(family,"99.0.0.0",root,new[]{nativeApp,family+"!Companion",foreignApp},registered);
   if(changed.ThemeCompatible||changed.CompatibilityReason!="official-version-not-reviewed"||changed.NativeAppId!=nativeApp)throw new Exception("Updated client was allowed to mount the theme");
  }
  var changedEntry=InstalledClient.Assess(family,reviewed,root,new[]{nativeApp,foreignApp},null);
  var adaptiveEntry=new InstalledClient{ApplicationId="App",Executable=Path.Combine(root,"app","ChatGPT.exe"),InstallDirectory=root};
  var adaptive=InstalledClient.Assess(family,"26.1120.5084.0",root,new[]{family+"!App"},adaptiveEntry);
  if(!adaptive.CanTryAdaptiveTheme||adaptive.ThemeCompatible)throw new Exception("Unreviewed matching package should only use adaptive theme");
  var changedExecutable=new InstalledClient{ApplicationId="App",Executable=Path.Combine(root,"app","Unknown.exe"),InstallDirectory=root};
  if(InstalledClient.Assess(family,"26.1120.5084.0",root,new[]{family+"!App"},changedExecutable).CanTryAdaptiveTheme)
      throw new Exception("Changed executable incorrectly qualified for adaptive theme");
  if(InstalledClient.Assess(family,"26.1120.5084.0",root,new[]{family+"!Other"},adaptiveEntry).CanTryAdaptiveTheme)
      throw new Exception("A different registered application qualified for adaptive theme");
  if(changedEntry.ThemeCompatible||changedEntry.CompatibilityReason!="official-entry-changed"||changedEntry.NativeAppId!=nativeApp)throw new Exception("Changed registration did not preserve the native entry");
  var ambiguous=InstalledClient.Assess(family,"99.0.0.0",root,new[]{nativeApp,family+"!Other",foreignApp},null);
  var foreignOnly=InstalledClient.Assess(family,"99.0.0.0",root,new[]{foreignApp,family+"!Shell\\invalid"},null);
  if(ambiguous.NativeAppId!=null||foreignOnly.NativeAppId!=null)throw new Exception("Uncertain start menu entries were accepted");
  bool refusedPublisher=false;
  try{InstalledClient.Assess("Impersonating.Package",reviewed,root,new[]{nativeApp},null);}catch(InvalidOperationException){refusedPublisher=true;}
  if(!refusedPublisher)throw new Exception("Unrelated package was accepted");
  var screens=new[]{new System.Drawing.Rectangle(-1920,0,1920,1040),new System.Drawing.Rectangle(0,0,1920,1040)};
  if(Native.CoversAllWorkingAreas(new Native.RECT{Left=0,Top=0,Right=1920,Bottom=1040},screens))throw new Exception("One maximized screen paused visible desktop on another screen");
  if(!Native.CoversAllWorkingAreas(new Native.RECT{Left=-1920,Top=0,Right=1920,Bottom=1040},screens))throw new Exception("Spanning cover was not recognized");
  if(Native.CoversAllWorkingAreas(new Native.RECT(),new System.Drawing.Rectangle[0]))throw new Exception("Empty display set was treated as covered");
  var physical=new System.Drawing.Rectangle(0,0,2560,1440);
  var scaled=new System.Drawing.Rectangle(0,0,2048,1152);
  if(!Native.BootAreasCompatible(physical,1,scaled,1))throw new Exception("125% single-screen coordinates rejected");
  if(!Native.BootAreasCompatible(physical,2,physical,2))throw new Exception("Matching monitor layout rejected");
  if(Native.BootAreasCompatible(physical,2,scaled,2))throw new Exception("Different multi-monitor coordinates accepted");
  if(Native.BootAreasCompatible(physical,1,new System.Drawing.Rectangle(0,0,1920,1200),1))throw new Exception("A changed aspect ratio was accepted as scaling");
  if(Native.BootAreasCompatible(physical,1,physical,2))throw new Exception("A changed monitor count was accepted");
  var occupied=new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback,0);
  try{
   occupied.ExclusiveAddressUse=true;occupied.Start();
   int original=((System.Net.IPEndPoint)occupied.LocalEndpoint).Port;
   int alternate=Native.FindFreeLoopbackPort();
   if(alternate<1024||alternate>65535||alternate==original||Native.LoopbackListener(original)!=Process.GetCurrentProcess().Id)
     throw new Exception("Automatic port selection did not preserve the existing listener");
  }finally{occupied.Stop();}
  Console.WriteLine(Spider.Json.Serialize(new{passed=true,argumentRoundTrips=samples.Length,routeChecks=9,packageEntryChecks=3,protocolOwnerChecks=4,upgradeCompatibilityChecks=11,multiScreenCoverageChecks=3,bootCoordinateChecks=5,occupiedLoopbackPreserved=true}));
 }
}
