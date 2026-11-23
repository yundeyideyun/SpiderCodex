using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyInformationalVersion("SpiderCodex-20261118.58-v8")]

internal static class Spider {
    internal static readonly string Root = AppDomain.CurrentDomain.BaseDirectory;
    internal static string Version {get{return ((System.Reflection.AssemblyInformationalVersionAttribute)Attribute.GetCustomAttribute(typeof(Spider).Assembly,typeof(System.Reflection.AssemblyInformationalVersionAttribute))).InformationalVersion;}}
    internal static readonly string State = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SpiderCodex");
    internal const string Prefix = "Local\\SpiderCodex.v3.";
    [ThreadStatic] static JavaScriptSerializer serializer;
    internal static JavaScriptSerializer Json {
        get { return serializer??(serializer=new JavaScriptSerializer()); }
    }
    internal static void Init() { Directory.CreateDirectory(State); Native.SetProcessDPIAware(); }
    internal static string FileAt(string name) { return Path.Combine(State, name); }
    internal static string ProfileKey(string profile) {
        if(String.IsNullOrEmpty(profile))return "";
        var value=Path.GetFullPath(profile).TrimEnd(Path.DirectorySeparatorChar).ToUpperInvariant();
        using(var digest=System.Security.Cryptography.SHA256.Create())
            return Convert.ToBase64String(digest.ComputeHash(Encoding.UTF8.GetBytes(value)));
    }
    internal static void Log(string channel, string message) {
        try { File.AppendAllText(FileAt(channel + ".log"), DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " " + message + Environment.NewLine); } catch {}
    }
    internal static void Write(string name, object value) {
        using(var gate=new System.Threading.Mutex(false,Prefix+"StateWrite")){
            bool acquired=false;
            try{
                try{acquired=gate.WaitOne(1000);}catch(System.Threading.AbandonedMutexException){acquired=true;}
                if(!acquired)throw new IOException("状态文件正在写入，请稍后重试。");
                WriteState(name,value);
            }finally{if(acquired)gate.ReleaseMutex();}
        }
    }
    static void WriteState(string name,object value){
        string target = FileAt(name);
        string temporary = target + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try {
            File.WriteAllText(temporary, Json.Serialize(value), new UTF8Encoding(false));
            for(int attempt=0;;attempt++) {
                try {
                    if(File.Exists(target))File.Replace(temporary,target,null);
                    else File.Move(temporary,target);
                    return;
                }catch(IOException) {
                    if(attempt>=3)throw;
                    System.Threading.Thread.Sleep(15);
                }
            }
        }finally {
            if(File.Exists(temporary))try{File.Delete(temporary);}catch(IOException){}
        }
    }
    internal static Dictionary<string,object> Read(string name) {
        using(var gate=new System.Threading.Mutex(false,Prefix+"StateWrite")){
            bool acquired=false;
            try{
                try{acquired=gate.WaitOne(1000);}catch(System.Threading.AbandonedMutexException){acquired=true;}
                if(!acquired)return new Dictionary<string,object>();
                return ReadState(name);
            }finally{if(acquired)gate.ReleaseMutex();}
        }
    }
    static Dictionary<string,object> ReadState(string name){
        for(int attempt=0;;attempt++) {
            try {
                using(var stream=new FileStream(FileAt(name),FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete))
                using(var reader=new StreamReader(stream,Encoding.UTF8))
                    return Json.Deserialize<Dictionary<string,object>>(reader.ReadToEnd())??new Dictionary<string,object>();
            }catch(IOException){
                if(attempt>=3)return new Dictionary<string,object>();
                System.Threading.Thread.Sleep(10);
            }catch { return new Dictionary<string,object>(); }
        }
    }
    internal static string Arg(string[] args, string key, string fallback) {
        int n = Array.IndexOf(args, key); return n >= 0 && n + 1 < args.Length ? args[n+1] : fallback;
    }
    internal static string Quote(string text) {
        if(text==null)return "\"\"";
        var quoted=new StringBuilder("\"");int slashes=0;
        foreach(char c in text){
            if(c=='\\'){slashes++;continue;}
            if(c=='\"'){quoted.Append('\\',slashes*2+1);quoted.Append(c);}
            else{quoted.Append('\\',slashes);quoted.Append(c);}
            slashes=0;
        }
        quoted.Append('\\',slashes*2);quoted.Append('\"');return quoted.ToString();
    }
    internal static bool IsMainPageUrl(string value) {
        Uri uri;
        return Uri.TryCreate(value,UriKind.Absolute,out uri)&&uri.Scheme=="app"&&uri.Host=="-"&&uri.AbsolutePath=="/index.html"&&uri.UserInfo==""&&uri.IsDefaultPort&&value.IndexOf("avatar-overlay",StringComparison.OrdinalIgnoreCase)<0;
    }
    internal static Process Start(string file, string args) {
        return Process.Start(new ProcessStartInfo(file, args) { UseShellExecute=false, CreateNoWindow=true, WorkingDirectory=Root });
    }
    internal static double Clamp(double v) { return Math.Max(0, Math.Min(1, v)); }
}

