using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class ReleaseSelection
{
    internal sealed class FileEntry
    {
        public string path { get; set; }
        public string sha256 { get; set; }
        public long length { get; set; }
    }

    internal sealed class ReleaseFiles
    {
        public int schemaVersion { get; set; }
        public List<FileEntry> files { get; set; }
    }

    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    static readonly string[] Entries = { "SpiderCodex.exe", "恢复原界面和桌面.exe" };

    static void CheckOrdinary(string path)
    {
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
            throw new IOException("版本目录含有重定向文件或目录。");
    }

    internal static string Current(string root)
    {
        var pointer = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(root, "current-release.json")));
        return Convert.ToString(pointer["relativeDirectory"]);
    }

    internal static string Switch(string root, string name)
    {
        if (!Regex.IsMatch(name ?? "", @"^R[0-9]+$"))
            throw new ArgumentException("请选择已有版本。");
        string relative = "releases/" + name;
        string parent = Path.Combine(root, "releases");
        string folder = Path.Combine(parent, name);
        CheckOrdinary(parent);
        string version;
        var hashes = Verify(folder,out version);
        string pointerPath = Path.Combine(root, "current-release.json");
        CheckOrdinary(pointerPath);
        string data = Json.Serialize(new { schemaVersion=1, relativeDirectory=relative, version=version, programs=hashes, publicReleaseApproved=false });
        string temporary = pointerPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var fs = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                var bytes = Encoding.UTF8.GetBytes(data);
                fs.Write(bytes,0,bytes.Length);
                fs.Flush(true);
            }
            File.Replace(temporary,pointerPath,null);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
        return version;
    }

    internal static Dictionary<string,string> Verify(string folder,out string version)
    {
        CheckOrdinary(folder);
        if (File.Exists(Path.Combine(folder,"INCOMPLETE.txt"))) throw new IOException("该版本尚未完整安装。");
        string manifestPath = Path.Combine(folder, "release-manifest.json");
        CheckOrdinary(manifestPath);
        var manifest = Json.Deserialize<ReleaseFiles>(File.ReadAllText(manifestPath));
        if (manifest == null || manifest.schemaVersion != 1 || manifest.files == null)
            throw new IOException("无法读取版本清单。");

        var hashes = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
        var pending = new Stack<string>();
        pending.Push(folder);
        var actual = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        while (pending.Count != 0)
        {
            foreach (string path in Directory.EnumerateFileSystemEntries(pending.Pop()))
            {
                CheckOrdinary(path);
                if (Directory.Exists(path)) pending.Push(path);
                else if (path != manifestPath) actual.Add(path.Substring(folder.Length + 1).Replace('\\','/'));
            }
        }
        foreach (var file in manifest.files)
        {
            if (!actual.Remove(file.path)) throw new IOException("清单中的文件缺失、重复或路径异常。");
            var path = Path.Combine(folder,file.path);
            if (new FileInfo(path).Length != file.length) throw new IOException("文件长度不符 " + file.path);
            string hash;
            using (var stream = File.OpenRead(path))
            using (var algorithm = SHA256.Create())
                hash = BitConverter.ToString(algorithm.ComputeHash(stream)).Replace("-", "");
            if (!String.Equals(hash,file.sha256,StringComparison.OrdinalIgnoreCase))
                throw new IOException("文件校验失败 " + file.path);
            if (Entries.Contains(file.path)) hashes.Add(file.path,hash);
        }
        if (actual.Count != 0 || hashes.Count != Entries.Length) throw new IOException("发行目录内容与清单不一致。");
        var packageVersion = FileVersionInfo.GetVersionInfo(Path.Combine(folder, Entries[0])).ProductVersion;
        version=packageVersion;
        if (String.IsNullOrEmpty(version) || Entries.Any(e=>FileVersionInfo.GetVersionInfo(Path.Combine(folder,e)).ProductVersion != packageVersion))
            throw new IOException("启动和恢复程序版本不一致。");
        return hashes;
    }

    [STAThread] static void Main()
    {
        Application.EnableVisualStyles();
        string root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        try
        {
            if (!File.Exists(Path.Combine(root,"current-release.json")))
            {
                var parent=Directory.GetParent(root);
                if(parent != null && parent.Name == "releases" && parent.Parent != null)root=parent.Parent.FullName;
            }
            string current = Current(root);
            using(var window = new Form { Text="Spider Codex 版本管理", Width=440, Height=200, StartPosition=FormStartPosition.CenterScreen, MaximizeBox=false, FormBorderStyle=FormBorderStyle.FixedDialog })
            {
                var label=new Label { Left=20,Top=18,Width=390,Text="当前使用 "+current.Split('/').Last()+"。选择下次启动时使用的版本。" };
                var select=new ComboBox { Left=20,Top=52,Width=380,DropDownStyle=ComboBoxStyle.DropDownList };
                foreach(string dir in Directory.GetDirectories(Path.Combine(root,"releases")))
                    if(Regex.IsMatch(Path.GetFileName(dir),@"^R[0-9]+$"))select.Items.Add(Path.GetFileName(dir));
                select.SelectedItem=current.Split('/').Last();
                var apply=new Button { Text="应用版本",Left=292,Top=95,Width=108 };
                apply.Click+=delegate {
                    if(select.SelectedItem==null)return;
                    try
                    {
                        apply.Enabled=false;window.UseWaitCursor=true;
                        Switch(root,(string)select.SelectedItem);
                        MessageBox.Show(window,"已保存。当前客户端完全退出后，下次从原图标启动时生效。","Spider Codex");
                        window.Close();
                    }
                    catch(Exception ex){MessageBox.Show(window,ex.Message,"无法切换版本");}
                    finally{window.UseWaitCursor=false;apply.Enabled=true;}
                };
                window.Controls.AddRange(new Control[]{label,select,apply});window.AcceptButton=apply;Application.Run(window);
            }
        }
        catch(Exception ex){MessageBox.Show(ex.Message,"无法读取已安装版本");}
    }
}


