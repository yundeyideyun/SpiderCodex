using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Accessibility;

class DesktopWallpaper : Form {
    delegate IntPtr MouseProc(int code,IntPtr message,IntPtr data);
    [StructLayout(LayoutKind.Sequential)]struct MouseData{public Native.POINT point;public uint mouseData,flags,time;public IntPtr extra;}
    [DllImport("user32.dll",SetLastError=true)]static extern IntPtr SetWindowsHookEx(int id,MouseProc proc,IntPtr module,uint thread);
    [DllImport("user32.dll")]static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")]static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern IntPtr GetModuleHandle(string name);
    [DllImport("oleacc.dll")]static extern int AccessibleObjectFromPoint(Native.POINT p,[MarshalAs(UnmanagedType.Interface)]out IAccessible accessible,[MarshalAs(UnmanagedType.Struct)]out object child);
    readonly WebView2 web=new WebView2();
    readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer();
    readonly EventWaitHandle ready=new EventWaitHandle(false,EventResetMode.ManualReset,Spider.Prefix+"WallpaperReady");
    readonly EventWaitHandle stop=new EventWaitHandle(false,EventResetMode.AutoReset,Spider.Prefix+"WallpaperStop");
    readonly EventWaitHandle mute=new EventWaitHandle(false,EventResetMode.AutoReset,Spider.Prefix+"WallpaperMute");
    readonly EventWaitHandle resume=new EventWaitHandle(false,EventResetMode.AutoReset,Spider.Prefix+"WallpaperResume");
    readonly EventWaitHandle startBoot=new EventWaitHandle(false,EventResetMode.AutoReset,Spider.Prefix+"WallpaperBootStart");
    readonly EventWaitHandle abortBoot=new EventWaitHandle(false,EventResetMode.AutoReset,Spider.Prefix+"WallpaperBootAbort");
    EventWaitHandle bootReady,bootReveal,bootStarted,bootCancel;
    string bootId="";bool bootActive=false,clientReadySent=false,titleReady=false,swallowTitleUp=false;RectangleF titleBounds;DateTime nextCoverage=DateTime.MinValue;
    int bootOwner;long bootOwnerStart;DateTime nextBootOwnerCheck=DateTime.MinValue,settleUntil=DateTime.MinValue;
    IntPtr progman,view,worker,hook;MouseProc callback;Rectangle area;
    bool attached=false,paused=false,cleaned=false;
    DateTime muteDeadline=DateTime.MinValue;
    string[] arguments;
    protected override bool ShowWithoutActivation{get{return true;}}
    protected override CreateParams CreateParams{get{var c=base.CreateParams;c.ExStyle|=0x80|0x08000000;return c;}}
    DesktopWallpaper(string[] args){
        arguments=args;AutoScaleMode=AutoScaleMode.None;StartPosition=FormStartPosition.Manual;FormBorderStyle=FormBorderStyle.None;
        area=SystemInformation.VirtualScreen;Bounds=new Rectangle(-16000,-16000,area.Width,area.Height);ShowInTaskbar=false;Text="Spider Codex Desktop Wallpaper";
        web.Dock=DockStyle.Fill;Controls.Add(web);Shown+=async delegate{await Initialize();};
        timer.Interval=16;timer.Tick+=delegate{Tick();};FormClosed+=delegate{Cleanup();};
    }
    async System.Threading.Tasks.Task Initialize(){
        try{
            var options=new CoreWebView2EnvironmentOptions();options.AdditionalBrowserArguments="--autoplay-policy=no-user-gesture-required --disable-backgrounding-occluded-windows --disable-renderer-backgrounding";
            var profile=Path.Combine(Spider.State,"wallpaper-renderer");var env=await CoreWebView2Environment.CreateAsync(null,profile,options);await web.EnsureCoreWebView2Async(env);
            var settings=web.CoreWebView2.Settings;settings.AreDefaultContextMenusEnabled=false;settings.AreDevToolsEnabled=false;settings.IsStatusBarEnabled=false;settings.IsZoomControlEnabled=false;settings.AreBrowserAcceleratorKeysEnabled=false;
            web.CoreWebView2.SetVirtualHostNameToFolderMapping("spider.local",Path.Combine(Spider.Root,"assets"),CoreWebView2HostResourceAccessKind.DenyCors);
            web.CoreWebView2.NavigationStarting+=delegate(object sender,CoreWebView2NavigationStartingEventArgs e){if(!e.Uri.StartsWith("https://spider.local/",StringComparison.OrdinalIgnoreCase))e.Cancel=true;};
            web.CoreWebView2.NewWindowRequested+=delegate(object sender,CoreWebView2NewWindowRequestedEventArgs e){e.Handled=true;};
            web.CoreWebView2.DownloadStarting+=delegate(object sender,CoreWebView2DownloadStartingEventArgs e){e.Cancel=true;};
            web.CoreWebView2.WebMessageReceived+=OnMessage;
            web.CoreWebView2.Navigate("https://spider.local/desktop-v8.html?build="+Uri.EscapeDataString(Spider.Version));timer.Start();
        }catch(Exception e){Spider.Log("wallpaper","GPU INITIALIZATION ERROR: "+e.Message);Close();}
    }
    void OnMessage(object sender,CoreWebView2WebMessageReceivedEventArgs e){
        try{
            var data=Spider.Json.Deserialize<System.Collections.Generic.Dictionary<string,object>>(e.WebMessageAsJson);
            string kind=(string)data["kind"];
            if(kind=="ready"&&!attached){
                Attach();callback=OnMouse;hook=SetWindowsHookEx(14,callback,GetModuleHandle(null),0);
                if(hook==IntPtr.Zero)throw new System.ComponentModel.Win32Exception();
                Spider.Write("wallpaper.json",new{status="running",pid=Process.GetCurrentProcess().Id,version=Spider.Version,renderer="video",trayIcon=false,window=Handle.ToInt64(),browser=web.CoreWebView2.BrowserProcessId,video=data});ready.Set();
                Spider.Log("wallpaper","GPU video surface ready; no tray icon.");
            }else if(kind=="metrics")Spider.Write("wallpaper-performance.json",data);
            else if(kind=="bootStarted"&&bootActive&&(string)data["id"]==bootId){bootStarted.Set();Spider.Write("boot-state.json",new{id=bootId,status="started"});}
            else if(kind=="bootTitleVisible"&&bootActive&&(string)data["id"]==bootId){var box=(System.Collections.Generic.Dictionary<string,object>)data["box"];titleBounds=new RectangleF((float)(area.Left+Convert.ToDouble(box["u"])*area.Width),(float)(area.Top+Convert.ToDouble(box["v"])*area.Height),(float)(Convert.ToDouble(box["width"])*area.Width),(float)(Convert.ToDouble(box["height"])*area.Height));titleReady=true;Spider.Write("boot-title.json",data);}else if(kind=="bootEnterRequested"&&bootActive&&(string)data["id"]==bootId)Spider.Write("boot-enter.json",data);else if(kind=="bootWaiting"&&bootActive&&(string)data["id"]==bootId)Spider.Write("boot-state.json",new{id=bootId,status="waiting-client"});
            else if(kind=="bootFinished"&&bootActive&&(string)data["id"]==bootId){Spider.Write("boot-performance.json",data);Spider.Write("boot-state.json",new{id=bootId,status="finished"});settleUntil=DateTime.UtcNow.AddSeconds(15);bootReveal.Set();EndBoot();}
            else if(kind=="error"){Spider.Log("wallpaper","GPU ERROR: "+e.WebMessageAsJson);if(bootActive){Spider.Write("boot-state.json",new{id=bootId,status="error",detail=e.WebMessageAsJson});bootCancel.Set();EndBoot();}Close();}
        }catch(Exception error){Spider.Log("wallpaper","GPU HOST ERROR: "+error.Message);Close();}
    }
    void Attach(){
        progman=Native.FindWindow("Progman",null);IntPtr unused;Native.SendMessageTimeout(progman,0x052C,new IntPtr(0xD),new IntPtr(1),0,1000,out unused);
        view=Native.FindWindowEx(progman,IntPtr.Zero,"SHELLDLL_DefView",null);worker=Native.FindWindowEx(progman,IntPtr.Zero,"WorkerW",null);
        IntPtr parent=progman;
        bool raised=(Native.GetWindowLong(progman,-20)&0x00200000)!=0;
        if(!raised){parent=IntPtr.Zero;Native.EnumWindows(delegate(IntPtr h,IntPtr p){if(Native.FindWindowEx(h,IntPtr.Zero,"SHELLDLL_DefView",null)!=IntPtr.Zero)parent=Native.FindWindowEx(IntPtr.Zero,h,"WorkerW",null);return true;},IntPtr.Zero);}
        if(parent==IntPtr.Zero||raised&&(view==IntPtr.Zero||worker==IntPtr.Zero))throw new Exception("找不到桌面背景层。");
        Native.SetWindowLong(Handle,-16,(Native.GetWindowLong(Handle,-16)&unchecked((int)~0x80000000))|0x40000000);
        Native.SetWindowLong(Handle,-20,Native.GetWindowLong(Handle,-20)|0x80000|0x20);Native.SetLayeredWindowAttributes(Handle,0,255,2);Native.SetParent(Handle,parent);
        var point=new Native.POINT(area.Left,area.Top);Native.MapWindowPoints(IntPtr.Zero,parent,ref point,1);
        Native.SetWindowPos(Handle,raised?view:IntPtr.Zero,point.X,point.Y,area.Width,area.Height,0x0040|0x0010);
        if(raised)Native.SetWindowPos(worker,new IntPtr(1),0,0,0,0,0x0001|0x0002|0x0010);attached=true;
    }
    void Post(object message){if(web.CoreWebView2!=null)web.CoreWebView2.PostWebMessageAsJson(Spider.Json.Serialize(message));}
    bool EntryIcon(Point point){
        IAccessible accessible=null;object child;
        try{
            if(AccessibleObjectFromPoint(new Native.POINT(point.X,point.Y),out accessible,out child)!=0||accessible==null)return false;
            string name=accessible.get_accName(child)??"";
            return name.Equals("Spider Codex",StringComparison.OrdinalIgnoreCase)||name.Equals("SpiderCodex",StringComparison.OrdinalIgnoreCase)||name.StartsWith("Spider Codex 验证",StringComparison.OrdinalIgnoreCase);
        }catch{return false;}finally{if(accessible!=null)Marshal.ReleaseComObject(accessible);}
    }
    IntPtr OnMouse(int code,IntPtr message,IntPtr pointer){
        try{
            if(code>=0&&message.ToInt32()==0x202&&swallowTitleUp){swallowTitleUp=false;return new IntPtr(1);}
            if(code>=0&&message.ToInt32()==0x201){var m=(MouseData)Marshal.PtrToStructure(pointer,typeof(MouseData));if(Native.IsDesktopPoint(m.point)){
                var point=new Point(m.point.X,m.point.Y);bool titleHit=bootActive&&titleReady&&area==SystemInformation.VirtualScreen&&titleBounds.Contains(point.X,point.Y);BeginInvoke((Action)delegate{
                    Spider.Write("desktop-click.json",new{x=point.X,y=point.Y,ticks=DateTime.UtcNow.Ticks});
                    if(bootActive){Post(new{kind="bootPointerDown",u=(double)(point.X-area.Left)/area.Width,v=(double)(point.Y-area.Top)/area.Height});return;}if(DateTime.UtcNow<muteDeadline||EntryIcon(point))return;
                    Post(new{kind="web",u=(double)(point.X-area.Left)/area.Width,v=(double)(point.Y-area.Top)/area.Height,screenWidthRatio=Screen.FromPoint(point).Bounds.Width/(double)area.Width});
                });
                if(titleHit){swallowTitleUp=true;return new IntPtr(1);}
            }}
        }catch{}return CallNextHookEx(hook,code,message,pointer);
    }
    bool Covered(){
        IntPtr fg=Native.GetForegroundWindow();string cls=Native.Class(fg);if(cls=="Progman"||cls=="WorkerW"||cls=="Shell_TrayWnd"||fg==Handle)return false;
        uint key,flags;byte alpha;if(Native.GetLayeredWindowAttributes(fg,out key,out alpha,out flags)&&(flags&2)!=0&&alpha==0)return false;
        Native.RECT r;if(!Native.GetWindowRect(fg,out r)||Native.IsIconic(fg))return false;
        var areas=new System.Collections.Generic.List<Rectangle>();foreach(var screen in Screen.AllScreens)areas.Add(screen.WorkingArea);return Native.CoversAllWorkingAreas(r,areas);
    }
    // The desktop child HWND does not always get WM_DISPLAYCHANGE broadcasts.
    void RefreshDesktopArea(){
        Rectangle current=SystemInformation.VirtualScreen;
        if(current==area||current.Width<=0||current.Height<=0)return;
        IntPtr parent=Native.GetParent(Handle);
        if(parent==IntPtr.Zero||!Native.IsWindow(parent))return;
        var point=new Native.POINT(current.Left,current.Top);
        Native.MapWindowPoints(IntPtr.Zero,parent,ref point,1);
        if(!Native.SetWindowPos(Handle,IntPtr.Zero,point.X,point.Y,current.Width,current.Height,0x0004|0x0010|0x0040))return;
        area=current;
        titleReady=false;
        if(bootActive){
            Post(new{kind="abortBoot"});
            bootCancel.Set();
            Spider.Write("boot-state.json",new{id=bootId,status="cancelled",reason="desktop-layout-changed"});
            EndBoot();
        }
        Spider.Write("wallpaper-layout.json",new{left=area.Left,top=area.Top,width=area.Width,height=area.Height,monitors=Screen.AllScreens.Length,changed=DateTime.UtcNow.ToString("o")});
    }
    bool RequestUsesCurrentArea(System.Collections.Generic.Dictionary<string,object> request){
        object coordinates;
        // Compatibility with a launcher that started before the helper was upgraded.
        if(!request.TryGetValue("virtualBounds",out coordinates))return true;
        var bounds=coordinates as System.Collections.IList;
        if(bounds==null||bounds.Count!=4)return false;
        var requested=new Rectangle(Convert.ToInt32(bounds[0]),Convert.ToInt32(bounds[1]),Convert.ToInt32(bounds[2]),Convert.ToInt32(bounds[3]));
        object monitors;int count=request.TryGetValue("monitorCount",out monitors)?Convert.ToInt32(monitors):0;
        return Native.BootAreasCompatible(requested,count,area,Screen.AllScreens.Length);
    }
    void Tick(){
        try{
            if(stop.WaitOne(0)){Close();return;}
            if(startBoot.WaitOne(0)){
                if(attached)RefreshDesktopArea();
                EndBoot();var request=Spider.Read("boot-request.json");bootId=(string)request["id"];string suffix=(string)request["suffix"];
                bootOwner=Convert.ToInt32(request["ownerPid"]);bootOwnerStart=Convert.ToInt64(request["ownerStartTicks"]);
                settleUntil=DateTime.MinValue;
                bootReady=EventWaitHandle.OpenExisting(Spider.Prefix+"ClientReady"+suffix);bootReveal=EventWaitHandle.OpenExisting(Spider.Prefix+"Reveal"+suffix);bootStarted=EventWaitHandle.OpenExisting(Spider.Prefix+"BootStarted"+suffix);bootCancel=EventWaitHandle.OpenExisting(Spider.Prefix+"CancelBoot"+suffix);
                if(!RequestUsesCurrentArea(request)){
                    Spider.Write("boot-state.json",new{id=bootId,status="cancelled",reason="desktop-coordinate-layout-mismatch"});
                    bootCancel.Set();EndBoot();return;
                }
                bootActive=true;clientReadySent=false;titleReady=false;muteDeadline=DateTime.UtcNow.AddSeconds(70);Post(new{kind="beginBoot",request=request});
            }
            if((bootActive||DateTime.UtcNow<settleUntil)&&DateTime.UtcNow>=nextBootOwnerCheck){
                nextBootOwnerCheck=DateTime.UtcNow.AddMilliseconds(250);
                if(!BootOwnerAlive()){
                    Native.RestoreStartupOpacity(bootOwner);
                    if(bootActive){
                        Post(new{kind="abortBoot"});
                        Spider.Write("boot-state.json",new{id=bootId,status="cancelled",reason="launcher-exited"});
                        EndBoot();
                    }
                    settleUntil=DateTime.MinValue;
                }
            }
            if(abortBoot.WaitOne(0)||bootActive&&bootCancel.WaitOne(0)){Post(new{kind="abortBoot"});EndBoot();}
            if(bootActive&&!clientReadySent&&bootReady.WaitOne(0)){clientReadySent=true;Post(new{kind="clientReady"});}
            if(mute.WaitOne(0)){muteDeadline=DateTime.UtcNow.AddSeconds(70);Post(new{kind="mute"});}
            if(resume.WaitOne(0)||muteDeadline!=DateTime.MinValue&&DateTime.UtcNow>=muteDeadline){muteDeadline=DateTime.MinValue;Post(new{kind="resume"});}
            if(attached&&DateTime.UtcNow>=nextCoverage){nextCoverage=DateTime.UtcNow.AddMilliseconds(500);RefreshDesktopArea();bool covered=!bootActive&&Covered();if(covered!=paused){paused=covered;Post(new{kind=covered?"pause":"play"});}}
        }catch(Exception e){Spider.Log("wallpaper","GPU CONTROL ERROR: "+e.Message);Close();}
    }
    bool BootOwnerAlive(){try{using(var process=Process.GetProcessById(bootOwner))return !process.HasExited&&process.StartTime.ToUniversalTime().Ticks==bootOwnerStart&&process.ProcessName=="SpiderCodex";}catch{return false;}}
    void EndBoot(){bootActive=false;clientReadySent=false;titleReady=false;muteDeadline=DateTime.MinValue;foreach(var handle in new[]{bootReady,bootReveal,bootStarted,bootCancel})if(handle!=null)handle.Dispose();bootReady=bootReveal=bootStarted=bootCancel=null;}
    void Cleanup(){if(cleaned)return;cleaned=true;if(bootActive){try{bootCancel.Set();}catch{}EndBoot();}ready.Reset();timer.Dispose();if(hook!=IntPtr.Zero)UnhookWindowsHookEx(hook);web.Dispose();ready.Dispose();stop.Dispose();mute.Dispose();resume.Dispose();startBoot.Dispose();abortBoot.Dispose();Spider.Write("wallpaper.json",new{status="stopped"});Spider.Log("wallpaper","GPU wallpaper stopped; original desktop revealed.");}
    [STAThread]static void Main(string[] args){Spider.Init();bool owner;using(var mutex=new Mutex(true,Spider.Prefix+"Wallpaper",out owner)){if(!owner)return;Application.SetUnhandledExceptionMode(UnhandledExceptionMode.ThrowException);Application.EnableVisualStyles();try{using(var window=new DesktopWallpaper(args))Application.Run(window);}catch(Exception error){Spider.Log("wallpaper",error.ToString());Spider.Write("wallpaper-error.json",new{error=error.ToString()});}}}
}
