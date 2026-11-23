using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

// Keep freshly launched native windows invisible before their first content paint.
// This runs only during startup and never watches another client's existing windows.
internal sealed class StartupWindowGuard : IDisposable {
    delegate void EventCallback(IntPtr hook,uint kind,IntPtr window,int objectId,int childId,uint thread,uint time);
    [DllImport("user32.dll")]static extern IntPtr SetWinEventHook(uint first,uint last,IntPtr module,EventCallback callback,uint process,uint thread,uint flags);
    [DllImport("user32.dll")]static extern bool UnhookWinEvent(IntPtr hook);
    [DllImport("user32.dll")]static extern bool GetLayeredWindowAttributes(IntPtr window,out uint key,out byte alpha,out uint flags);
    class Surface { internal bool released,visibleBeforeGuard,addedLayered,fallback; }
    readonly object sync=new object();readonly HashSet<int> allowed=new HashSet<int>();
    readonly Dictionary<IntPtr,Surface> surfaces=new Dictionary<IntPtr,Surface>();
    readonly ManualResetEvent initialized=new ManualResetEvent(false);readonly Stopwatch clock=Stopwatch.StartNew();
    readonly EventWaitHandle release;bool releasedAll;
    readonly Thread thread;Control dispatcher;System.Windows.Forms.Timer timer;EventCallback callback;IntPtr hook;Exception error;bool disposed;
    readonly string diagnosticName;
    readonly int ownerPid=Process.GetCurrentProcess().Id;
    internal StartupWindowGuard(string releaseEventName=null){diagnosticName=releaseEventName==null?"startup-window-guard.json":"startup-window-guard-test.json";release=new EventWaitHandle(false,EventResetMode.ManualReset,releaseEventName??Spider.Prefix+"StartupRelease");release.Reset();thread=new Thread(Run);thread.IsBackground=true;thread.SetApartmentState(ApartmentState.STA);thread.Start();if(!initialized.WaitOne(5000))throw new Exception("启动窗口防闪层未能就绪。");if(error!=null)throw new Exception("启动窗口防闪层初始化失败。",error);}
    internal void Watch(IEnumerable<int> ids){lock(sync)foreach(int id in ids)allowed.Add(id);}
    internal void Check(){if(error!=null)throw new Exception("启动窗口防闪层异常。",error);}
    void Inspect(IntPtr window){
        if(releasedAll)return;
        if(window==IntPtr.Zero||!Native.IsWindow(window)||Native.GetWindow(window,4)!=IntPtr.Zero||Native.GetAncestor(window,2)!=window||!Native.Class(window).StartsWith("Chrome_WidgetWin_"))return;
        uint pid;Native.GetWindowThreadProcessId(window,out pid);lock(sync)if(!allowed.Contains((int)pid))return;
        Surface surface;if(!surfaces.TryGetValue(window,out surface)){
            surface=new Surface{visibleBeforeGuard=Native.IsWindowVisible(window),addedLayered=(Native.GetWindowLong(window,-20)&0x80000)==0};
            surfaces.Add(window,surface);
            Spider.Log("startup","Window captured at "+clock.ElapsedMilliseconds+"ms; visibleBeforeGuard="+surface.visibleBeforeGuard+".");
        }
        if(surface.released)return;
        if(surface.addedLayered&&!surface.fallback){
            int original=Native.GetWindowLong(window,-20);IntPtr existing=Native.GetProp(window,Native.StartupOpacityProperty);int bits=existing==IntPtr.Zero?0x80000|((original&0x20)==0?0x20:0):existing.ToInt32();
            if(!Native.SetProp(window,Native.StartupOpacityProperty,new IntPtr(bits))){if(!Native.IsWindow(window))return;throw new System.ComponentModel.Win32Exception();}
            if(!Native.SetProp(window,Native.StartupOwnerProperty,new IntPtr(ownerPid))){Native.RemoveProp(window,Native.StartupOpacityProperty);throw new System.ComponentModel.Win32Exception();}
            Native.SetWindowLong(window,-20,original|0x80000|0x20);
            if(!Native.SetLayeredWindowAttributes(window,0,0,2)){
                int code=Marshal.GetLastWin32Error();if(!Native.IsWindow(window))return;
                // Electron may replace a transient surface while it is being created.
                // If it cannot support alpha composition, keep that surface hidden.
                surface.fallback=true;
                Native.SetWindowLong(window,-20,Native.GetWindowLong(window,-20)&~bits);Native.RemoveProp(window,Native.StartupOpacityProperty);Native.RemoveProp(window,Native.StartupOwnerProperty);
                Spider.Log("startup","Transient opacity fallback; class="+Native.Class(window)+"; error="+code+".");
            }
        }
        if(Native.IsWindowVisible(window)){

            if(!surface.addedLayered||surface.fallback){
                if(!Native.SetProp(window,Native.StartupOwnerProperty,new IntPtr(ownerPid)))throw new System.ComponentModel.Win32Exception();
                if(!Native.SetProp(window,Native.StartupHiddenProperty,new IntPtr(1))){
                    Native.RemoveProp(window,Native.StartupOwnerProperty);
                    throw new System.ComponentModel.Win32Exception();
                }
                Native.ShowWindow(window,0);
            }
        }
    }
    void Scan(){Native.EnumWindows(delegate(IntPtr window,IntPtr unused){Inspect(window);return true;},IntPtr.Zero);}
    void Restore(IntPtr window,Surface surface){
        if(!Native.IsWindow(window))return;
        surface.released=true;
        Native.ReleaseStartupSurface(window,ownerPid);
    }
    internal void Uncover(IntPtr window){Check();if(disposed||dispatcher==null)return;dispatcher.Invoke((Action)delegate{Surface surface;if(surfaces.TryGetValue(window,out surface))Restore(window,surface);});}
    void Run(){
        try{
            dispatcher=new Control();var handle=dispatcher.Handle;
            callback=delegate(IntPtr h,uint kind,IntPtr window,int objectId,int childId,uint eventThread,uint time){if(objectId==0&&childId==0)try{Inspect(window);}catch(Exception e){error=e;Spider.Log("startup","GUARD ERROR: "+e.Message);}};
            hook=SetWinEventHook(0x8000,0x8002,IntPtr.Zero,callback,0,0,2);if(hook==IntPtr.Zero)throw new System.ComponentModel.Win32Exception();
            timer=new System.Windows.Forms.Timer();timer.Interval=10;timer.Tick+=delegate{try{if(release.WaitOne(0)){releasedAll=true;foreach(var entry in surfaces)Restore(entry.Key,entry.Value);timer.Stop();return;}Scan();}catch(Exception e){error=e;Spider.Log("startup","GUARD ERROR: "+e.Message);}};timer.Start();initialized.Set();Application.Run();
        }catch(Exception e){error=e;initialized.Set();}
        finally{if(timer!=null)timer.Dispose();if(hook!=IntPtr.Zero)UnhookWinEvent(hook);foreach(var entry in surfaces)Restore(entry.Key,entry.Value);if(dispatcher!=null)dispatcher.Dispose();Spider.Write(diagnosticName,new{windows=surfaces.Count,capturedBeforeVisible=CountEarly(),hiddenFallbacks=CountFallback(),seconds=clock.Elapsed.TotalSeconds,error=error==null?null:error.Message});}
    }
    int CountFallback(){int count=0;foreach(var entry in surfaces)if(entry.Value.fallback)count++;return count;}
    int CountEarly(){int count=0;foreach(var entry in surfaces)if(!entry.Value.visibleBeforeGuard)count++;return count;}
    public void Dispose(){if(disposed)return;disposed=true;if(dispatcher!=null&&!dispatcher.IsDisposed)try{dispatcher.BeginInvoke((Action)delegate{Application.ExitThread();});}catch{}thread.Join(3000);initialized.Dispose();release.Dispose();}
}

