using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

internal static class ClientShutdown
{
    [StructLayout(LayoutKind.Sequential)]
    struct RegisteredProcess
    {
        internal int Pid;
        internal System.Runtime.InteropServices.ComTypes.FILETIME Started;
    }

    [DllImport("rstrtmgr.dll",CharSet=CharSet.Unicode)]
    static extern uint RmStartSession(out uint handle,int flags,StringBuilder key);
    [DllImport("rstrtmgr.dll",CharSet=CharSet.Unicode)]
    static extern uint RmRegisterResources(uint handle,uint files,string[] filenames,uint apps,
        [In] RegisteredProcess[] processes,uint services,string[] serviceNames);
    [DllImport("rstrtmgr.dll")]
    static extern uint RmShutdown(uint handle,uint flags,IntPtr status);
    [DllImport("rstrtmgr.dll")]
    static extern uint RmEndSession(uint handle);

    static RegisteredProcess Identity(Process process)
    {
        long ticks=process.StartTime.ToUniversalTime().ToFileTimeUtc();
        return new RegisteredProcess{Pid=process.Id,Started=new System.Runtime.InteropServices.ComTypes.FILETIME{
            dwLowDateTime=unchecked((int)ticks),dwHighDateTime=(int)(ticks>>32)}};
    }

    internal static bool Wait(IEnumerable<Process> processes,int milliseconds)
    {
        var clock=Stopwatch.StartNew();
        foreach(var process in processes)
            if(!process.WaitForExit(Math.Max(0,milliseconds-(int)clock.ElapsedMilliseconds)))return false;
        return true;
    }

    static void RequestBackgroundExit(Process[] remaining)
    {
        if(remaining.Length==0)return;
        uint handle;
        uint error=RmStartSession(out handle,0,new StringBuilder(33));
        if(error!=0)throw new IOException("Windows 无法发起正常退出。错误代码 "+error+"。");
        try{
            var identities=remaining.Select(Identity).ToArray();
            error=RmRegisterResources(handle,0,null,(uint)identities.Length,identities,0,null);
            if(error==0)error=RmShutdown(handle,0,IntPtr.Zero);
            if(error!=0&&remaining.Any(p=>!p.HasExited))
                throw new IOException("Codex 未接受正常退出请求。请处理 Codex 的提示后重试。错误代码 "+error+"。");
        }finally{RmEndSession(handle);}
    }

    internal static void CloseApplications(Process[] processes,Process[] roots)
    {
        foreach(var root in roots)
            if(!root.HasExited)root.CloseMainWindow();
        if(Wait(processes,4000))return;

        var background=new List<Process>();
        foreach(var root in roots){
            if(root.HasExited)continue;
            root.Refresh();
            if(root.MainWindowHandle==IntPtr.Zero)background.Add(root);
        }
        RequestBackgroundExit(background.ToArray());
        if(!Wait(processes,7000))
            throw new IOException("仍有 Codex 进程运行。请确认 Codex 没有等待保存或退出确认，再重试。");
    }

    static bool HasOwner(int pid,Dictionary<int,int> parents,HashSet<int> owners)
    {
        var ancestors=new HashSet<int>();
        int parent;
        while(parents.TryGetValue(pid,out parent)&&ancestors.Add(parent)){
            if(owners.Contains(parent))return true;
            pid=parent;
        }
        return false;
    }

    internal static void ExitOfficialCodex()
    {
        var verified=new List<Process>();
        foreach(var process in Process.GetProcessesByName("ChatGPT")){
            if(Native.IsOfficialClient(process))verified.Add(process);else process.Dispose();
        }
        try{
            var parents=Native.ProcessParents();
            var ids=new HashSet<int>(verified.Select(p=>p.Id));
            var roots=verified.Where(p=>!parents.ContainsKey(p.Id)||!ids.Contains(parents[p.Id])).ToArray();
            // Only package-owned agent processes attached to these verified Codex instances.
            foreach(var process in Process.GetProcessesByName("codex")){
                try{
                    if(process.SessionId==Process.GetCurrentProcess().SessionId&&
                       HasOwner(process.Id,parents,ids)&&
                       process.MainModule.FileName.IndexOf("\\WindowsApps\\OpenAI.Codex_",StringComparison.OrdinalIgnoreCase)>=0){
                        verified.Add(process);continue;
                    }
                }catch(InvalidOperationException){}catch(System.ComponentModel.Win32Exception){}
                process.Dispose();
            }
            CloseApplications(verified.ToArray(),roots);
        }finally{foreach(var process in verified)process.Dispose();}
        foreach(var process in Process.GetProcessesByName("ChatGPT"))using(process){
            if(Native.IsOfficialClient(process))throw new IOException("仍有官方 Codex 实例开启，请在处理该窗口后重试。");
        }
    }

    static void Signal(string suffix)
    {
        try{using(var handle=EventWaitHandle.OpenExisting(Spider.Prefix+suffix))handle.Set();}
        catch(WaitHandleCannotBeOpenedException){}
    }

    internal static void StopSpiderHelpers(string installation,bool allCopies)
    {
        var helpers=new List<Process>();
        try{
            foreach(string name in new[]{"SpiderCodex","DesktopWallpaper","DesktopBoot","ResizeCompanion","版本管理","打开 Spider Codex","管理 Spider Codex","安装 Spider Codex"}){
                foreach(var process in Process.GetProcessesByName(name)){
                    try{
                        if(process.Id!=Process.GetCurrentProcess().Id&&process.SessionId==Process.GetCurrentProcess().SessionId){
                            string file=process.MainModule.FileName;
                            string version=FileVersionInfo.GetVersionInfo(file).ProductVersion;
                            if(version!=null&&version.StartsWith("SpiderCodex-",StringComparison.Ordinal)&&
                               (allCopies||file.StartsWith(installation.TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))){
                                helpers.Add(process);continue;
                            }
                        }
                    }catch(InvalidOperationException){}catch(System.ComponentModel.Win32Exception){}
                    process.Dispose();
                }
            }
            var ownedIds=new HashSet<int>(helpers.Select(p=>p.Id));
            var parents=Native.ProcessParents();
            var background=new List<Process>();
            foreach(string name in new[]{"node","msedgewebview2"})foreach(var process in Process.GetProcessesByName(name)){
                if(HasOwner(process.Id,parents,ownedIds))background.Add(process);else process.Dispose();
            }
            try{
                if(helpers.Any(p=>p.ProcessName=="DesktopWallpaper"))Signal("WallpaperStop");
                if(helpers.Any(p=>p.ProcessName=="SpiderCodex")){
                    Signal("CancelBoot");Signal("CloseSession");
                    if(allCopies){Signal("CancelBoot.qa");Signal("CloseSession.qa");}
                }
                foreach(var process in helpers)
                    if(!process.HasExited&&process.MainWindowHandle!=IntPtr.Zero&&
                       process.ProcessName!="DesktopWallpaper"&&process.ProcessName!="SpiderCodex")process.CloseMainWindow();
                if(!Wait(helpers.Concat(background),18000))throw new IOException("仍有 Spider Codex 后台组件正在收尾，稍后再试。");
            }finally{foreach(var process in background)process.Dispose();}
        }finally{foreach(var process in helpers)process.Dispose();}
    }
}
