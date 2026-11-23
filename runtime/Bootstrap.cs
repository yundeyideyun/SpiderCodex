using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

// Stable desktop entry. The installation selects its versioned application.
class Bootstrap {
    [DllImport("user32.dll")] static extern bool AllowSetForegroundWindow(int processId);

    static void ActivateExisting(string target){
        try{
            var session=Spider.Read("session.json");
            if(!session.ContainsKey("status")||!Equals(session["status"],"visible"))return;
            var attachment=Spider.Read("attachment.json");
            int monitorId=Convert.ToInt32(session["pid"]), port=Convert.ToInt32(session["port"]);
            int clientId=Convert.ToInt32(attachment["clientPid"]);
            if(monitorId<=0||clientId<=0||port<1024||port>65535||!Equals(attachment["profileKey"],"")||
                Convert.ToInt32(attachment["monitorPid"])!=monitorId||Convert.ToInt32(attachment["port"])!=port)return;
            using(var monitor=Process.GetProcessById(monitorId))
            using(var client=Process.GetProcessById(clientId)){
                if(!string.Equals(monitor.MainModule.FileName,target,StringComparison.OrdinalIgnoreCase)||
                    !Native.IsOfficialClient(client)||client.StartTime.ToUniversalTime().Ticks!=Convert.ToInt64(attachment["createdTicks"])||
                    Native.LoopbackListener(port)!=clientId)return;
                var window=new IntPtr(Convert.ToInt64(session["window"]));
                uint owner;
                if(!Native.IsWindow(window)||Native.GetWindowThreadProcessId(window,out owner)==0||owner!=clientId||
                    Native.Class(window)!="Chrome_WidgetWin_1"||Native.GetProp(window,"SpiderCodex.PrimaryWindow.v3")!=new IntPtr(monitorId))return;
                // The shell can give the transient shortcut process permission to activate the window.
                // Hand that permission to the verified monitor before it receives the normal reopen event.
                AllowSetForegroundWindow(monitorId);
                if(Native.IsIconic(window))Native.ShowWindow(window,9);
                if(Native.IsWindowVisible(window))Native.SetForegroundWindow(window);
            }
        }catch(Exception){
            // A missing or transitioning window still uses the regular release entry.
        }
    }

    [STAThread]static void Main(string[] args){
        try{
            string entry=Path.GetFileName(Process.GetCurrentProcess().MainModule.FileName).Equals("恢复原界面和桌面.exe",StringComparison.OrdinalIgnoreCase)?"恢复原界面和桌面.exe":"SpiderCodex.exe";
            string target=ReleasePointer.VerifiedEntry(Spider.Root,entry);
            if(entry=="SpiderCodex.exe"&&args.Length==0)ActivateExisting(target);
            using(var child=ReleasePointer.Start(target,args)){}
        }catch(Exception error){
            MessageBox.Show("无法打开当前发行版本。"+Environment.NewLine+error.Message+Environment.NewLine+"现有官方客户端没有被关闭或重启。","Spider Codex",MessageBoxButtons.OK,MessageBoxIcon.Warning);
            Environment.ExitCode=1;
        }
    }
}
