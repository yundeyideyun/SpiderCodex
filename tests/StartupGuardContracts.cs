using System;using System.Diagnostics;using System.Runtime.InteropServices;using System.Threading;using System.Windows.Forms;
class StartupGuardContracts{
 delegate IntPtr WndProc(IntPtr h,uint m,IntPtr w,IntPtr l);
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct ClassInfo{public uint size,style;public WndProc proc;public int extra,windowExtra;public IntPtr instance,icon,cursor,background;public string menu,name;public IntPtr smallIcon;}
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern ushort RegisterClassEx(ref ClassInfo info);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern IntPtr CreateWindowEx(uint ex,string cls,string title,uint style,int x,int y,int width,int height,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr arg);
 [DllImport("user32.dll")]static extern IntPtr DefWindowProc(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")]static extern bool DestroyWindow(IntPtr h);
 static WndProc callback=DefWindowProc;
 static bool Until(Func<bool> condition){var clock=Stopwatch.StartNew();while(clock.ElapsedMilliseconds<4000){if(condition())return true;Thread.Sleep(20);}return false;}
 [STAThread]static void Main(){try{Run();}catch(Exception error){Console.Error.WriteLine(error.GetType().Name+": "+error.Message);Environment.ExitCode=1;}}
 static void Run(){
  string release="Local\\SpiderCodex.TestGuard."+Guid.NewGuid();
  Spider.Init();
  var info=new ClassInfo{size=(uint)Marshal.SizeOf(typeof(ClassInfo)),proc=callback,name="Chrome_WidgetWin_SpiderContract"};
  if(RegisterClassEx(ref info)==0)throw new Exception("Fixture class registration failed");
  IntPtr window=IntPtr.Zero,layered=IntPtr.Zero;const int preserved=0x08000080;Control dispatcher=null;var fixtureReady=new ManualResetEvent(false);Thread fixture=null;
  try{using(var guard=new StartupWindowGuard(release)){
   guard.Watch(new[]{Process.GetCurrentProcess().Id});
   fixture=new Thread(delegate(){
    window=CreateWindowEx(preserved,info.name,"Offscreen startup guard contract",0x80000000,-16000,-16000,640,480,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
    layered=CreateWindowEx(preserved|0x80000,info.name,"Existing layered surface contract",0x80000000,-16000,-16000,640,480,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
    if(layered!=IntPtr.Zero){Native.SetLayeredWindowAttributes(layered,0,120,2);Native.ShowWindow(layered,4);}
    dispatcher=new Control();var handle=dispatcher.Handle;fixtureReady.Set();Application.Run();
    if(window!=IntPtr.Zero)DestroyWindow(window);
    if(layered!=IntPtr.Zero)DestroyWindow(layered);
    dispatcher.Dispose();
   });fixture.IsBackground=true;fixture.SetApartmentState(ApartmentState.STA);fixture.Start();if(!fixtureReady.WaitOne(3000))throw new Exception("Fixture thread failed");
   if(window==IntPtr.Zero)throw new Exception("Fixture window creation failed");
   if(!Until(()=>{uint k,f;byte a;return Native.GetProp(window,Native.StartupOwnerProperty)!=IntPtr.Zero&&Native.GetLayeredWindowAttributes(window,out k,out a,out f)&&a==0;}))throw new Exception("New surface was not guarded");
   if(Native.GetProp(window,Native.StartupOwnerProperty)!=new IntPtr(Process.GetCurrentProcess().Id))throw new Exception("Owner was not marked");
   uint key,flags;byte alpha;if(!Native.GetLayeredWindowAttributes(window,out key,out alpha,out flags)||alpha!=0)throw new Exception("Guard did not hide the new surface");
   guard.Uncover(window);
   if(Native.GetProp(window,Native.StartupOpacityProperty)!=IntPtr.Zero||Native.GetProp(window,Native.StartupOwnerProperty)!=IntPtr.Zero)throw new Exception("Temporary properties were not removed");
   int restored=Native.GetWindowLong(window,-20);if((restored&preserved)!=preserved||(restored&0x80020)!=0)throw new Exception("Native styles were not restored");
   if(layered==IntPtr.Zero||!Until(()=>Native.GetProp(layered,Native.StartupHiddenProperty)!=IntPtr.Zero&&!Native.IsWindowVisible(layered)))
       throw new Exception("Pre-layered fallback was not hidden or marked");
   int owner=Process.GetCurrentProcess().Id;
   if(Native.ReleaseStartupSurface(layered,owner+1)||Native.IsWindowVisible(layered))throw new Exception("Wrong owner released a marked fallback");
   guard.Uncover(layered);
   if(!Native.IsWindowVisible(layered)||Native.GetProp(layered,Native.StartupHiddenProperty)!=IntPtr.Zero||
      !Native.GetLayeredWindowAttributes(layered,out key,out alpha,out flags)||alpha!=120)
       throw new Exception("The pre-layered native state was not restored");
  }
  Console.WriteLine(Spider.Json.Serialize(new{passed=true,checks=new[]{"new-offscreen-surface-hidden","owner-marked","temporary-properties-removed","existing-window-styles-preserved","pre-layered-fallback-marked","wrong-owner-refused","original-alpha-preserved"},officialClientInputs=0,officialClientTerminations=0}));
  }finally{if(dispatcher!=null&&!dispatcher.IsDisposed)dispatcher.BeginInvoke((Action)delegate{Application.ExitThread();});if(fixture!=null)fixture.Join(3000);fixtureReady.Dispose();}
 }
}
