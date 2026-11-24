using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Management;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

class DailyLauncher {
    static string alias, node, profile="", suffix="";
    static int port;
    static Process boot,themeKeeper,resizeCompanion;
    static StartupWindowGuard startupGuard;
    static HashSet<int> owned=new HashSet<int>();
    static bool launchOwned=false,animationMuted=false;
    static bool fullEffects;
    static bool adaptiveTheme;
    static string officialVersion,layoutRepair;
    static bool restartRequested=false;
    static IntPtr cachedWindow=IntPtr.Zero;
    static uint cachedWindowPid=0;
    const string WindowProperty="SpiderCodex.PrimaryWindow.v3";
    static readonly IntPtr windowToken=new IntPtr(Process.GetCurrentProcess().Id);
    static bool sessionShown=false;
    static string lastConnectionReason;
    static System.Drawing.Rectangle? targetBounds;
    static Dictionary<int,KeyValuePair<long,bool>> profileMatches=new Dictionary<int,KeyValuePair<long,bool>>();
    static readonly int sessionId=Process.GetCurrentProcess().SessionId;
    static string EventName(string name) { return Spider.Prefix+name+suffix; }
    static void ResumeWallpaper() {if(!animationMuted)return;try{using(var e=EventWaitHandle.OpenExisting(Spider.Prefix+"WallpaperResume"))e.Set();}catch{}animationMuted=false;}
    static bool Client(Process p){return Native.IsOfficialClient(p);}
    static void RecordAttachment(){
        int clientId=Native.LoopbackListener(port);
        using(var client=SafeProcess(clientId)){
            if(client==null||!Client(client)||!ClientIds().Contains(clientId))return;
            Spider.Write("attachment"+suffix+".json",new{
                port,clientPid=clientId,createdTicks=client.StartTime.ToUniversalTime().Ticks,
                monitorPid=Process.GetCurrentProcess().Id,profileKey=Spider.ProfileKey(profile)
            });
        }
    }
    static HashSet<int> ClientIds() {
        var all=new HashSet<int>();
        foreach(var p in Process.GetProcessesByName("ChatGPT")) using(p) { if(Client(p)) all.Add(p.Id); }
        var parents=Native.ProcessParents();var ids=new HashSet<int>();
        foreach(int id in all)if(!parents.ContainsKey(id)||!all.Contains(parents[id])) {
            bool matches=false;
            long stamp;
            try{using(var process=Process.GetProcessById(id))stamp=process.StartTime.ToUniversalTime().Ticks;}catch{continue;}
            KeyValuePair<long,bool> saved;
            if(!profileMatches.TryGetValue(id,out saved)||saved.Key!=stamp) {
                try {
                    using(var info=new ManagementObject("Win32_Process.Handle='"+id+"'")) {
                        string command=(string)info["CommandLine"];
                        var match=Regex.Match(command??"","--user-data-dir=(\"[^\"]+\"|[^ ]+)",RegexOptions.IgnoreCase);
                        matches=profile==""?!match.Success:match.Success&&string.Equals(Path.GetFullPath(match.Groups[1].Value.Trim('\"')),Path.GetFullPath(profile),StringComparison.OrdinalIgnoreCase);
                    }
                }catch{matches=false;}
                if(matches)profileMatches[id]=new KeyValuePair<long,bool>(stamp,true);
            }else matches=saved.Value;
            if(matches)ids.Add(id);
        }
        bool changed=true;while(changed){changed=false;foreach(int id in all)if(!ids.Contains(id)&&parents.ContainsKey(id)&&ids.Contains(parents[id])){ids.Add(id);changed=true;}}
        return ids;
    }
    static IntPtr Window() {
        if(cachedWindow!=IntPtr.Zero) {
            uint id;
            if(Native.IsWindow(cachedWindow)) {
                Native.GetWindowThreadProcessId(cachedWindow,out id);
                // A normal close can hide the known main window while the
                // same official process leaves a separate auxiliary window
                // visible. Keep the bound main handle until it is destroyed.
                if(id==cachedWindowPid&&(!launchOwned||owned.Contains((int)id))&&Native.GetProp(cachedWindow,WindowProperty)==windowToken&&Native.Class(cachedWindow)=="Chrome_WidgetWin_1")return cachedWindow;
            }
            cachedWindow=IntPtr.Zero;
        }
        if(!targetBounds.HasValue)return IntPtr.Zero;
        IntPtr found=IntPtr.Zero; long best=long.MinValue;
        Native.EnumWindows(delegate(IntPtr h,IntPtr unused) {
            uint id; Native.GetWindowThreadProcessId(h,out id);
            if(launchOwned && !owned.Contains((int)id)) return true;
            using(var p=SafeProcess((int)id)) {
                if(p==null || !Client(p)) return true;
                if(Native.GetWindow(h,4)!=IntPtr.Zero || Native.Class(h)!="Chrome_WidgetWin_1") return true;
                string title=Native.Title(h); if(title.IndexOf("DevTools",StringComparison.OrdinalIgnoreCase)>=0) return true;
                Native.RECT r; Native.GetWindowRect(h,out r);
                if(r.Right-r.Left<300 || r.Bottom-r.Top<200) return true;
                double scale=Native.GetDpiForSystem()/96.0;var expected=targetBounds.Value;
                // A newly found handle must match geometry read from the
                // verified renderer, even after the initial reveal.
                if(Math.Abs(r.Left/scale-expected.Left)>8||Math.Abs(r.Top/scale-expected.Top)>8||Math.Abs((r.Right-r.Left)/scale-expected.Width)>8||Math.Abs((r.Bottom-r.Top)/scale-expected.Height)>8)return true;
                long score=(long)(r.Right-r.Left)*(r.Bottom-r.Top);
                if(title=="ChatGPT" || title=="Codex") score+=100000000;
                if(sessionShown&&Native.IsWindowVisible(h)&&!Native.IsIconic(h))score+=1000000000;
                if(score>best) { best=score; found=h; }
            }
            return true;
        },IntPtr.Zero);
        if(found!=IntPtr.Zero){if(!Native.SetProp(found,WindowProperty,windowToken))throw new Exception("无法标记真实客户端主窗口。");cachedWindow=found;Native.GetWindowThreadProcessId(found,out cachedWindowPid);if(sessionShown)Spider.Write("session"+suffix+".json",new{status="visible",pid=Process.GetCurrentProcess().Id,window=found.ToInt64(),port=port,owned=launchOwned,adaptiveTheme});}return found;
    }
    static void StartThemeKeeper(){if(adaptiveTheme||themeKeeper!=null&&!themeKeeper.HasExited)return;if(!OwnsConnection())return;if(themeKeeper!=null){themeKeeper.Dispose();themeKeeper=null;}var info=new ProcessStartInfo(node,Spider.Quote(Path.Combine(Spider.Root,"runtime","theme-keeper.mjs"))+" --port "+port+" --owner "+Process.GetCurrentProcess().Id+" --suffix "+Spider.Quote(suffix)){UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=Spider.Root};RuntimeDependencies.IsolateProfile(info,profile);SetLayoutEnvironment(info);themeKeeper=Process.Start(info);}
    static void StartResizeCompanion(){
        if(adaptiveTheme||resizeCompanion!=null&&!resizeCompanion.HasExited)return;
        if(resizeCompanion!=null){resizeCompanion.Dispose();resizeCompanion=null;}
        try{resizeCompanion=Spider.Start(System.IO.Path.Combine(Spider.Root,"ResizeCompanion.exe"),"--owner "+Process.GetCurrentProcess().Id+" --suffix "+Spider.Quote(suffix));}
        catch(Exception e){Spider.Log("resize-preview",e.Message);}
    }
    static void LaunchSessionWallpaper(){if(fullEffects)LaunchWallpaper();}
    static Process SafeProcess(int id) { try{return Process.GetProcessById(id);}catch{return null;} }
    static void DiscoverRunningConnection(){
        var ids=ClientIds();
        var parents=Native.ProcessParents();var roots=new System.Collections.Generic.List<int>();foreach(int id in ids)if(!parents.ContainsKey(id)||!ids.Contains(parents[id]))roots.Add(id);
        if(roots.Count>1)throw new Exception("检测到多个官方客户端实例；已停止新增窗口，请先退出多余实例。动态壁纸可独立恢复。");
        if(roots.Count==0)return;
        try{using(var info=new ManagementObject("Win32_Process.Handle='"+roots[0]+"'")){
            string command=(string)info["CommandLine"]??"";
            var debug=Regex.Match(command,"--remote-debugging-port=(\\d+)");int candidate;
            if(!debug.Success||!int.TryParse(debug.Groups[1].Value,out candidate)||Native.LoopbackListener(candidate)!=roots[0])return;
            if(candidate<1024||candidate>65535)return;
            port=candidate;
            Spider.Log("launch","Reusing the single running native client connection.");
        }}catch{}
    }
    static void RefreshOwned(HashSet<int> before) {
        if(!launchOwned) return;
        int listener=Native.LoopbackListener(port);
        if(listener>0&&!before.Contains(listener)&&ClientIds().Contains(listener))owned.Add(listener);
        var parents=Native.ProcessParents();bool changed=true;
        while(changed){changed=false;foreach(int id in ClientIds())if(!owned.Contains(id)&&parents.ContainsKey(id)&&owned.Contains(parents[id])){owned.Add(id);changed=true;}}
        if(startupGuard!=null)startupGuard.Watch(owned);
    }
    static bool OwnsConnection(){
        int listener=Native.LoopbackListener(port);
        if(listener<=0||!ClientIds().Contains(listener))return false;
        try{using(var process=Process.GetProcessById(listener))return String.Equals(process.MainModule.FileName,alias,StringComparison.OrdinalIgnoreCase);}
        catch(System.ComponentModel.Win32Exception){return false;}
        catch(InvalidOperationException){return false;}
        catch(ArgumentException){return false;}
    }
    static bool Ready() {
        if(!OwnsConnection())return false;
        try {
            var request=(HttpWebRequest)WebRequest.Create("http://127.0.0.1:"+port+"/json/list");
            request.Proxy=null; request.Timeout=400;
            using(var response=request.GetResponse()) using(var reader=new StreamReader(response.GetResponseStream())) {
                var pages=Spider.Json.Deserialize<List<Dictionary<string,object>>>(reader.ReadToEnd());
                foreach(var page in pages) if(page.ContainsKey("url") && page.ContainsKey("type") && (string)page["type"]=="page" && Spider.IsMainPageUrl((string)page["url"])) return true;
            }
        } catch {}
        return false;
    }
    static void SetLayoutEnvironment(ProcessStartInfo info){
        info.EnvironmentVariables["SPIDERCODEX_OFFICIAL_VERSION"]=officialVersion??"";
        info.EnvironmentVariables["SPIDERCODEX_LAYOUT_REPAIR"]=layoutRepair??"";
        info.EnvironmentVariables["SPIDERCODEX_REPAIR_OBSERVATION"]=profile==""?"1":"0";
    }
    static bool Connect(bool restore,bool activate=false,bool health=false) {
        lastConnectionReason=null;
        if(!OwnsConnection())return false;
        string operation=restore?(adaptiveTheme?" --restore-style-only":" --restore"):activate?" --activate":health?" --health":" --no-boot";
        var info=new ProcessStartInfo(node,Spider.Quote(Path.Combine(Spider.Root,"runtime","connect.mjs"))+" --port "+port+operation+(adaptiveTheme?" --adaptive":"")) {
            UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=Spider.Root,RedirectStandardOutput=true,RedirectStandardError=true
        };
        RuntimeDependencies.IsolateProfile(info,profile);
        SetLayoutEnvironment(info);
        using(var p=Process.Start(info)) {
            string output="",error="";
            p.OutputDataReceived+=delegate(object s,DataReceivedEventArgs e){if(e.Data!=null)output+=e.Data+Environment.NewLine;};
            p.ErrorDataReceived+=delegate(object s,DataReceivedEventArgs e){if(e.Data!=null)error+=e.Data+Environment.NewLine;};
            p.BeginOutputReadLine();p.BeginErrorReadLine();
            if(!p.WaitForExit(25000)) {try{p.Kill();}catch{} Spider.Log("launch","Theme connector timed out.");return false;}
            p.WaitForExit();
            File.WriteAllText(Spider.FileAt("last-connection"+suffix+".txt"),output+error,new UTF8Encoding(false));
            if(!restore)foreach(string line in output.Split(new[]{'\r','\n'},StringSplitOptions.RemoveEmptyEntries))try{
                var data=Spider.Json.Deserialize<Dictionary<string,object>>(line);object geometry;
                object reason;
                if(data.TryGetValue("reason",out reason))lastConnectionReason=reason as string;
                if(data.TryGetValue("window",out geometry)){var w=(Dictionary<string,object>)geometry;int width=Convert.ToInt32(w["width"]),height=Convert.ToInt32(w["height"]);if(width>=300&&height>=200)targetBounds=new System.Drawing.Rectangle(Convert.ToInt32(w["x"]),Convert.ToInt32(w["y"]),width,height);}
            }catch{}
            return p.ExitCode==0;
        }
    }
    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    struct LoginReturnFlash {
        internal uint size;
        internal IntPtr window;
        internal uint flags,count,timeout;
    }
    [System.Runtime.InteropServices.DllImport("user32.dll")]
    static extern bool FlashWindowEx(ref LoginReturnFlash flash);
    static long handledLoginReturn;
    static readonly Stopwatch loginReturnPoll=Stopwatch.StartNew();
    internal static bool IsFreshLoginReturn(long completed,long now){
        return completed>0&&completed<=now&&now-completed<=5000;
    }
    static void RestoreLoginForeground(){
        if(loginReturnPoll.ElapsedMilliseconds<750||themeKeeper==null||themeKeeper.HasExited)return;
        loginReturnPoll.Restart();
        var data=Spider.Read("keeper-"+port+".json");
        object value,pid,owner,disabled;
        long completed;int keeperId,monitorId;
        if(!data.TryGetValue("loginCompletedAt",out value)||!long.TryParse(Convert.ToString(value),out completed)||
           completed<=handledLoginReturn||!data.TryGetValue("pid",out pid)||!int.TryParse(Convert.ToString(pid),out keeperId)||keeperId!=themeKeeper.Id||
           !data.TryGetValue("owner",out owner)||!int.TryParse(Convert.ToString(owner),out monitorId)||monitorId!=windowToken.ToInt32()||
           !data.TryGetValue("disabled",out disabled)||!Object.Equals(disabled,false))return;
        long now=(long)(DateTime.UtcNow-new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc)).TotalMilliseconds;
        if(!IsFreshLoginReturn(completed,now)){handledLoginReturn=completed;return;}
        IntPtr target=Window(),foreground=Native.GetForegroundWindow();
        if(target==IntPtr.Zero||foreground==IntPtr.Zero)return;
        if(foreground==target){handledLoginReturn=completed;return;}
        if(Native.Class(foreground)!="Chrome_WidgetWin_1"||!Native.IsWindowVisible(target)||Native.IsIconic(target))return;
        uint targetPid,foregroundPid;
        Native.GetWindowThreadProcessId(target,out targetPid);Native.GetWindowThreadProcessId(foreground,out foregroundPid);
        if(targetPid==0||foregroundPid==0||targetPid==foregroundPid||Native.LoopbackListener(port)!=(int)targetPid)return;
        using(var other=SafeProcess((int)foregroundPid))if(other==null||!Client(other))return;
        if(!Native.IsWindow(target)||Native.GetProp(target,WindowProperty)!=windowToken||Native.GetForegroundWindow()!=foreground)return;
        // Windows may refuse background activation; leave its focus policy intact.
        handledLoginReturn=completed;
        Native.SetForegroundWindow(target);
        bool activated=Native.GetForegroundWindow()==target;
        if(!activated&&Native.IsWindow(target)&&Native.GetProp(target,WindowProperty)==windowToken){
            // When Windows declines the foreground request, point to the right
            // taskbar window without raising it above the current application.
            var flash=new LoginReturnFlash{size=(uint)System.Runtime.InteropServices.Marshal.SizeOf(typeof(LoginReturnFlash)),
                window=target,flags=2,count=3};
            FlashWindowEx(ref flash);
        }
        Spider.Log("launch",activated?"Returned to the themed window after sign-in.":"Windows kept the other official window in front; indicated the themed window on the taskbar.");
    }
    static bool ReopenBoundWindow(){
        if(adaptiveTheme)return Reveal();
        if(!Ready()||!Connect(false,true))return false;
        for(int i=0;i<10;i++){
            var w=Window();
            if(w!=IntPtr.Zero&&Native.IsWindowVisible(w))return Reveal();
            Thread.Sleep(75);
        }
        return false;
    }
    static bool Reveal() {
        IntPtr w=Window(); if(w==IntPtr.Zero)return false;
        if(startupGuard!=null)startupGuard.Uncover(w);
        if(Native.IsIconic(w))Native.ShowWindow(w,9);else if(!Native.IsWindowVisible(w))Native.ShowWindow(w,4);
        // Activation is temporary; the managed client must not remain above unrelated apps.
        Native.SetWindowPos(w,new IntPtr(-2),0,0,0,0,0x0001|0x0002|0x0010);Native.SetForegroundWindow(w);
        return Native.IsWindowVisible(w) && !Native.IsIconic(w);
    }
    static ProcessStartInfo OfficialStart(string flags,bool hidden) {
        if(profile!="")flags+=" --user-data-dir="+Spider.Quote(Path.GetFullPath(profile));
        var info=new ProcessStartInfo(alias,flags){UseShellExecute=true,WorkingDirectory=Spider.Root,
            WindowStyle=hidden?ProcessWindowStyle.Hidden:ProcessWindowStyle.Normal};
        if(profile!=""){
            Directory.CreateDirectory(Path.GetFullPath(profile));
            RuntimeDependencies.IsolateProfile(info,profile);
        }
        return info;
    }
    static int OpenNativeWindow(HashSet<int> ids,InstalledClient registered=null) {
        int existingWindowOwner=0;
        foreach(int id in ids)using(var process=SafeProcess(id)){
            if(process==null||!Client(process))continue;
            IntPtr h=process.MainWindowHandle;
            if(h==IntPtr.Zero||Native.Class(h)!="Chrome_WidgetWin_1")continue;
            if(Native.IsIconic(h))Native.ShowWindow(h,9);
            if(Native.GetForegroundWindow()==h||Native.SetForegroundWindow(h)||registered==null)return id;
            existingWindowOwner=id;
            break;
        }
        if(registered!=null&&!string.IsNullOrEmpty(registered.NativeAppId)){
            try { return registered.ActivateNative(); }
            catch(Exception error){Spider.Log("launch","Could not activate the existing official window through Windows: "+error.Message);}
        }
        if(existingWindowOwner!=0)return existingWindowOwner;
        // An official process with no top-level window can handle its normal
        // activation request through the same registered executable.
        using(var started=Process.Start(OfficialStart("",false)))return started==null?0:started.Id;
    }
    static void SkipIntro(EventWaitHandle cancel,string reason) {
        cancel.Set();
        ResumeWallpaper();
        Spider.Log("launch","Opening the client without intro: "+reason);
    }
    static void FallbackForUnreviewedClient(InstalledClient target){
        Spider.Write("compatibility.json",new{officialVersion=target.Version,mode="native-only",reason=target.CompatibilityReason,
            nativeEntryAvailable=target.NativeAppId!=null,nativeActivationConfirmed=false});
        int pid=target.ActivateNative();
        Spider.Write("session.json",new{status="official-update",officialVersion=target.Version,clientPid=pid,
            wallpaperRequested=fullEffects,wallpaperStatus=fullEffects?"starting":"disabled",clientTerminated=false});
        string wallpaperStatus="disabled";
        if(fullEffects){
            try{LaunchWallpaper();wallpaperStatus="ready";}
            catch(Exception error){
                wallpaperStatus="unavailable";
                Spider.Log("wallpaper","Could not start wallpaper on native fallback: "+error.Message);
            }
        }
        Spider.Write("compatibility.json",new{officialVersion=target.Version,mode="native-only",reason=target.CompatibilityReason,
            nativeEntryAvailable=true,nativeActivationConfirmed=pid>0,wallpaperStatus});
        Spider.Write("session.json",new{status="official-update",officialVersion=target.Version,clientPid=pid,
            wallpaperRequested=fullEffects,wallpaperStatus,clientTerminated=false});
    }
    static void AdaptiveFallback(InstalledClient target,string detail)
    {
        Spider.Log("launch","Adaptive theme left the official renderer unchanged: "+detail);
        if(profile=="")FallbackForUnreviewedClient(target);
        else Spider.Write("session"+suffix+".json",new{status="adaptive-native",pid=Process.GetCurrentProcess().Id,port,clientTerminated=false});
    }
    static void AdoptCurrent() {
        if(!Ready())throw new Exception("没有可接入的本机客户端连接；未结束任何客户端。");
        var state=Spider.Read("session"+suffix+".json");object value;
        if(!state.TryGetValue("window",out value))throw new Exception("没有已核验的主窗口。");
        var h=new IntPtr(Convert.ToInt64(value));uint root;Native.GetWindowThreadProcessId(h,out root);
        using(var p=SafeProcess((int)root))if(p==null||!Client(p)||Native.Class(h)!="Chrome_WidgetWin_1"||Native.LoopbackListener(port)!=(int)root)throw new Exception("主窗口与本机连接归属不一致；未操作客户端。");
        bool owner;using(var mutex=new Mutex(true,EventName("DailyClient"),out owner)){
         if(!owner)return;
         using(var bring=new EventWaitHandle(false,EventResetMode.AutoReset,EventName("BringToFront")))
         using(var suspend=new EventWaitHandle(false,EventResetMode.ManualReset,EventName("SuspendTheme")))
         using(var stop=new EventWaitHandle(false,EventResetMode.AutoReset,EventName("CloseSession"))){
          owned=ClientIds();launchOwned=true;cachedWindow=h;cachedWindowPid=root;sessionShown=true;
          Native.RECT r;Native.GetWindowRect(h,out r);targetBounds=new System.Drawing.Rectangle(r.Left,r.Top,r.Right-r.Left,r.Bottom-r.Top);
          if(!Native.SetProp(h,WindowProperty,windowToken))throw new Exception("无法接续主窗口标记。");
          Spider.Write("session"+suffix+".json",new{status="visible",pid=Process.GetCurrentProcess().Id,window=h.ToInt64(),port=port,owned=true,mode="non-destructive-monitor"});
          RecordAttachment();
          try{LaunchSessionWallpaper();}catch(Exception e){Spider.Log("wallpaper",e.Message);}
          StartThemeKeeper();StartResizeCompanion();Spider.Log("launch","Adopted current client without hiding, restarting or activating it.");
          var health=Stopwatch.StartNew();
          while(!stop.WaitOne(0)){
           if(bring.WaitOne(200)){if(suspend.WaitOne(0)){try{LaunchSessionWallpaper();if(Connect(false))suspend.Reset();}catch(Exception e){Spider.Log("launch",e.Message);}}if(Window()!=IntPtr.Zero)Reveal();else Spider.Start(alias,"").Dispose();}
           if(!suspend.WaitOne(0))RestoreLoginForeground();
           if(health.ElapsedMilliseconds>2000){health.Restart();owned=ClientIds();if(owned.Count==0)break;StartThemeKeeper();StartResizeCompanion();Window();}
          }
          Spider.Write("session"+suffix+".json",new{status="monitor-ended",clientTerminated=false});
         }
        }
    }
    static void StopWallpaperForLightExperience() {
        if(profile!="")return;
        object value;int id;
        if(!Spider.Read("wallpaper.json").TryGetValue("pid",out value)||!int.TryParse(Convert.ToString(value),out id)||id<=0)return;
        try{
            using(var process=Process.GetProcessById(id)){
                if(process.SessionId!=sessionId||process.ProcessName!="DesktopWallpaper")return;
                string actual=process.MainModule.FileName;
                var folder=Directory.GetParent(Spider.Root.TrimEnd(Path.DirectorySeparatorChar));
                bool sameInstallation=folder!=null&&folder.Name.Equals("releases",StringComparison.OrdinalIgnoreCase)&&
                    actual.StartsWith(folder.FullName+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)&&
                    Path.GetFileName(actual).Equals("DesktopWallpaper.exe",StringComparison.OrdinalIgnoreCase)&&
                    Regex.IsMatch(new FileInfo(actual).Directory.Name,@"^R[0-9]+$");
                if(!sameInstallation&&!String.Equals(actual,Path.Combine(Spider.Root,"DesktopWallpaper.exe"),StringComparison.OrdinalIgnoreCase))return;
                using(var stop=EventWaitHandle.OpenExisting(Spider.Prefix+"WallpaperStop"))stop.Set();
                if(!process.WaitForExit(3000))Spider.Log("launch","Existing wallpaper did not shut down; opening client without new effects.");
            }
        }catch(ArgumentException){}catch(InvalidOperationException){}catch(WaitHandleCannotBeOpenedException){}
        catch(System.ComponentModel.Win32Exception error){Spider.Log("launch",error.Message);}
    }
    static void LaunchWallpaper() {
        bool locked=false;using(var gate=new Mutex(false,Spider.Prefix+"WallpaperLaunch")){
            try{try{locked=gate.WaitOne(30000);}catch(AbandonedMutexException){locked=true;}if(!locked)throw new Exception("另一轮壁纸启动尚未完成，请稍后重试。");LaunchWallpaperCore();}
            finally{if(locked)gate.ReleaseMutex();}
        }
    }
    static void LaunchWallpaperCore() {
        RuntimeDependencies.ValidateDesktop();RuntimeDependencies.WebViewRuntimeVersion();
        using(var started=new EventWaitHandle(false,EventResetMode.ManualReset,Spider.Prefix+"WallpaperReady")) {
            bool compatible=false;
            foreach(var process in Process.GetProcessesByName("DesktopWallpaper"))using(process){
                try{
                    if(process.SessionId!=sessionId)continue;
                    string file=process.MainModule.FileName;var version=FileVersionInfo.GetVersionInfo(file).ProductVersion;
                    if(version==null||!version.StartsWith("SpiderCodex-",StringComparison.Ordinal))continue;
                    if(string.Equals(file,Path.Combine(Spider.Root,"DesktopWallpaper.exe"),StringComparison.OrdinalIgnoreCase)&&version==Spider.Version){compatible=true;continue;}
                    // Replace only our background helper through its own stop event.
                    // Never terminate an official client as part of an upgrade.
                    try{using(var stop=EventWaitHandle.OpenExisting(Spider.Prefix+"WallpaperStop"))stop.Set();}catch{throw new Exception("旧版壁纸尚未准备好退出，请稍后重试。");}
                    if(!process.WaitForExit(8000))throw new Exception("旧版壁纸未能正常退出；没有强制结束进程，请稍后重试。");
                }catch(System.ComponentModel.Win32Exception){throw new Exception("无法确认现有壁纸进程归属；未启动第二套壁纸。");}
            }
            if(!compatible){
                started.Reset();
                Spider.Start(Path.Combine(Spider.Root,"DesktopWallpaper.exe"),"").Dispose();
            }
            if(!started.WaitOne(12000))throw new Exception("动态壁纸未能挂到桌面，请查看壁纸运行记录。");
            var state=Spider.Read("wallpaper.json");object id;int wallpaperId;if(!state.TryGetValue("pid",out id)||!int.TryParse(Convert.ToString(id),out wallpaperId))throw new Exception("壁纸就绪记录缺失。");
            using(var process=Process.GetProcessById(wallpaperId))if(!string.Equals(process.MainModule.FileName,Path.Combine(Spider.Root,"DesktopWallpaper.exe"),StringComparison.OrdinalIgnoreCase)||FileVersionInfo.GetVersionInfo(process.MainModule.FileName).ProductVersion!=Spider.Version)throw new Exception("壁纸就绪记录与当前版本不一致；未开始客户端开场。");
        }
    }
    static void MainCore(string[] args) {
        var entryPoint=Cursor.Position;
        Spider.Init();
        if(args.Length==0){
            string installation=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","SpiderCodex");
            string installedEntry=ReleasePointer.InstalledEntryForPayload(Spider.Root,installation);
            if(installedEntry!=null){using(var child=ReleasePointer.Start(installedEntry,args)){}return;}
        }
        if(Array.IndexOf(args,"--diagnose")>=0){Diagnostics.Run();return;}
        alias=Spider.Arg(args,"--client",null);
        node=Spider.Arg(args,"--node",null); profile=Spider.Arg(args,"--profile","");
        bool explicitPort=Array.IndexOf(args,"--port")>=0;
        if(explicitPort&&(!int.TryParse(Spider.Arg(args,"--port",""),out port)||port<1024||port>65535))
            throw new Exception("本机连接端口无效。");
        bool explicitProfile=Array.IndexOf(args,"--profile")>=0;
        if(explicitProfile&&profile!="")suffix=".qa";
        fullEffects=ReleasePointer.FullExperienceForLaunch(Spider.Root,args);
        if(Array.IndexOf(args,"--probe-effect-mode")>=0){
            var mode=new{theme=true,dynamicWallpaper=fullEffects,resizePreview=true,intro=fullEffects&&Array.IndexOf(args,"--skip-intro")<0};
            if(Array.IndexOf(args,"--stdout")>=0)Console.WriteLine(Spider.Json.Serialize(mode));
            else Spider.Write("effect-mode"+suffix+".json",mode);
            return;
        }
        if(Array.IndexOf(args,"--wallpaper")>=0){LaunchWallpaper();return;}
        if(Array.IndexOf(args,"--stop-wallpaper")>=0){try{using(var e=EventWaitHandle.OpenExisting(Spider.Prefix+"WallpaperStop"))e.Set();}catch{}return;}
        if(Array.IndexOf(args,"--close")>=0){try{using(var e=EventWaitHandle.OpenExisting(EventName("CloseSession")))e.Set();}catch{}return;}
        InstalledClient target;
        try{target=InstalledClient.Resolve();}
        catch(Exception error){
            MessageBox.Show(error.Message,"Spider Codex",MessageBoxButtons.OK,MessageBoxIcon.Warning);
            Environment.ExitCode=1;
            return;
        }
        if(Array.IndexOf(args,"--probe-launch-target")>=0){Spider.Write("launch-target.json",target.Describe());return;}
        officialVersion=target.Version;
        layoutRepair=profile==""?CompatibilityRepair.CurrentPreset(Spider.State,officialVersion):null;
        adaptiveTheme=!target.ThemeCompatible&&target.CanTryAdaptiveTheme;
        if(!target.ThemeCompatible&&!adaptiveTheme){
            try{
                if(profile!=""||Array.IndexOf(args,"--adopt-current")>=0||Array.IndexOf(args,"--restore")>=0||Array.IndexOf(args,"--probe-connection")>=0)
                    throw new InvalidOperationException("当前官方客户端版本或启动入口需要兼容性复核。请从 Windows 开始菜单打开官方客户端。");
                if(!fullEffects)StopWallpaperForLightExperience();
                FallbackForUnreviewedClient(target);
            }catch(Exception error){
                // This launch did not take ownership of the live theme session.
                MessageBox.Show(error.Message,"Spider Codex",MessageBoxButtons.OK,MessageBoxIcon.Warning);
                Environment.ExitCode=1;
            }
            return;
        }
        if(alias!=null&&!String.Equals(Path.GetFullPath(alias),target.Executable,StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("指定的入口和当前已验证的官方客户端不一致。请移除 --client 覆盖项。");
        alias=target.Executable;
        if(!explicitPort&&!adaptiveTheme)DiscoverRunningConnection();
        if(Array.IndexOf(args,"--probe-connection")>=0){
            bool reused=Ready();
            if(port==0)port=Native.FindFreeLoopbackPort();
            Spider.Write("connection-probe.json",new{port,reused,automatic=!explicitPort,customProfile=profile!=""});
            return;
        }
        if(Array.IndexOf(args,"--adopt-current")>=0){node=RuntimeDependencies.ResolveNode(node);AdoptCurrent();return;}
        if(Array.IndexOf(args,"--restore")>=0){
            node=RuntimeDependencies.ResolveNode(node);
            try{using(var e=EventWaitHandle.OpenExisting(EventName("SuspendTheme")))e.Set();}catch{}
            if(Ready())Connect(true);return;
        }
        bool owner;
        using(var mutex=new Mutex(true,EventName("DailyClient"),out owner)) {
            if(!owner) {
                try{using(var e=EventWaitHandle.OpenExisting(EventName("BringToFront")))e.Set();}catch{}
                if(profile=="")try{
                    if(fullEffects)LaunchWallpaper();
                    else StopWallpaperForLightExperience();
                }catch(Exception error){Spider.Log("launch","Could not update desktop wallpaper on reopen: "+error.Message);}
                return;
            }
            if(!fullEffects)StopWallpaperForLightExperience();
            var previousSession=Spider.Read("session"+suffix+".json");object previousOwner;
            if(previousSession.TryGetValue("pid",out previousOwner)){int previousId;if(int.TryParse(Convert.ToString(previousOwner),out previousId)&&previousId>0)Native.RestoreStartupOpacity(previousId);}
            using(var bring=new EventWaitHandle(false,EventResetMode.AutoReset,EventName("BringToFront")))
            using(var ready=new EventWaitHandle(false,EventResetMode.ManualReset,EventName("ClientReady")))
            using(var startedBoot=new EventWaitHandle(false,EventResetMode.ManualReset,EventName("BootStarted")))
            using(var reveal=new EventWaitHandle(false,EventResetMode.ManualReset,EventName("Reveal")))
            using(var visible=new EventWaitHandle(false,EventResetMode.ManualReset,EventName("WindowVisible")))
            using(var cancel=new EventWaitHandle(false,EventResetMode.ManualReset,EventName("CancelBoot")))
            using(var suspend=new EventWaitHandle(false,EventResetMode.ManualReset,EventName("SuspendTheme")))
            using(var stop=new EventWaitHandle(false,EventResetMode.AutoReset,EventName("CloseSession"))) {
                ready.Reset();startedBoot.Reset();reveal.Reset();visible.Reset();cancel.Reset();
                Spider.Write("session"+suffix+".json",new{status="starting",pid=Process.GetCurrentProcess().Id,port=port});
                if(!File.Exists(alias))throw new Exception("找不到已安装的 Codex 客户端入口。");
                if(Native.LoopbackListener(port)!=0&&!OwnsConnection())throw new Exception("主题端口已被其他程序或另一份客户端配置占用，请在该程序退出后重新打开。");
                if(!OwnsConnection()){
                    var running=ClientIds();
                    if(running.Count>0){
                        if(profile!="")throw new Exception("独立客户端已运行，但没有可核验的主题连接。");
                        int clientId=OpenNativeWindow(running,target);
                        Spider.Write("session.json",new{status="native-existing",clientPid=clientId,clientTerminated=false});
                        Spider.Log("launch","The official client was already running without a theme connection; existing session preserved.");
                        try{LaunchSessionWallpaper();}
                        catch(Exception error){Spider.Log("wallpaper","Could not start wallpaper while reusing the official client: "+error.Message);}
                        return;
                    }
                }
                try{node=RuntimeDependencies.ResolveNode(node);RuntimeDependencies.ValidateTheme();}
                catch(Exception error){
                    int client=OpenNativeWindow(ClientIds());
                    Spider.Log("launch","Opening the official client without theme: "+error.Message);
                    Spider.Write("session"+suffix+".json",new{status="native-fallback",pid=Process.GetCurrentProcess().Id,clientPid=client,reason=error.Message,clientTerminated=false});
                    return;
                }
                bool animated=false;
                if(adaptiveTheme||!fullEffects||Array.IndexOf(args,"--skip-intro")>=0)
                    SkipIntro(cancel,adaptiveTheme?"adaptive theme uses visible native startup":fullEffects?"requested":"lightweight mode");
                else try{
                    LaunchWallpaper();
                    var origin=entryPoint;
                    var click=Spider.Read("desktop-click.json");
                    if(click.ContainsKey("ticks") && DateTime.UtcNow.Ticks-Convert.ToInt64(click["ticks"])<TimeSpan.TicksPerSecond*2)
                        origin=new System.Drawing.Point(Convert.ToInt32(click["x"]),Convert.ToInt32(click["y"]));
                    using(var mute=new EventWaitHandle(false,EventResetMode.AutoReset,Spider.Prefix+"WallpaperMute"))mute.Set();
                    animationMuted=true;
                    Spider.Log("launch","Launch requested; origin="+origin.X+","+origin.Y+"; isolated="+(profile!=""));
                    boot=Spider.Start(Path.Combine(Spider.Root,"DesktopBoot.exe"),"--handshake --desktop-linked --origin "+origin.X+" "+origin.Y+" --suffix "+Spider.Quote(suffix)+" --owner "+Process.GetCurrentProcess().Id+" --owner-start "+Process.GetCurrentProcess().StartTime.ToUniversalTime().Ticks);
                    animated=WaitHandle.WaitAny(new WaitHandle[]{startedBoot,cancel},5000)==0&&!cancel.WaitOne(0);
                    if(!animated)SkipIntro(cancel,"intro did not become ready");
                }catch(Exception e){SkipIntro(cancel,e.Message);}
                bool applied=false;
                var before=ClientIds();
                if(!OwnsConnection()) {
                    if(port==0||!explicitPort&&Native.LoopbackListener(port)!=0){
                        port=Native.FindFreeLoopbackPort();
                        Spider.Write("session"+suffix+".json",new{status="starting",pid=Process.GetCurrentProcess().Id,port});
                    }
                    if(Native.LoopbackListener(port)!=0)throw new Exception("主题端口在启动期间被占用，请重试。");
                    if(!adaptiveTheme)startupGuard=new StartupWindowGuard();
                    launchOwned=true;
                    string flags="--remote-debugging-address=127.0.0.1 --remote-debugging-port="+port;
                    try{using(var started=Process.Start(OfficialStart(flags,!adaptiveTheme)))if(started!=null)owned.Add(started.Id);}
                    catch(Exception error){
                        if(!adaptiveTheme)throw;
                        AdaptiveFallback(target,error.Message);
                        return;
                    }
                    if(startupGuard!=null)startupGuard.Watch(owned);
                } else {
                    int listener=Native.LoopbackListener(port);
                    if(!before.Contains(listener))throw new Exception("本机连接端口不属于本次客户端配置，已停止连接。");
                    owned.Add(listener);launchOwned=true;before.Remove(listener);
                }
                if(adaptiveTheme)try{LaunchSessionWallpaper();}
                catch(Exception error){Spider.Log("wallpaper","Wallpaper could not start during adaptive launch: "+error.Message);}
                var clock=Stopwatch.StartNew();long nextOwnership=0,nextConnection=0,unsupportedSince=-1;
                while(clock.ElapsedMilliseconds<(adaptiveTheme?16000:60000)) {
                    if(startupGuard!=null)startupGuard.Check();
                    if(clock.ElapsedMilliseconds>=nextOwnership){RefreshOwned(before);nextOwnership=clock.ElapsedMilliseconds+1000;}
                    if(clock.ElapsedMilliseconds>=nextConnection){
                        nextConnection=clock.ElapsedMilliseconds+500;
                        if(Ready()&&Connect(false)){
                            applied=true;
                            IntPtr bound=Window();
                            if(!adaptiveTheme&&bound!=IntPtr.Zero&&startupGuard==null)Native.ShowWindow(bound,0);
                            break;
                        }
                        if(lastConnectionReason=="background-decode-failed"&&adaptiveTheme)break;
                        if(lastConnectionReason=="background-decode-failed")
                            throw new InvalidOperationException("主题背景未能解码。已退出开场，请重新校验主题包。");
                        if(lastConnectionReason=="unrecognized-native-surface"){
                            if(unsupportedSince<0)unsupportedSince=clock.ElapsedMilliseconds;
                            if(clock.ElapsedMilliseconds-unsupportedSince>=5000&&adaptiveTheme)break;
                            if(clock.ElapsedMilliseconds-unsupportedSince>=5000)
                                throw new InvalidOperationException("当前官方客户端页面不在已验证的皮肤范围内。已退出开场，可继续使用原界面。");
                        }else unsupportedSince=-1;
                    }
                    IntPtr w=Window();if(!adaptiveTheme&&w!=IntPtr.Zero&&startupGuard==null)Native.ShowWindow(w,0);
                    if(animated&&(boot.HasExited||cancel.WaitOne(0))){
                        animated=false;SkipIntro(cancel,"intro stopped before the client was ready");
                    }
                    Thread.Sleep(75);
                }
                if(!applied&&adaptiveTheme){
                    AdaptiveFallback(target,lastConnectionReason??"the official page did not match");
                    return;
                }
                if(!applied)throw new Exception("真实客户端未完成界面加载，已恢复普通窗口。详细原因见本地运行记录。");
                RecordAttachment();
                Spider.Log("launch","Theme attached; native workspace/auth surface validated.");ready.Set();
                if(animated&&WaitHandle.WaitAny(new WaitHandle[]{reveal,cancel},18000)!=0)
                    SkipIntro(cancel,"intro handoff was cancelled or timed out");
                if(!adaptiveTheme&&!Connect(false,true))throw new Exception("无法唤回真实客户端主窗口。");
                bool shown=false;
                for(int i=0;i<20&&!shown;i++){shown=Reveal();if(!shown)Thread.Sleep(100);}
                if(!shown)throw new Exception("客户端窗口没有成功显示，不能判定启动通过。");
                visible.Set();
                if(boot!=null&&boot.WaitForExit(1000)){boot.Dispose();boot=null;}
                ResumeWallpaper();
                if(startupGuard!=null){startupGuard.Dispose();startupGuard=null;}
                Reveal();
                sessionShown=true;
                Spider.Write("session"+suffix+".json",new { status="visible",pid=Process.GetCurrentProcess().Id,window=Window().ToInt64(),port=port,owned=launchOwned,adaptiveTheme });
                StartThemeKeeper();StartResizeCompanion();Spider.Log("launch","HANDOFF: native window verified visible.");
                int hidden=0,absent=0;var health=Stopwatch.StartNew();
                while(true) {
                    if(stop.WaitOne(0)){Spider.Log("launch","Session close requested.");break;}
                    if(bring.WaitOne(200)){
                        var current=Window();
                        if(current==IntPtr.Zero||(!Native.IsWindowVisible(current)&&!Native.IsIconic(current))){
                            if(!ReopenBoundWindow()){restartRequested=true;break;}
                            current=Window();
                        }
                        if(suspend.WaitOne(0)&&!adaptiveTheme){
                            startupGuard=new StartupWindowGuard();startupGuard.Watch(owned);Thread.Sleep(60);
                            if(Native.IsIconic(current))Native.ShowWindow(current,9);
                            try{LaunchSessionWallpaper();if(!Connect(false))throw new Exception("重新接入主题失败，已恢复普通窗口。");Thread.Sleep(150);startupGuard.Uncover(current);suspend.Reset();}
                            finally{startupGuard.Dispose();startupGuard=null;}
                        }
                        if(suspend.WaitOne(0)&&adaptiveTheme&&Connect(false))suspend.Reset();
                        if(Reveal()){
                            Spider.Write("session"+suffix+".json",new {status="visible",pid=Process.GetCurrentProcess().Id,
                                window=Window().ToInt64(),port=port,owned=launchOwned,adaptiveTheme,reusedClient=true});
                            Spider.Log("launch","Reused the existing official window without replaying the cold-start intro.");
                        }
                        hidden=0;absent=0;
                    }
                    IntPtr w=Window();
                    if(w==IntPtr.Zero){absent++;}else {
                        absent=0;
                        if(!Native.IsWindowVisible(w)&&!Native.IsIconic(w))hidden++;else hidden=0;
                        // A hidden window can be an account/workspace transition. Never terminate its process.
                        if(hidden==20)Spider.Log("launch","Waiting for the client window; no process cleanup requested.");
                    }
                    if(!suspend.WaitOne(0))RestoreLoginForeground();
                    if(health.ElapsedMilliseconds>15000) {
                        owned=ClientIds();if(owned.Count==0)break;StartThemeKeeper();StartResizeCompanion();
                        health.Restart();
                        if(!suspend.WaitOne(0)&&Ready())Connect(false,false,true);
                    }
                }
                // Only the native application decides when its process exits.
                RefreshOwned(before);
                Spider.Write("session"+suffix+".json",new {status="closed"});
                Spider.Log("launch","Monitor ended; native client processes were not terminated; wallpaper stays active.");
            }
        }
    }
    [STAThread]static void Main(string[] args) {
        Application.EnableVisualStyles();
        try{MainCore(args);}catch(Exception e){
            Spider.Init();Spider.Log("launch","ERROR: "+e.ToString());
            var state=Spider.Read("session"+suffix+".json");object currentOwner;
            bool ownsSession=state.TryGetValue("pid",out currentOwner)&&Convert.ToString(currentOwner)==Process.GetCurrentProcess().Id.ToString();
            if(ownsSession)try{using(var cancel=EventWaitHandle.OpenExisting(EventName("CancelBoot")))cancel.Set();}catch{}
            if(startupGuard!=null){startupGuard.Dispose();startupGuard=null;}
            if(Array.IndexOf(args,"--adopt-current")<0&&launchOwned){if(Ready()){try{Connect(true);if(!adaptiveTheme)Connect(false,true);}catch{}}Reveal();}
            if(ownsSession)Spider.Write("session"+suffix+".json",new{status="error",error=e.Message,pid=Process.GetCurrentProcess().Id,port=port,startedUtcTicks=Process.GetCurrentProcess().StartTime.ToUniversalTime().Ticks});
            MessageBox.Show(e.Message,"Spider Codex",MessageBoxButtons.OK,MessageBoxIcon.Warning);
        }finally{ResumeWallpaper();if(themeKeeper!=null){try{if(!themeKeeper.HasExited)themeKeeper.Kill();}catch{}themeKeeper.Dispose();themeKeeper=null;}if(startupGuard!=null){startupGuard.Dispose();startupGuard=null;}if(cachedWindow!=IntPtr.Zero&&Native.GetProp(cachedWindow,WindowProperty)==windowToken)Native.RemoveProp(cachedWindow,WindowProperty);if(boot!=null){try{if(!boot.HasExited)boot.Kill();}catch{}boot.Dispose();}}
        if(restartRequested)try{
            string target=ReleasePointer.RestartEntry(Spider.Root);
            Spider.Log("launch","Reopening via "+Path.GetFileName(Path.GetDirectoryName(target)));
            using(var child=ReleasePointer.Start(target,args)){}
        }catch(Exception error){
            Spider.Log("launch","Could not reopen the selected release: "+error.Message);
            MessageBox.Show(error.Message,"Spider Codex",MessageBoxButtons.OK,MessageBoxIcon.Warning);
        }
    }
}
