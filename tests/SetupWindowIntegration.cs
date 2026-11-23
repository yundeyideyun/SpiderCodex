using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using System.Web.Script.Serialization;

class SetupWindowIntegration
{
    [DllImport("user32.dll")]static extern IntPtr FindWindow(string cls,string title);
    [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint id);
    [DllImport("user32.dll")]static extern IntPtr GetDlgItem(IntPtr window,int id);
    [DllImport("user32.dll")]static extern bool PostMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
    static void MainThreadConfirm(object unused)
    {
        for(int n=0;n<60;n++){
            IntPtr box=FindWindow("#32770","Spider Codex");uint id;
            GetWindowThreadProcessId(box,out id);
            if(id==Process.GetCurrentProcess().Id){
                IntPtr ok=GetDlgItem(box,1);
                if(ok!=IntPtr.Zero && PostMessage(ok,0xf5,IntPtr.Zero,IntPtr.Zero))return;
            }
            Thread.Sleep(50);
        }
    }
    [STAThread]static void Main(string[] args)
    {
        string test=Path.GetFullPath(args[0]);if(Directory.Exists(test))throw new IOException("New fixture required.");
        string root=Path.Combine(test,"Programs","SpiderCodex"),desktop=Path.Combine(test,"Desktop");
        Directory.CreateDirectory(desktop);
        string payload=Path.GetFullPath(args[1]);int phase=0;
        bool withoutDesktop=args.Contains("--expect-desktop-warning");
        var clock=Stopwatch.StartNew();
        Exception problem=null;
        using(var timer=new System.Windows.Forms.Timer{Interval=100}){
            timer.Tick+=delegate{
                var form=Application.OpenForms.Cast<Form>().FirstOrDefault();
                if(form==null)return;
                try{
                    if(clock.Elapsed.TotalSeconds>45)throw new TimeoutException("Installer UI timed out, phase "+phase);
                    var buttons=form.Controls.OfType<Button>().ToList();
                    var install=buttons.Single(b=>b.Text=="安装或升级");var remove=buttons.Single(b=>b.Text=="卸载");
                    var check=buttons.Single(b=>b.Text=="检查环境");
                    if(!install.Enabled)return;
                    var full=form.Controls.OfType<RadioButton>().Single(b=>b.Text.StartsWith("完整体验"));
                    var light=form.Controls.OfType<RadioButton>().Single(b=>b.Text.StartsWith("轻量体验"));
                    var save=buttons.Single(b=>b.Text=="保存体验");
                    if(phase==0){if(!full.Checked||light.Checked)throw new Exception("Full experience should be the fresh-install default");phase=1;check.PerformClick();}
                    else if(phase==1){
                        bool showedExpectedStatus=form.Controls.OfType<Label>().Any(l=>withoutDesktop?
                            l.Text.Contains("可以安装或升级")&&l.Text.Contains("WebView2"):l.Text.Contains("检查通过"));
                        if(!showedExpectedStatus||
                           Directory.Exists(root)||File.Exists(Path.Combine(desktop,"Spider Codex.lnk")))
                            throw new Exception("Readiness button did not complete without modifying the install");
                        phase=2;install.PerformClick();
                    }
                    else if(phase==2 && remove.Enabled){
                        if(ReleasePointer.ReadExperience(root)!=true)throw new Exception("The installer did not save the chosen experience");
                        if(!File.Exists(Path.Combine(desktop,"Spider Codex.lnk")))throw new Exception("Desktop entry missing");
                        if(withoutDesktop&&!form.Controls.OfType<Label>().Any(l=>l.Text.Contains("WebView2")))
                            throw new Exception("Installer did not retain the optional dependency warning");
                        phase=7;light.Checked=true;save.PerformClick();
                    }else if(phase==7 && remove.Enabled){
                        if(ReleasePointer.ReadExperience(root)!=false)throw new Exception("The installer could not switch to lightweight mode");
                        phase=3;ThreadPool.QueueUserWorkItem(MainThreadConfirm);remove.PerformClick();
                    }else if(phase==3 && !remove.Enabled){phase=4;install.PerformClick();}
                    else if(phase==4 && remove.Enabled){phase=5;ThreadPool.QueueUserWorkItem(MainThreadConfirm);remove.PerformClick();}
                    else if(phase==5 && !remove.Enabled){phase=6;form.Close();}
                }catch(Exception ex){problem=ex;timer.Stop();Application.ExitThread();}
            };
            timer.Start();Application.EnableVisualStyles();SetupWindow.Show(root,desktop,payload);
        }
        if(problem!=null)throw problem;
        if(phase!=6||Directory.Exists(root)||File.Exists(Path.Combine(desktop,"Spider Codex.lnk")))throw new Exception("Uninstall incomplete");
        Console.WriteLine(new JavaScriptSerializer().Serialize(new{passed=true,preflightButton=true,preflightMadeNoInstallChanges=true,installButton=true,optionalDesktopRuntimeWarningExercised=withoutDesktop,uninstallButton=true,confirmationHandled=true,reinstalled=true,fullSelectedByDefault=true,lightSaved=true,rootRemoved=true,desktopCleared=true,officialClientInputs=0}));
    }
}
