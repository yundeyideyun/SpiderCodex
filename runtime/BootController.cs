using System;using System.Diagnostics;using System.Threading;using System.Windows.Forms;

// Startup is rendered by the actual GPU desktop layer; this process owns no overlay window.
class DesktopBoot {
 static void RecoverIfAbandoned(int owner,string id,EventWaitHandle abort){
  Native.RestoreStartupOpacity(owner);
  var current=Spider.Read("boot-request.json");
  object currentId;
  if(current.TryGetValue("id",out currentId)&&Convert.ToString(currentId)==id)abort.Set();
  Spider.Write("boot-recovery.json",new{id=id,ownerPid=owner,reason="launcher-exited",officialClientTerminated=false,at=DateTime.UtcNow.ToString("o")});
 }
 [STAThread]static void Main(string[] args){
  Spider.Init();string suffix=Spider.Arg(args,"--suffix","");
  try{
   int owner;long ownerStart;if(!int.TryParse(Spider.Arg(args,"--owner",""),out owner)||!long.TryParse(Spider.Arg(args,"--owner-start",""),out ownerStart))throw new Exception("启动控制归属信息缺失。");
   using(var process=Process.GetProcessById(owner)){
   if(process.HasExited||process.StartTime.ToUniversalTime().Ticks!=ownerStart||process.ProcessName!="SpiderCodex")throw new Exception("启动控制进程已结束。");
   var point=Cursor.Position;int n=Array.IndexOf(args,"--origin"),x,y;if(n>=0&&n+2<args.Length&&int.TryParse(args[n+1],out x)&&int.TryParse(args[n+2],out y))point=new System.Drawing.Point(x,y);
   var screen=Screen.FromPoint(point);var bounds=screen.Bounds;var area=SystemInformation.VirtualScreen;var working=screen.WorkingArea;string id=Guid.NewGuid().ToString("N");
   using(var cancel=EventWaitHandle.OpenExisting(Spider.Prefix+"CancelBoot"+suffix))
   using(var visible=EventWaitHandle.OpenExisting(Spider.Prefix+"WindowVisible"+suffix))
   using(var begin=EventWaitHandle.OpenExisting(Spider.Prefix+"WallpaperBootStart"))
   using(var abort=EventWaitHandle.OpenExisting(Spider.Prefix+"WallpaperBootAbort")){
    Spider.Write("boot-request.json",new{id=id,suffix=suffix,ownerPid=owner,ownerStartTicks=ownerStart,virtualBounds=new[]{area.X,area.Y,area.Width,area.Height},monitorCount=Screen.AllScreens.Length,screenWidthRatio=bounds.Width/(double)area.Width,origin=new[]{(point.X-area.Left)/(double)area.Width,(point.Y-area.Top)/(double)area.Height},target=new[]{(bounds.Left+bounds.Width*.4932-area.Left)/area.Width,(bounds.Top+bounds.Height*.4-area.Top)/area.Height},mask=new[]{(bounds.Left+bounds.Width*.4932-area.Left)/area.Width,(working.Top+working.Height*.5-area.Top)/area.Height}});begin.Set();
    var clock=Stopwatch.StartNew();bool finished=false;
    while(clock.ElapsedMilliseconds<65000){
     if(process.HasExited){RecoverIfAbandoned(owner,id,abort);return;}
     if(cancel.WaitOne(0)){abort.Set();return;}
     var latest=Spider.Read("boot-request.json");object newer;if(latest.TryGetValue("id",out newer)&&(string)newer!=id)return;
     var state=Spider.Read("boot-state.json");object current,status;
     if(state.TryGetValue("id",out current)&&(string)current==id&&state.TryGetValue("status",out status)){
      if((string)status=="finished"){finished=true;break;}
      if((string)status=="error")throw new Exception("GPU 开场绘制失败，请查看 boot-state.json。");
     }
     Thread.Sleep(25);
    }
    if(!finished){abort.Set();throw new Exception("GPU 开场等待超时。");}
    var handoffClock=Stopwatch.StartNew();
    while(handoffClock.ElapsedMilliseconds<12000){
     if(process.HasExited){RecoverIfAbandoned(owner,id,abort);return;}
     if(WaitHandle.WaitAny(new WaitHandle[]{visible,cancel},100)!=WaitHandle.WaitTimeout)return;
    }
    throw new Exception("真实窗口交接超时。");
   }
   }
  }catch(Exception error){Spider.Log("boot",error.ToString());Spider.Write("boot-error.json",new{error=error.ToString(),renderer="GPU desktop",at=DateTime.UtcNow.ToString("O")});try{using(var cancel=EventWaitHandle.OpenExisting(Spider.Prefix+"CancelBoot"+suffix))cancel.Set();}catch{}Environment.ExitCode=1;}
 }
}
