using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class SetupWindow
{
    [STAThread] static void Main()
    {
        Application.EnableVisualStyles();
        string root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","SpiderCodex");
        string payload=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"payload");
        string desktop=Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        try{
            var setup=new UserSetup(root,desktop);
            bool openEntry=Path.GetFileName(Application.ExecutablePath).Equals("打开 Spider Codex.exe",StringComparison.OrdinalIgnoreCase);
            if(openEntry&&setup.Installed){
                string result=OpenInstalled(setup.InstalledLauncher());
                if(result!=null&&!result.StartsWith("Spider Codex 已打开。",StringComparison.Ordinal))
                    MessageBox.Show(result,"Spider Codex",MessageBoxButtons.OK,MessageBoxIcon.Information);
                return;
            }
            if(!setup.Installed){
                if(!File.Exists(Path.Combine(payload,"release-manifest.json"))){
                    MessageBox.Show("请先把整个 ZIP 解压到一个文件夹，再打开 Spider Codex。","Spider Codex",MessageBoxButtons.OK,MessageBoxIcon.Information);
                    return;
                }
            }
            Show(root,desktop,payload,installOnShow:!setup.Installed);
        }
        catch(Exception error){MessageBox.Show(error.Message,"无法打开 Spider Codex 安装程序",MessageBoxButtons.OK,MessageBoxIcon.Warning);}
    }

    internal static void Show(string root,string desktop,string payload,Func<string,string> openInstalled=null,
        Func<string> exitBoth=null,Func<string> uninstall=null,bool installOnShow=false,
        Func<CancellationToken,CompatibilityRepair.Preset> prepareRepair=null,Action<CompatibilityRepair.Preset> applyRepair=null)
    {
        var setup=new UserSetup(root,desktop);
        if(openInstalled==null)openInstalled=OpenInstalled;
        if(exitBoth==null)exitBoth=setup.ExitClient;
        if(uninstall==null)uninstall=setup.UninstallApplication;
        if(prepareRepair==null)prepareRepair=CompatibilityRepair.Prepare;
        if(applyRepair==null)applyRepair=preset=>CompatibilityRepair.Apply(Spider.State,preset,InstalledClient.Resolve().Version);
        using(var bodyFont=new Font("Microsoft YaHei UI",10))
        using(var form=new Form{Text="Spider Codex",Font=bodyFont,ClientSize=new Size(510,256),AutoScaleDimensions=new SizeF(96,96),AutoScaleMode=AutoScaleMode.Dpi,FormBorderStyle=FormBorderStyle.FixedDialog,MaximizeBox=false,StartPosition=FormStartPosition.CenterScreen})
        using(var titleFont=new Font("Segoe UI",18,FontStyle.Bold))
        using(var options=new ContextMenuStrip())
        {
            var heading=new Label{Text="Spider Codex",Font=titleFont,Left=22,Top=19,Width=466,Height=38};
            var description=new Label{Left=22,Top=63,Width=466,Height=28};
            var status=new Label{Left=22,Top=103,Width=466,Height=82};
            var primary=new Button{Left=22,Top=202,Width=174,Height=34};
            var exitClient=new Button{Text="退出 Codex",Left=207,Top=202,Width=103,Height=34};
            var more=new LinkLabel{Text="设置与卸载",TextAlign=ContentAlignment.MiddleRight,Left=348,Top=202,Width=140,Height=34,ContextMenuStrip=options};
            var experience=new ToolStripMenuItem("启动效果");
            var full=new ToolStripMenuItem("皮肤、动态壁纸和开场");
            var light=new ToolStripMenuItem("只用客户端皮肤");
            experience.DropDownItems.AddRange(new ToolStripItem[]{full,light});
            var locate=new ToolStripMenuItem("桌面图标");
            var update=new ToolStripMenuItem("更新 Spider Codex");
            var repair=new ToolStripMenuItem("修复兼容性");
            var undoRepair=new ToolStripMenuItem("撤销兼容修复");
            var cancelRepair=new Button{Text="取消修复",Left=207,Top=202,Width=103,Height=34,Visible=false};
            var restore=new ToolStripMenuItem("切回官方外观");
            var remove=new ToolStripMenuItem("卸载 Spider Codex");
            options.Items.AddRange(new ToolStripItem[]{experience,locate,restore,repair,undoRepair,update,new ToolStripSeparator(),remove});
            bool? selected=null;
            try{selected=setup.Experience;}catch(IOException){}catch(UnauthorizedAccessException){}
            bool chosenFull=selected??!setup.Installed;
            bool hasPayload=File.Exists(Path.Combine(payload,"release-manifest.json"));
            bool busy=false;
            CancellationTokenSource repairCancellation=null;
            Action refresh=delegate {
                bool managed=setup.Installed;
                primary.Text=!managed?"安装 Spider Codex":selected==chosenFull?"打开 Spider Codex":"应用并打开";
                primary.Enabled=!busy && (managed||hasPayload);
                exitClient.Visible=managed&&repairCancellation==null;
                more.Visible=managed;
                cancelRepair.Visible=repairCancellation!=null;
                repair.Enabled=!busy&&managed;
                undoRepair.Visible=File.Exists(Spider.FileAt("layout-repair.json"));
                undoRepair.Enabled=!busy&&managed;
                exitClient.Enabled=more.Enabled=!busy;
                description.Text=managed?(chosenFull?"启动设置 · 皮肤、动态壁纸和开场":"启动设置 · 只用客户端皮肤"):
                    "给官方 Codex 添加主题，保留你原来的账号和聊天。";
                locate.Text=managed&&setup.HasDesktopShortcut?"定位桌面图标":"创建桌面图标";
                locate.Enabled=!busy && managed;
                update.Enabled=!busy && managed && hasPayload;
                restore.Enabled=!busy && managed && File.Exists(Path.Combine(root,"恢复原界面和桌面.exe"));
                remove.Enabled=!busy && managed;
                full.Checked=chosenFull;
                light.Checked=!chosenFull;
            };
            full.Click+=delegate{chosenFull=true;refresh();};
            light.Click+=delegate{chosenFull=false;refresh();};
            Func<string,Func<string>,Task<bool>> perform=async (working,action)=>{
                if(busy)return false;
                busy=true;refresh();status.Text=working;
                try{
                    status.Text=await Task.Run(()=>setup.RunExclusive(action));
                    selected=setup.Experience;
                    return true;
                }catch(Exception ex){
                    status.Text=ex.Message;
                    return false;
                }
                finally{busy=false;refresh();}
            };
            Func<bool,string> install=fullEffects=>{
                string warning="";
                setup.Install(payload,source=>warning=Diagnostics.InstallEnvironmentMessage(source),fullEffects);
                string installed="已安装。桌面图标是「"+Path.GetFileNameWithoutExtension(setup.DesktopShortcut)+"」。";
                return warning.Length==0?installed:installed+Environment.NewLine+warning;
            };
            primary.Click+=async delegate{
                bool fullEffects=chosenFull;
                if(!setup.Installed){
                    if(MessageBox.Show(form,"这台电脑还没安装 Spider Codex。要安装并创建桌面图标吗？","安装 Spider Codex",
                        MessageBoxButtons.YesNo,MessageBoxIcon.Question,MessageBoxDefaultButton.Button2)!=DialogResult.Yes){
                        if(installOnShow)form.Close();
                        return;
                    }
                    bool installed=await perform("正在检查并安装 Spider Codex…",()=>install(fullEffects));
                    if(installed&&MessageBox.Show(form,status.Text+Environment.NewLine+"现在打开 Spider Codex 吗？","安装完成",
                        MessageBoxButtons.YesNo,MessageBoxIcon.Question,MessageBoxDefaultButton.Button2)==DialogResult.Yes)
                        await perform("正在打开 Spider Codex…",()=>openInstalled(setup.InstalledLauncher())??"已请求打开 Spider Codex。");
                    return;
                }
                await perform("正在打开 Spider Codex…",()=>{
                    string launcher=setup.InstalledLauncher();
                    bool changed=selected!=fullEffects;
                    if(changed)setup.SaveExperience(fullEffects);
                    string launchStatus=openInstalled(launcher);
                    if(launchStatus!=null)return launchStatus;
                    if(changed&&fullEffects)return "已应用设置并请求打开。蛛丝开场在 Codex 完整启动时播放。";
                    return changed?"已应用设置并请求打开 Spider Codex。":"已请求打开 Spider Codex。";
                });
            };
            locate.Click+=async delegate{
                await perform("正在查找桌面图标…",()=>{
                    setup.EnsureDesktopShortcut();
                    using(var process=Process.Start("explorer.exe","/select,"+Spider.Quote(setup.DesktopShortcut))){}
                    return "已在资源管理器中选中 Spider Codex 的桌面图标。";
                });
            };
            more.LinkClicked+=delegate{options.Show(more,new Point(0,more.Height));};
            exitClient.Click+=async delegate{
                if(MessageBox.Show(form,"这会退出当前 Windows 会话中的官方 Codex 和 Spider Codex，包括桌面壁纸。请先等任务完成并保存草稿。","退出 Codex",MessageBoxButtons.OKCancel,MessageBoxIcon.Question,MessageBoxDefaultButton.Button2)==DialogResult.OK)
                    if(await perform("等待 Codex 和 Spider Codex 退出…",exitBoth))form.Close();
            };
            update.Click+=async delegate{bool fullEffects=chosenFull;await perform("正在检查更新包…",()=>install(fullEffects));};
            cancelRepair.Click+=delegate{if(repairCancellation!=null){repairCancellation.Cancel();status.Text="正在取消。原有版本保留。";}};
            repair.Click+=async delegate{
                if(MessageBox.Show(form,"Codex 会根据本机记录的界面标记尝试修复皮肤的页面识别。你可以取消。只有确认应用后，修复才在下次完整启动时生效。","修复兼容性",
                    MessageBoxButtons.OKCancel,MessageBoxIcon.Information,MessageBoxDefaultButton.Button2)!=DialogResult.OK)return;
                CompatibilityRepair.Preset candidate=null;
                bool ready;
                using(var cancellation=new CancellationTokenSource()){
                    repairCancellation=cancellation;
                    try{
                        ready=await perform("正在准备修复。你可以继续使用当前 Codex。",()=>{
                            try{candidate=prepareRepair(cancellation.Token);}
                            catch(OperationCanceledException){throw new IOException("已取消修复。原有版本保留。");}
                            return "修复已通过本机界面标记校验。";
                        });
                    }finally{repairCancellation=null;refresh();}
                }
                if(ready&&MessageBox.Show(form,"修复结果已通过本机界面标记校验。要应用到下一次完整启动吗？","应用修复",
                    MessageBoxButtons.YesNo,MessageBoxIcon.Question,MessageBoxDefaultButton.Button2)==DialogResult.Yes)
                    await perform("正在保存修复…",()=>{
                        applyRepair(candidate);
                        return "已保存修复。下次完整退出再打开 Spider Codex 时生效。当前窗口保持运行。";
                    });
                else if(ready)status.Text="未应用修复。原有版本保留。";
            };
            undoRepair.Click+=async delegate{
                if(MessageBox.Show(form,"撤销上次兼容修复？下次完整启动时使用还原后的设置。","撤销兼容修复",MessageBoxButtons.YesNo,MessageBoxIcon.Question,MessageBoxDefaultButton.Button2)==DialogResult.Yes)
                    await perform("正在撤销…",()=>{CompatibilityRepair.RollBack(Spider.State);return "已撤销。下次完整启动时生效。";});
            };
            remove.Click+=async delegate{
                if(MessageBox.Show(form,"卸载 Spider Codex 并移除桌面图标？官方 Codex、账号、聊天和项目都会保留。","卸载 Spider Codex",MessageBoxButtons.YesNo,MessageBoxIcon.Question,MessageBoxDefaultButton.Button2)!=DialogResult.Yes)return;
                bool removed=await perform("正在还原外观并卸载…",uninstall);
                MessageBox.Show(form,status.Text,removed?"卸载完成":"卸载未完成",MessageBoxButtons.OK,removed?MessageBoxIcon.Information:MessageBoxIcon.Warning);
            };
            restore.Click+=async delegate{
                await perform("正在切回官方外观…",setup.RestoreAppearance);
            };
            form.FormClosing+=delegate(object sender,FormClosingEventArgs e){e.Cancel=busy;};
            form.Controls.AddRange(new Control[]{heading,description,status,primary,exitClient,more,cancelRepair});
            form.AcceptButton=primary;
            status.Text=setup.Installed?(setup.HasDesktopShortcut?"日常可从桌面图标打开。":"桌面图标缺失。可在「设置与卸载」中重新创建。"):
                hasPayload?"安装会检查所需组件，并在桌面创建 Spider Codex 图标。":"请先把整个 ZIP 解压到一个文件夹，再打开解压出来的安装程序。";
            if(setup.Installed){
                var latest=Spider.Read("session.json");
                object state;
                if(latest.TryGetValue("status",out state)&&Equals(state,"official-update"))
                    status.Text=LaunchStatusMessage(latest)??status.Text;
                if(WallpaperStarting(latest))form.Shown+=async delegate{
                    string displayed=status.Text;
                    string result=await Task.Run(()=>WaitForLaunchStatus(()=>Spider.Read("session.json")));
                    if(!form.IsDisposed&&!busy&&status.Text==displayed&&result!=null)status.Text=result;
                };
            }
            if(installOnShow)form.Shown+=delegate{primary.PerformClick();};
            refresh();Application.Run(form);
        }
    }

    static void Start(string executable)
    {
        using(var process=Process.Start(new ProcessStartInfo(executable){UseShellExecute=true,WorkingDirectory=Path.GetDirectoryName(executable)})){}
    }
    static string OpenInstalled(string executable)
    {
        string file=Spider.FileAt("session.json");
        DateTime previous=File.GetLastWriteTimeUtc(file);
        Start(executable);
        return WaitForLaunchStatus(()=>File.GetLastWriteTimeUtc(file)>previous?Spider.Read("session.json"):null);
    }
    static bool WallpaperStarting(Dictionary<string,object> session)
    {
        object state,wallpaper;
        return session!=null&&session.TryGetValue("status",out state)&&Equals(state,"official-update")&&
            session.TryGetValue("wallpaperStatus",out wallpaper)&&Equals(wallpaper,"starting");
    }
    internal static string WaitForLaunchStatus(Func<Dictionary<string,object>> readSession,
        int initialWaitMs=3500,int wallpaperWaitMs=52000)
    {
        var watch=Stopwatch.StartNew();
        long deadline=initialWaitMs;
        bool waitingForWallpaper=false;
        while(watch.ElapsedMilliseconds<deadline){
            var latest=readSession();
            if(WallpaperStarting(latest)){
                if(!waitingForWallpaper){
                    waitingForWallpaper=true;
                    deadline=watch.ElapsedMilliseconds+wallpaperWaitMs;
                }
            }else if(latest!=null){
                string message=LaunchStatusMessage(latest);
                if(message!=null)return message;
            }
            Thread.Sleep(100);
        }
        return waitingForWallpaper?"已打开官方 Codex。皮肤和开场待适配，暂未收到动态壁纸的启动结果。":null;
    }
    internal static string LaunchStatusMessage(Dictionary<string,object> session)
    {
        object status;
        if(!session.TryGetValue("status",out status))return null;
        if(Equals(status,"official-update")){
            object wallpaper;
            session.TryGetValue("wallpaperStatus",out wallpaper);
            string message="已打开官方 Codex。当前版本的皮肤和开场还未适配，无需重装 Spider Codex。";
            if(Equals(wallpaper,"ready"))return message+"动态壁纸已启动。";
            if(Equals(wallpaper,"starting"))return message+"正在独立启动动态壁纸。";
            if(Equals(wallpaper,"unavailable"))return message+"动态壁纸未能启动。";
            return message;
        }
        if(Equals(status,"native-existing"))
            return "官方 Codex 已在运行。等任务完成后，在 Codex 里点「文件 → 退出」，再打开 Spider Codex，即可加载皮肤和开场。";
        if(Equals(status,"visible")){
            object adaptive,reused;
            if(session.TryGetValue("adaptiveTheme",out adaptive)&&Equals(adaptive,true))
                return "Spider Codex 已打开。识别到的页面可使用皮肤，新版的蛛丝开场暂时停用。";
            if(session.TryGetValue("reusedClient",out reused)&&Equals(reused,true))
                return "Spider Codex 已打开。当前窗口继续使用，蛛丝开场在下次完整启动时播放。";
            return "Spider Codex 已打开。";
        }
        object reason;
        if(Equals(status,"native-fallback")&&session.TryGetValue("reason",out reason))
            return "已用官方外观打开 Codex。"+Convert.ToString(reason);
        return null;
    }
}
