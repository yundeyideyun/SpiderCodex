using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class SetupWindow
{
    [STAThread] static void Main()
    {
        Application.EnableVisualStyles();
        string root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","SpiderCodex");
        string kit=AppDomain.CurrentDomain.BaseDirectory;
        string payload=Path.Combine(kit,"payload");
        try{Show(root,Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),payload);}
        catch(Exception error){MessageBox.Show(error.Message,"无法打开 Spider Codex 安装程序",MessageBoxButtons.OK,MessageBoxIcon.Warning);}
    }
    internal static void Show(string root,string desktop,string payload)
    {
        var setup=new UserSetup(root,desktop);
        using(var form=new Form{Text="安装 Spider Codex",ClientSize=new Size(530,318),AutoScaleDimensions=new SizeF(96,96),AutoScaleMode=AutoScaleMode.Dpi,FormBorderStyle=FormBorderStyle.FixedDialog,MaximizeBox=false,StartPosition=FormStartPosition.CenterScreen})
        {
            var location=new Label{Text="安装到 "+root,Left=18,Top=18,Width=494,Height=42,AutoEllipsis=true};
            var full=new RadioButton{Text="完整体验  ·  客户端皮肤、动态壁纸与蛛丝开场",Left=18,Top=60,Width=494,Height=26};
            var light=new RadioButton{Text="轻量体验  ·  只启用客户端皮肤",Left=18,Top=89,Width=494,Height=26};
            var hint=new Label{Text="双击桌面的 Spider Codex 图标启动。可在这里切换体验。",Left=18,Top=121,Width=494,Height=26};
            var status=new Label{Left=18,Top=158,Width=494,Height=64};
            var saveMode=new Button{Text="保存体验",Left=18,Top=270,Width=125,Height=33};
            bool? selected=null;
            try{selected=setup.Experience;}catch(IOException){}catch(UnauthorizedAccessException){}
            full.Checked=selected??!setup.Managed;
            light.Checked=!full.Checked;
            var install=new Button{Text="安装或升级",Left=18,Top=230,Width=125,Height=33};
            var check=new Button{Text="检查环境",Left=152,Top=230,Width=110,Height=33};
            var restore=new Button{Text="恢复原外观",Left=271,Top=230,Width=125,Height=33};
            var remove=new Button{Text="卸载",Left=405,Top=230,Width=90,Height=33};
            bool busy=false;
            Action refresh=delegate {
                bool managed=setup.Managed;
                install.Enabled=!busy && Directory.Exists(payload);
                check.Enabled=install.Enabled;
                restore.Enabled=!busy && managed && File.Exists(Path.Combine(root,"恢复原界面和桌面.exe"));
                remove.Enabled=!busy && managed;
                saveMode.Enabled=!busy && managed;
                full.Enabled=light.Enabled=!busy;
            };
            Func<string,Func<string>,Task> perform=async (working,action)=>{
                if(busy)return;
                busy=true;refresh();status.Text=working;
                try{
                    status.Text=await Task.Run(()=>setup.RunExclusive(action));
                }catch(Exception ex){
                    status.Text="操作未完成。";
                    MessageBox.Show(form,ex.Message,"Spider Codex",MessageBoxButtons.OK,MessageBoxIcon.Warning);
                }
                finally{busy=false;refresh();}
            };
            install.Click+=async delegate{
                bool fullEffects=full.Checked;
                await perform("正在检查环境和安装包…",()=>{
                    string warning="";
                    string result=setup.Install(payload,source=>warning=Diagnostics.InstallEnvironmentMessage(source),fullEffects);
                    return warning.Length==0?result:result+Environment.NewLine+warning;
                });
            };
            saveMode.Click+=async delegate{
                bool fullEffects=full.Checked;
                await perform("正在保存体验…",()=>setup.SaveExperience(fullEffects));
            };
            check.Click+=async delegate{await perform("正在检查运行环境…",()=>{
                string version;
                ReleaseSelection.Verify(payload,out version);
                string warning=Diagnostics.InstallEnvironmentMessage(payload);
                return warning.Length==0?"环境和安装包检查通过，可以安装或升级。":"可以安装或升级。"+Environment.NewLine+warning;
            });};
            remove.Click+=async delegate{
                if(MessageBox.Show(form,"卸载此副本及其桌面快捷方式？","Spider Codex",MessageBoxButtons.OKCancel,MessageBoxIcon.Question)==DialogResult.OK)
                    await perform("正在卸载…",setup.Uninstall);
            };
            restore.Click+=delegate{try{Process.Start(Path.Combine(root,"恢复原界面和桌面.exe"));}catch(Exception ex){status.Text=ex.Message;}};
            form.FormClosing+=delegate(object sender,FormClosingEventArgs e){e.Cancel=busy;};
            form.Controls.AddRange(new Control[]{location,full,light,hint,status,install,check,restore,remove,saveMode});
            status.Text=!Directory.Exists(payload)?"安装文件夹缺失。请完整解压安装包再打开。":setup.Managed?"已安装。完全退出客户端后，下次启动将使用所选版本。":"安装后可从桌面打开 Spider Codex。";
            refresh();Application.Run(form);
        }
    }
}

