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
    [DllImport("user32.dll")]static extern IntPtr FindWindowEx(IntPtr parent,IntPtr after,string cls,string title);
    [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint id);
    [DllImport("user32.dll")]static extern IntPtr GetDlgItem(IntPtr window,int id);
    [DllImport("user32.dll")]static extern bool PostMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
    [DllImport("user32.dll")]static extern bool IsWindowEnabled(IntPtr window);

    static bool CloseConfirmation(string title,int button)
    {
        for(int n=0;n<240;n++){
            IntPtr box=IntPtr.Zero;
            while((box=FindWindowEx(IntPtr.Zero,box,"#32770",title))!=IntPtr.Zero){
                uint id;
                GetWindowThreadProcessId(box,out id);
                if(id!=Process.GetCurrentProcess().Id)continue;
                // The result dialog has one button; Windows can give it a
                // different control ID across themes and system languages.
                IntPtr choice=title=="卸载完成"?FindWindowEx(box,IntPtr.Zero,"Button",null):GetDlgItem(box,button);
                if(choice!=IntPtr.Zero&&PostMessage(choice,0xf5,IntPtr.Zero,IntPtr.Zero))return true;
            }
            Thread.Sleep(50);
        }
        return false;
    }

    [STAThread]static int Main(string[] args)
    {
        if(args[0]=="--exit-fixture"){
            Application.Run(new Form{Text="Isolated Spider Codex exit test",StartPosition=FormStartPosition.Manual,Location=new System.Drawing.Point(-4000,-4000)});
            return 0;
        }
        string test=Path.GetFullPath(args[0]);
        if(Directory.Exists(test))throw new IOException("New fixture required.");
        string root=Path.Combine(test,"Programs","SpiderCodex"),desktop=Path.Combine(test,"Desktop");
        string shortcut=Path.Combine(desktop,"Spider Codex.lnk");
        string alternate=Path.Combine(desktop,"Spider Codex (主题版).lnk");
        Directory.CreateDirectory(desktop);
        string payload=Path.GetFullPath(args[1]);
        Application.EnableVisualStyles();
        int declined=0;
        ThreadPool.QueueUserWorkItem(delegate{if(CloseConfirmation("安装 Spider Codex",7))Interlocked.Increment(ref declined);});
        SetupWindow.Show(root,desktop,payload,installOnShow:true);
        if(declined!=1||Directory.Exists(root)||File.Exists(shortcut))throw new Exception("Declining first install changed the system");
        int phase=0,openRequests=0,exitRequests=0,installPrompt=0,installConfirm=0,uninstallResults=0,uninstallCancelled=0;
        int repairRuns=0,repairApplied=0;
        byte[] otherLink=null;
        string openedPath=null;
        bool? experienceAtOpen=null;
        bool withoutDesktop=args.Contains("--expect-desktop-warning");
        var clock=Stopwatch.StartNew();
        Exception problem=null;
        using(var timer=new System.Windows.Forms.Timer{Interval=100}){
            timer.Tick+=delegate{
                var form=Application.OpenForms.Cast<Form>().FirstOrDefault();
                if(form==null)return;
                try{
                    if(clock.Elapsed.TotalSeconds>40)throw new TimeoutException("Installer UI timed out. Dialogs acknowledged: "+
                        uninstallResults+"; labels: "+string.Join(" | ",form.Controls.OfType<Label>().Select(l=>l.Text)));
                    var buttons=form.Controls.OfType<Button>().ToList();
                    var primary=(Button)form.AcceptButton;
                    var exit=buttons.Single(b=>b.Text=="退出 Codex");
                    var cancelRepair=buttons.Single(b=>b.Text=="取消修复");
                    var more=form.Controls.OfType<LinkLabel>().Single(l=>l.Text=="设置与卸载");
                    var remove=more.ContextMenuStrip.Items.OfType<ToolStripMenuItem>().Single(i=>i.Text=="卸载 Spider Codex");
                    var repair=more.ContextMenuStrip.Items.OfType<ToolStripMenuItem>().Single(i=>i.Text=="修复兼容性");
                    var modes=more.ContextMenuStrip.Items.OfType<ToolStripMenuItem>().Single(i=>i.Text=="启动效果");
                    var full=modes.DropDownItems.OfType<ToolStripMenuItem>().Single(b=>b.Text.StartsWith("皮肤、"));
                    var light=modes.DropDownItems.OfType<ToolStripMenuItem>().Single(b=>b.Text.StartsWith("只用"));
                    var locate=more.ContextMenuStrip.Items.OfType<ToolStripMenuItem>().Single(i=>i.Text.Contains("桌面图标"));
                    if(phase==24&&cancelRepair.Visible&&IsWindowEnabled(form.Handle)){cancelRepair.PerformClick();phase=25;return;}
                    if(!primary.Enabled||!IsWindowEnabled(form.Handle))return;
                    if(phase==0){
                        if(!full.Checked||light.Checked||exit.Visible||more.Visible||primary.Text!="安装 Spider Codex")
                            throw new Exception("Incorrect fresh-install controls");
                        phase=1;
                        ThreadPool.QueueUserWorkItem(delegate{
                            if(CloseConfirmation("安装 Spider Codex",6))Interlocked.Increment(ref installConfirm);
                            if(CloseConfirmation("安装完成",7))Interlocked.Increment(ref installPrompt);
                        });
                        primary.PerformClick();
                    }else if(phase==1){
                        if(Thread.VolatileRead(ref installPrompt)!=1)return;
                        if(!exit.Visible||!more.Visible||locate.Text!="定位桌面图标"||primary.Text!="打开 Spider Codex")
                            throw new Exception("Incorrect installed controls");
                        if(ReleasePointer.ReadExperience(root)!=true||!File.Exists(shortcut)||openRequests!=0)
                            throw new Exception("Fresh installation did not create a shortcut without opening the client");
                        if(withoutDesktop&&!form.Controls.OfType<Label>().Any(l=>l.Text.Contains("WebView2")))
                            throw new Exception("Automatic preflight did not report the optional dependency");
                        var setup=new UserSetup(root,desktop);
                        File.Delete(shortcut);
                        if(setup.HasDesktopShortcut||!setup.EnsureDesktopShortcut()||!setup.HasDesktopShortcut)
                            throw new Exception("Missing desktop shortcut was not repaired");
                        light.PerformClick();
                        if(primary.Text!="应用并打开")throw new Exception("Switching experience did not change the primary action");
                        phase=2;primary.PerformClick();
                    }else if(phase==2){
                        if(ReleasePointer.ReadExperience(root)!=false||openRequests!=1||experienceAtOpen!=false||
                           openedPath!=Path.Combine(root,"SpiderCodex.exe")||primary.Text!="打开 Spider Codex")
                            throw new Exception("Apply and open did not save before opening the stable launcher");
                        phase=22;primary.PerformClick();
                    }else if(phase==22){
                        phase=222;
                        ThreadPool.QueueUserWorkItem(delegate{CloseConfirmation("修复兼容性",1);});
                        repair.PerformClick();phase=23;
                    }else if(phase==23){
                        if(repairRuns!=1||repairApplied!=0||!form.Controls.OfType<Label>().Any(l=>l.Text.Contains("隔离修复失败")))
                            throw new Exception("Failed repair did not preserve the current version");
                        phase=223;
                        ThreadPool.QueueUserWorkItem(delegate{CloseConfirmation("修复兼容性",1);});
                        repair.PerformClick();phase=24;
                    }else if(phase==25){
                        if(repairRuns!=2||repairApplied!=0||!form.Controls.OfType<Label>().Any(l=>l.Text.Contains("已取消修复")))
                            throw new Exception("Cancel did not preserve the current version");
                        phase=225;
                        ThreadPool.QueueUserWorkItem(delegate{CloseConfirmation("修复兼容性",1);CloseConfirmation("应用修复",6);});
                        repair.PerformClick();phase=26;
                    }else if(phase==26){
                        if(repairApplied!=1)return;
                        primary.PerformClick();
                        phase=27;
                    }else if(phase==27){
                        string saved=form.Controls.OfType<Label>().Single(l=>l.Text.StartsWith("官方 Codex 已在运行")).Text;
                        if(openRequests!=3||!saved.Contains("文件 → 退出"))
                            throw new Exception("The installer did not show the existing client status");
                        phase=20;ThreadPool.QueueUserWorkItem(delegate{CloseConfirmation("退出 Codex",2);});
                        exit.PerformClick();
                        if(!form.Controls.OfType<Label>().Any(l=>l.Text==saved))throw new Exception("Cancelling exit changed the installer status");
                        phase=21;ThreadPool.QueueUserWorkItem(delegate{CloseConfirmation("退出 Codex",1);});
                        exit.PerformClick();phase=3;
                    }else if(phase==3){
                        if(exitRequests!=1||!form.Controls.OfType<Label>().Any(l=>l.Text=="隔离测试：退出未完成"))
                            throw new Exception("The exit control did not surface the targeted action outcome");
                        var setup=new UserSetup(root,desktop);
                        string receipt=Path.Combine(root,"receipts","shortcut.sha256");
                        File.WriteAllText(receipt,new string('0',64));
                        if(!setup.HasDesktopShortcut)throw new Exception("Owned link must not depend on an old digest");
                        phase=30;ThreadPool.QueueUserWorkItem(delegate{if(CloseConfirmation("卸载 Spider Codex",7))Interlocked.Increment(ref uninstallCancelled);});
                        remove.PerformClick();
                        if(uninstallCancelled!=1||!setup.Managed||!File.Exists(shortcut))
                            throw new Exception("Declining uninstall changed the installation");
                        phase=31;
                        ThreadPool.QueueUserWorkItem(delegate{
                            CloseConfirmation("卸载 Spider Codex",6);
                            if(CloseConfirmation("卸载完成",1))Interlocked.Increment(ref uninstallResults);
                        });
                        remove.PerformClick();phase=4;
                    }else if(phase==4){
                        if(Thread.VolatileRead(ref uninstallResults)!=1)return;
                        if(exit.Visible||Directory.Exists(root)||File.Exists(shortcut))throw new Exception("Uninstall incomplete");
                        dynamic shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
                        dynamic unrelated=shell.CreateShortcut(shortcut);
                        unrelated.TargetPath=Path.Combine(Environment.SystemDirectory,"notepad.exe");
                        unrelated.Save();
                        otherLink=File.ReadAllBytes(shortcut);
                        phase=5;
                        ThreadPool.QueueUserWorkItem(delegate{
                            if(CloseConfirmation("安装 Spider Codex",6))Interlocked.Increment(ref installConfirm);
                            if(CloseConfirmation("安装完成",6))Interlocked.Increment(ref installPrompt);
                        });
                        primary.PerformClick();
                    }else if(phase==5){
                        if(Thread.VolatileRead(ref installPrompt)!=2)return;
                        if(openRequests<4)return;
                        if(!exit.Visible||!File.Exists(alternate)||!File.ReadAllBytes(shortcut).SequenceEqual(otherLink))
                            throw new Exception("Install did not preserve the occupied name and create a themed shortcut");
                        if(openRequests!=4)throw new Exception("Accepting the post-install prompt did not open the launcher");
                        phase=50;ThreadPool.QueueUserWorkItem(delegate{
                            CloseConfirmation("卸载 Spider Codex",6);
                            if(CloseConfirmation("卸载完成",1))Interlocked.Increment(ref uninstallResults);
                        });
                        remove.PerformClick();phase=6;
                    }else if(phase==6){
                        if(Thread.VolatileRead(ref uninstallResults)!=2)return;
                        if(exit.Visible||Directory.Exists(root)||File.Exists(alternate)||!File.ReadAllBytes(shortcut).SequenceEqual(otherLink))
                            throw new Exception("Uninstall did not preserve the unrelated shortcut");
                        phase=7;form.Close();
                    }
                }catch(Exception error){problem=error;timer.Stop();Application.ExitThread();}
            };
            timer.Start();
            Application.EnableVisualStyles();
            SetupWindow.Show(root,desktop,payload,launcher=>{
                openedPath=launcher;
                experienceAtOpen=ReleasePointer.ReadExperience(root);
                openRequests++;
                return (openRequests==2||openRequests==3)?SetupWindow.LaunchStatusMessage(new System.Collections.Generic.Dictionary<string,object>{{"status","native-existing"}}):null;
            },()=>{exitRequests++;throw new IOException("隔离测试：退出未完成");},new UserSetup(root,desktop).Uninstall,
            prepareRepair:token=>{
                int attempt=Interlocked.Increment(ref repairRuns);
                if(attempt==1)throw new IOException("隔离修复失败");
                if(attempt==2){token.WaitHandle.WaitOne(12000);token.ThrowIfCancellationRequested();throw new IOException("没有收到取消");}
                return new CompatibilityRepair.Preset{version="26.1120.5083.0",mainAttribute="data-new-main",composerAttribute="data-new-composer"};
            },
            applyRepair:preset=>{if(preset.composerAttribute!="data-new-composer")throw new IOException("Unexpected repair");Interlocked.Increment(ref repairApplied);});
        }
        string existing=SetupWindow.LaunchStatusMessage(new System.Collections.Generic.Dictionary<string,object>{{"status","native-existing"}});
        string updated=SetupWindow.LaunchStatusMessage(new System.Collections.Generic.Dictionary<string,object>{{"status","official-update"},{"wallpaperStatus","ready"}});
        if(updated==null||!updated.Contains("无需重装")||!updated.Contains("动态壁纸已启动"))
            throw new Exception("Official update fallback status is unclear");
        foreach(string outcome in new[]{"ready","unavailable","starting"}){
            int reads=0;
            string final=SetupWindow.WaitForLaunchStatus(()=>new System.Collections.Generic.Dictionary<string,object>{
                {"status","official-update"},{"wallpaperStatus",++reads==1?"starting":outcome}},100,300);
            string expected=outcome=="ready"?"动态壁纸已启动":outcome=="unavailable"?"动态壁纸未能启动":"暂未收到动态壁纸的启动结果";
            if(final==null||!final.Contains(expected)||reads<2)throw new Exception("Wallpaper startup result was stale: "+outcome);
        }
        if(problem!=null||phase!=7||installConfirm!=2||existing==null||!existing.Contains("文件 → 退出")){
            Console.Error.WriteLine("Installer UI phase "+phase+": "+(problem==null?"Did not reach completion":problem.Message));
            return 1;
        }
        VerifyScopedExit();
        Console.WriteLine(new JavaScriptSerializer().Serialize(new{passed=true,firstRunOnlyInstall=true,installConfirmationShown=true,installCancellationLeavesNoFiles=true,automaticPreflight=true,optionalDesktopRuntimeWarningExercised=withoutDesktop,shortcutCreated=true,missingShortcutRepaired=true,legacyOwnedShortcutRemoved=true,collidingShortcutUntouched=true,alternateShortcutCreatedAndRemoved=true,applyAndOpen=true,existingClientStatusExplained=true,installOffersToOpen=true,declineDoesNotOpen=true,exitCancelKeepsState=true,exitActionReported=true,isolatedProcessExitVerified=true,nonTargetProcessPreserved=true,uninstallConfirmationAndCompletionShown=true,uninstallCancellationPreservedFiles=true,uninstallAndReinstall=true,officialClientInputs=0}));
        return 0;
    }
    static void VerifyScopedExit()
    {
        string exe=Process.GetCurrentProcess().MainModule.FileName;
        var info=new ProcessStartInfo(exe,"--exit-fixture"){UseShellExecute=false,CreateNoWindow=true};
        using(var selected=Process.Start(info))
        using(var other=Process.Start(info)){
            try{
                var wait=Stopwatch.StartNew();
                while(wait.ElapsedMilliseconds<5000){
                    selected.Refresh();other.Refresh();
                    if(selected.MainWindowHandle!=IntPtr.Zero&&other.MainWindowHandle!=IntPtr.Zero)break;
                    Thread.Sleep(40);
                }
                if(selected.MainWindowHandle==IntPtr.Zero||other.MainWindowHandle==IntPtr.Zero)
                    throw new Exception("Isolated application windows were not ready");
                ClientShutdown.CloseApplications(new[]{selected},new[]{selected});
                if(!selected.HasExited||other.HasExited)throw new Exception("Isolated application exit exceeded its scope");
            }finally{
                foreach(var p in new[]{selected,other})
                    if(!p.HasExited){p.CloseMainWindow();p.WaitForExit(3000);}
            }
        }
    }
}
