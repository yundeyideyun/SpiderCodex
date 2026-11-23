using System;using System.Diagnostics;using System.Threading;
// This helper owns only the temporary resize surface, never a client process.
class ResizeCompanion {
 [STAThread]static void Main(string[] args){
  Spider.Init();int owner;int.TryParse(Spider.Arg(args,"--owner","0"),out owner);if(owner<=0)return;string suffix=Spider.Arg(args,"--suffix","");
  using(var mutex=new Mutex(false,Spider.Prefix+"ResizeCompanion"+suffix)){
   bool locked=false;ResizePreview preview=null;
   try{try{locked=mutex.WaitOne(3000);}catch(AbandonedMutexException){locked=true;}if(!locked)return;
    while(true){
     var state=Spider.Read("session"+suffix+".json");object value;if(!state.TryGetValue("pid",out value)||Convert.ToInt32(value)!=owner||!state.ContainsKey("status")||(string)state["status"]!="visible")break;
     try{using(var monitor=Process.GetProcessById(owner)){if(monitor.MainModule.FileName!=System.IO.Path.Combine(Spider.Root,"SpiderCodex.exe"))break;}}catch{break;}
     if(state.ContainsKey("port")&&System.IO.File.Exists(Spider.FileAt("theme-disabled-"+Convert.ToInt32(state["port"])+".json"))){if(preview!=null)preview.Track(IntPtr.Zero);Thread.Sleep(200);continue;}
     IntPtr h=IntPtr.Zero;if(state.TryGetValue("window",out value))h=new IntPtr(Convert.ToInt64(value));
     uint pid;Native.GetWindowThreadProcessId(h,out pid);
     if(h!=IntPtr.Zero&&Native.IsWindow(h)&&Native.GetProp(h,"SpiderCodex.PrimaryWindow.v3")==new IntPtr(owner)&&state.ContainsKey("port")&&Native.LoopbackListener(Convert.ToInt32(state["port"]))==(int)pid){if(preview==null)preview=new ResizePreview(h,suffix);else preview.Track(h);}else if(preview!=null)preview.Track(IntPtr.Zero);
     Thread.Sleep(200);
    }
   }catch(Exception e){Spider.Log("resize-preview",e.Message);}finally{if(preview!=null){preview.Stop();Thread.Sleep(150);}if(locked)mutex.ReleaseMutex();}
  }
 }
}