internal static class Native {
    internal static bool IsOfficialClient(Process process) {
        try{
            return process.SessionId==Process.GetCurrentProcess().SessionId&&
                process.ProcessName.Equals("ChatGPT",StringComparison.OrdinalIgnoreCase)&&
                process.MainModule.FileName.IndexOf("\\WindowsApps\\OpenAI.Codex_",StringComparison.OrdinalIgnoreCase)>=0;
        }catch{return false;}
    }
    internal const string StartupOpacityProperty="SpiderCodex.StartupOpacity.v5";
    internal const string StartupOwnerProperty="SpiderCodex.StartupOwner.v1";
    internal const string StartupHiddenProperty="SpiderCodex.StartupHidden.v1";
    internal static bool ReleaseStartupSurface(IntPtr window,int onlyOwner=0){
        if(!IsWindow(window)||(onlyOwner>0&&GetProp(window,StartupOwnerProperty)!=new IntPtr(onlyOwner)))return false;
        IntPtr patch=GetProp(window,StartupOpacityProperty);
        bool hidden=GetProp(window,StartupHiddenProperty)==new IntPtr(1);
        if(patch==IntPtr.Zero&&!hidden)return false;
        if(patch!=IntPtr.Zero){
            int bits=patch.ToInt32();
            if(bits==1)bits=0x80000;
            SetLayeredWindowAttributes(window,0,255,2);
            SetWindowLong(window,-20,GetWindowLong(window,-20)&~bits);
            RemoveProp(window,StartupOpacityProperty);
            SetWindowPos(window,IntPtr.Zero,0,0,0,0,0x0001|0x0002|0x0004|0x0010|0x0020);
        }
        RemoveProp(window,StartupHiddenProperty);
        RemoveProp(window,StartupOwnerProperty);
        if(hidden)ShowWindow(window,4);
        return true;
    }
    internal static void RestoreStartupOpacity(int onlyOwner=0){
        EnumWindows(delegate(IntPtr window,IntPtr unused){if(GetProp(window,StartupOpacityProperty)==IntPtr.Zero&&GetProp(window,StartupHiddenProperty)==IntPtr.Zero)return true;uint id;GetWindowThreadProcessId(window,out id);try{using(var process=Process.GetProcessById((int)id)){
            if(onlyOwner>0&&GetProp(window,StartupOwnerProperty)!=new IntPtr(onlyOwner))return true;
            if(process.ProcessName!="ChatGPT"||process.SessionId!=Process.GetCurrentProcess().SessionId||process.MainModule.FileName.IndexOf("\\WindowsApps\\OpenAI.Codex_",StringComparison.OrdinalIgnoreCase)<0)return true;
            ReleaseStartupSurface(window,onlyOwner);
        }}catch{}return true;},IntPtr.Zero);
    }
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct ProcessEntry {
        public uint size,usage,pid;public IntPtr heap;public uint module,threads,parent;public int priority;public uint flags;
        [MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]public string name;
    }
    [DllImport("kernel32.dll")]static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint pid);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool Process32First(IntPtr snapshot,ref ProcessEntry entry);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool Process32Next(IntPtr snapshot,ref ProcessEntry entry);
    [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
    [DllImport("iphlpapi.dll")]static extern uint GetExtendedTcpTable(IntPtr table,ref uint size,bool order,int family,int cls,uint reserved);
    internal static int FindFreeLoopbackPort(){
        var reservation=new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback,0);
        try{
            reservation.ExclusiveAddressUse=true;
            reservation.Start();
            return ((System.Net.IPEndPoint)reservation.LocalEndpoint).Port;
        }finally{reservation.Stop();}
    }
    internal static Dictionary<int,int> ProcessParents() {
        var result=new Dictionary<int,int>();IntPtr snap=CreateToolhelp32Snapshot(2,0);
        if(snap==new IntPtr(-1))return result;
        try{var e=new ProcessEntry();e.size=(uint)Marshal.SizeOf(e);if(Process32First(snap,ref e))do{result[(int)e.pid]=(int)e.parent;}while(Process32Next(snap,ref e));}finally{CloseHandle(snap);}return result;
    }
    internal static int LoopbackListener(int port) {
        if(port<1024||port>65535)return 0;
        uint size=0;GetExtendedTcpTable(IntPtr.Zero,ref size,false,2,3,0);IntPtr table=Marshal.AllocHGlobal((int)size);
        try{
            if(GetExtendedTcpTable(table,ref size,false,2,3,0)!=0)return 0;
            int count=Marshal.ReadInt32(table);
            for(int i=0;i<count;i++) {
                IntPtr row=IntPtr.Add(table,4+i*24);uint address=(uint)Marshal.ReadInt32(row,4),raw=(uint)Marshal.ReadInt32(row,8);
                int local=(int)(((raw&255)<<8)|((raw>>8)&255));
                if(local==port&&address==0x0100007f)return Marshal.ReadInt32(row,20);
            }return 0;
        }finally{Marshal.FreeHGlobal(table);}
    }
    internal delegate bool EnumProc(IntPtr h, IntPtr p);
    [StructLayout(LayoutKind.Sequential)] internal struct POINT { public int X,Y; public POINT(int x,int y) {X=x;Y=y;} }
    [StructLayout(LayoutKind.Sequential)] internal struct RECT { public int Left,Top,Right,Bottom; }
    internal static bool CoversAllWorkingAreas(RECT window,IEnumerable<Rectangle> areas){bool any=false;foreach(var area in areas){if(area.Width<=0||area.Height<=0)continue;any=true;if(window.Left>area.Left||window.Top>area.Top||window.Right<area.Right||window.Bottom<area.Bottom)return false;}return any;}
    internal static bool BootAreasCompatible(Rectangle request,int requestMonitors,Rectangle current,int currentMonitors) {
        if(request.Width<=0||request.Height<=0||current.Width<=0||current.Height<=0)return false;
        if(request==current)return requestMonitors==0||requestMonitors==currentMonitors;
        // Explorer can reparent the wallpaper into a different DPI context.
        // A single screen still has the same normalized coordinates after uniform scaling.
        if(requestMonitors!=1||currentMonitors!=1||request.Location!=Point.Empty||current.Location!=Point.Empty)return false;
        long aspectDifference=Math.Abs((long)request.Width*current.Height-(long)current.Width*request.Height);
        return aspectDifference<=Math.Max(request.Width,current.Width);
    }
    [DllImport("user32.dll")] internal static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] internal static extern uint GetDpiForSystem();
    [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)]internal static extern bool SetProp(IntPtr h,string name,IntPtr value);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)]internal static extern IntPtr GetProp(IntPtr h,string name);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)]internal static extern IntPtr RemoveProp(IntPtr h,string name);
    [DllImport("user32.dll")] internal static extern bool EnumWindows(EnumProc callback, IntPtr p);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] internal static extern int GetWindowText(IntPtr h, StringBuilder s, int count);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] internal static extern int GetClassName(IntPtr h, StringBuilder s, int count);
    [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(IntPtr h, out uint id);
    [DllImport("user32.dll")] internal static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] internal static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] internal static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] internal static extern bool ShowWindow(IntPtr h,int command);
    [DllImport("user32.dll")] internal static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] internal static extern IntPtr GetWindow(IntPtr h, uint command);
    [DllImport("user32.dll")] internal static extern bool GetWindowRect(IntPtr h,out RECT r);
    [DllImport("user32.dll")] internal static extern bool PostMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
    [DllImport("user32.dll")] internal static extern IntPtr WindowFromPoint(POINT p);
    [DllImport("user32.dll")] internal static extern IntPtr GetAncestor(IntPtr h,uint flag);
    [DllImport("user32.dll")] internal static extern IntPtr GetParent(IntPtr h);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] internal static extern IntPtr FindWindow(string cls,string title);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] internal static extern IntPtr FindWindowEx(IntPtr parent,IntPtr after,string cls,string title);
    [DllImport("user32.dll")] internal static extern IntPtr SetParent(IntPtr child,IntPtr parent);
    [DllImport("user32.dll")] internal static extern int GetWindowLong(IntPtr h,int index);
    [DllImport("user32.dll",SetLastError=true)] internal static extern int SetWindowLong(IntPtr h,int index,int style);
    [DllImport("user32.dll")] internal static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
    [DllImport("user32.dll",SetLastError=true)] internal static extern bool SetLayeredWindowAttributes(IntPtr h,uint key,byte alpha,uint flags);
    [DllImport("user32.dll")] internal static extern bool GetLayeredWindowAttributes(IntPtr h,out uint key,out byte alpha,out uint flags);
    [DllImport("user32.dll")] internal static extern IntPtr SendMessageTimeout(IntPtr h,uint msg,IntPtr w,IntPtr l,uint flags,uint timeout,out IntPtr result);
    [DllImport("user32.dll")] internal static extern int MapWindowPoints(IntPtr from,IntPtr to,ref POINT point,uint count);
    internal static string Title(IntPtr h) { var s=new StringBuilder(512); GetWindowText(h,s,s.Capacity); return s.ToString(); }
    internal static string Class(IntPtr h) { var s=new StringBuilder(256); GetClassName(h,s,s.Capacity); return s.ToString(); }
    internal static bool IsDesktopPoint(POINT p) {
        IntPtr h=WindowFromPoint(p); string cls=Class(h), top=Class(GetAncestor(h,2));
        return cls=="SysListView32" && (top=="Progman" || top=="WorkerW") || cls=="Progman" || cls=="WorkerW" || top=="Progman" || top=="WorkerW";
    }
}








