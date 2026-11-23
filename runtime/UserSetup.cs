using System;
using System.IO;
using System.Diagnostics;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class UserSetup
{
    readonly string root, desktop, receipts;
    const string Identity = "SpiderCodex user installation v1";
    const string Marker = ".spider-install";
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    static readonly string[] RootTools = {"SpiderCodex.exe","恢复原界面和桌面.exe","版本管理.exe"};

    internal UserSetup(string root,string desktop)
    {
        this.root=Path.GetFullPath(root);
        this.desktop=Path.GetFullPath(desktop);
        receipts=Path.Combine(this.root,"receipts");
    }
    static string Digest(string file)
    {
        using(var stream=File.OpenRead(file))
        using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","");
    }
    static void Plain(string path)
    {
        if((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw new IOException("检测到重定向路径 "+Path.GetFileName(path));
    }
    static string Under(string dir,string part)
    {
        string boundary=Path.GetFullPath(dir).TrimEnd('\\')+"\\";
        string path=Path.GetFullPath(Path.Combine(boundary,part));
        if(Path.IsPathRooted(part)||part.Contains(":")||!path.StartsWith(boundary,StringComparison.OrdinalIgnoreCase))throw new IOException("无效安装路径。");
        for(var item=new DirectoryInfo(Path.GetDirectoryName(path));item!=null && (item.FullName+"\\").StartsWith(boundary,StringComparison.OrdinalIgnoreCase);item=item.Parent)
            if(item.Exists)Plain(item.FullName);
        if(File.Exists(path)||Directory.Exists(path))Plain(path);
        return path;
    }
    static void Write(string path,string value)
    {
        WriteBytes(path,Encoding.UTF8.GetBytes(value));
    }
    static void WriteBytes(string path,byte[] bytes)
    {
        string tmp=path+"."+Guid.NewGuid().ToString("N")+".tmp";
        try {
            using(var file=new FileStream(tmp,FileMode.CreateNew,FileAccess.Write,FileShare.None)){
                file.Write(bytes,0,bytes.Length);file.Flush(true);
            }
            if(File.Exists(path))File.Replace(tmp,path,null);else File.Move(tmp,path);
        }finally{if(File.Exists(tmp))File.Delete(tmp);}
    }
    internal bool Managed {get{return File.Exists(Path.Combine(root,Marker)) && File.ReadAllText(Under(root,Marker))==Identity;}}
    internal string Current {get{return File.Exists(Path.Combine(root,"current-release.json"))?ReleaseSelection.Current(root):null;}}
    string Link {get{return Path.Combine(desktop,"Spider Codex.lnk");}}
    const string ReleaseManifest="release-manifest.json";

    static void RequireIdle(string directory)
    {
        string boundary=directory.TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
        foreach(string name in new[]{"SpiderCodex","DesktopWallpaper","DesktopBoot","ResizeCompanion","版本管理","恢复原界面和桌面","node"})
        foreach(var process in Process.GetProcessesByName(name))using(process){
            string file;
            try{file=process.MainModule.FileName;}
            catch(InvalidOperationException){continue;}
            catch(System.ComponentModel.Win32Exception){continue;}
            if(file.StartsWith(boundary,StringComparison.OrdinalIgnoreCase))
                throw new IOException("此版仍在运行。请结束使用并恢复桌面后再更新。");
        }
    }
    void RecoverRefresh(string tag,string target,string stage)
    {
        string journal=Under(receipts,".refresh-"+tag);
        if(!Directory.Exists(journal))return;
        string previous=Under(journal,"previous");
        string priorPointer=Under(journal,"pointer.json"),priorReceipt=Under(journal,"receipt.json"),expected=Under(journal,"next.sha256");
        string pointer=Under(root,"current-release.json"),receipt=Under(receipts,tag+".json");
        bool ready=File.Exists(expected)&&File.Exists(priorPointer)&&File.Exists(priorReceipt);
        if(!ready&&Directory.Exists(previous))throw new IOException("同版本更新记录不完整，已保留原安装内容。");
        if(ready){
            string currentManifest=Under(target,ReleaseManifest);
            string nextHash=File.ReadAllText(expected);
            string oldHash=Digest(priorReceipt);
            string actual=File.Exists(currentManifest)?Digest(currentManifest):null;
            bool committed=actual==nextHash&&File.Exists(receipt)&&Digest(receipt)==nextHash;
            if(committed){
                string version;ReleaseSelection.Verify(target,out version);
                if(Directory.Exists(previous)){RequireIdle(previous);RemoveKnownRelease(previous,priorReceipt);}
            }else{
                if(Directory.Exists(previous)){
                    RequireIdle(previous);
                    if(Digest(Under(previous,ReleaseManifest))!=oldHash)throw new IOException("无法核验上一次安装的原始文件。");
                    string oldVersion;ReleaseSelection.Verify(previous,out oldVersion);
                    if(Directory.Exists(target)){
                        if(actual!=nextHash||Directory.Exists(stage))throw new IOException("更新目录已变化，已保留原始文件。");
                        RequireIdle(target);
                        string nextVersion;ReleaseSelection.Verify(target,out nextVersion);
                        Directory.Move(target,stage);
                    }
                    Directory.Move(previous,target);
                }else if(actual!=oldHash)throw new IOException("无法恢复上一次安装的原始文件。");
                WriteBytes(pointer,File.ReadAllBytes(priorPointer));
                WriteBytes(receipt,File.ReadAllBytes(priorReceipt));
            }
        }
        // Delete only our transaction metadata and matching previous files.
        if(Directory.Exists(previous))throw new IOException("旧文件保留在恢复目录。");
        foreach(string file in new[]{expected,priorReceipt,priorPointer})if(File.Exists(file))File.Delete(file);
        Prune(journal);
    }
    string OwnedReleaseReceipt(string tag,string target)
    {
        string receipt=Under(receipts,tag+".json");
        if(!File.Exists(receipt)||Digest(receipt)!=Digest(Under(target,ReleaseManifest)))
            throw new IOException("当前版本与安装记录不一致，已保留现有文件。");
        string previousVersion;ReleaseSelection.Verify(target,out previousVersion);
        RequireIdle(target);
        return receipt;
    }
    void ValidateExistingTools()
    {
        foreach(string tool in RootTools){
            string path=Under(root,tool);
            string receipt=Under(receipts,tool+".sha256");
            if(File.Exists(path)&&(!File.Exists(receipt)||File.ReadAllText(receipt)!=Digest(path)))
                throw new IOException("安装目录内的工具已被更改 "+tool);
        }
    }
    void ReplaceSameVersion(string tag,string target,string stage,string from)
    {
        string receipt=OwnedReleaseReceipt(tag,target);
        string pointer=Under(root,"current-release.json");
        byte[] priorPointer=File.ReadAllBytes(pointer);
        string journal=Under(receipts,".refresh-"+tag);
        Directory.CreateDirectory(journal);
        WriteBytes(Under(journal,"pointer.json"),priorPointer);
        WriteBytes(Under(journal,"receipt.json"),File.ReadAllBytes(receipt));
        Write(Under(journal,"next.sha256"),Digest(from));
        try{
            RequireIdle(target);
            Directory.Move(target,Under(journal,"previous"));
            Directory.Move(stage,target);
            ReleaseSelection.Switch(root,tag);
            // The receipt is the commit marker, written after verification and pointer update.
            WriteBytes(receipt,File.ReadAllBytes(Under(target,ReleaseManifest)));
        }catch{
            RecoverRefresh(tag,target,stage);
            throw;
        }
        RecoverRefresh(tag,target,stage);
    }

    internal bool? Experience {get{return Managed?ReleasePointer.ReadExperience(root):null;}}
    internal string SaveExperience(bool fullEffects){
        if(!Managed)throw new IOException("请先安装 Spider Codex。");
        string file=Under(root,ReleasePointer.ExperienceFile);
        // Keep unrecognized or user-modified content intact.
        if(ReleasePointer.ReadExperience(root)!=fullEffects)Write(file,fullEffects?"full":"light");
        return "已保存。下次完全退出并从桌面打开时生效。";
    }
    internal string Install(string source,Action<string> readinessCheck=null,bool? fullEffects=null)
    {
        string version;
        ReleaseSelection.Verify(source,out version);
        var match=Regex.Match(version,@"^SpiderCodex-[0-9]+\.([0-9]+)-");
        if(!match.Success)throw new IOException("发行版本格式不受支持。");
        if(readinessCheck!=null)readinessCheck(source);
        string tag="R"+match.Groups[1].Value;
        Directory.CreateDirectory(root);Plain(root);
        if(!Managed){
            if(Directory.EnumerateFileSystemEntries(root).Any())throw new IOException("安装目录已包含其他文件。");
            Write(Under(root,Marker),Identity);
        }
        Directory.CreateDirectory(Under(root,"releases"));Directory.CreateDirectory(Under(root,"receipts"));
        ValidateExistingTools();
        if(fullEffects.HasValue)ReleasePointer.ReadExperience(root);
        string manifest=ReleaseManifest;
        string from=Under(source,manifest);
        var records=Json.Deserialize<ReleaseSelection.ReleaseFiles>(File.ReadAllText(from)).files;
        string target=Under(root,"releases/"+tag);
        string stage=Under(root,"releases/.install-"+tag);
        RecoverRefresh(tag,target,stage);
        bool replacing=Directory.Exists(target)&&Digest(Under(target,manifest))!=Digest(from);
        if(replacing)OwnedReleaseReceipt(tag,target);
        if(!Directory.Exists(target)||replacing){
            // A fixed staging directory can be resumed after a power loss. Publication is one rename.
            Directory.CreateDirectory(stage);
            foreach(var record in records){
                string to=Under(stage,record.path);
                Directory.CreateDirectory(Path.GetDirectoryName(to));
                File.Copy(Under(source,record.path),to,true);
            }
            File.Copy(from,Under(stage,manifest),true);
            string stagedVersion;ReleaseSelection.Verify(stage,out stagedVersion);
            if(version!=stagedVersion)throw new IOException("复制期间发行版本已改变。");
            if(replacing)ReplaceSameVersion(tag,target,stage,from);
            else Directory.Move(stage,target);
        }
        if(Digest(Under(target,manifest))!=Digest(from))throw new IOException("同一版本名已经对应其他内容。");
        ReleaseSelection.Verify(target,out version);
        WriteBytes(Under(receipts,tag+".json"),File.ReadAllBytes(Under(target,manifest)));
        foreach(string tool in RootTools){
            string path=Under(root,tool);
            string src=Under(target,tool=="版本管理.exe"?tool:"SpiderCodex.Start.exe");
            if(tool=="版本管理.exe"&&!File.Exists(src))continue;
            string receipt=Under(receipts,tool+".sha256");
            // Keep the stable forwarders across updates. Never overwrite an unrelated file.
            if(File.Exists(path)){
                if(!File.Exists(receipt)||File.ReadAllText(receipt)!=Digest(path))throw new IOException("安装目录内的工具已被更改 "+tool);
            }else{
                string hash=Digest(src);
                Write(receipt,hash);
                File.Copy(src,path);
            }
        }
        string pointer=Under(root,"current-release.json");
        if(!File.Exists(pointer))Write(pointer,"{}");
        ReleaseSelection.Switch(root,tag);
        Write(Under(receipts,"pointer-"+tag+".sha256"),Digest(pointer));
        if(fullEffects.HasValue)SaveExperience(fullEffects.Value);
        if(File.Exists(Link))return File.Exists(Under(receipts,"shortcut.sha256")) && Digest(Link)==File.ReadAllText(Under(receipts,"shortcut.sha256")) ? "已安装 "+tag : "已安装 "+tag+"。已保留桌面上的同名快捷方式，可从安装目录打开。";
        string temp=Path.Combine(desktop,"SpiderCodex-"+Guid.NewGuid().ToString("N")+".lnk");
        try{
            dynamic shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
            dynamic shortcut=shell.CreateShortcut(temp);
            shortcut.TargetPath=Under(root,"SpiderCodex.exe");shortcut.WorkingDirectory=root;
            shortcut.IconLocation=Under(root,"SpiderCodex.exe")+",0";shortcut.Save();
            Write(Under(receipts,"shortcut.sha256"),Digest(temp));
            File.Move(temp,Link);
        }finally{if(File.Exists(temp))File.Delete(temp);}
        return "已安装 "+tag;
    }
    // Remove only the recorded bytes. Untracked and user-edited files stay in place.
    static void RemoveMatching(string path,string expected)
    {
        if(!File.Exists(path))return;
        Plain(path);
        if(String.Equals(Digest(path),expected,StringComparison.OrdinalIgnoreCase))File.Delete(path);
    }
    static void Prune(string directory)
    {
        if(!Directory.Exists(directory))return;Plain(directory);
        if(!Directory.EnumerateFileSystemEntries(directory).Any())Directory.Delete(directory);
    }
    static void RemoveKnownRelease(string folder,string receipt)
    {
        var dirs=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach(var record in Json.Deserialize<ReleaseSelection.ReleaseFiles>(File.ReadAllText(receipt)).files){
            string file=Under(folder,record.path);
            for(string d=Path.GetDirectoryName(file);d!=folder;d=Path.GetDirectoryName(d))dirs.Add(d);
            RemoveMatching(file,record.sha256);
        }
        RemoveMatching(Under(folder,ReleaseManifest),Digest(receipt));
        foreach(string d in dirs.OrderByDescending(x=>x.Length))Prune(d);
        Prune(folder);
    }
    internal string Uninstall()
    {
        if(!Managed)throw new IOException("此目录没有本安装程序的安装记录。");
        string packageBoundary=root.TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
        foreach(string processName in new[]{"SpiderCodex","DesktopWallpaper","DesktopBoot","ResizeCompanion","版本管理","恢复原界面和桌面","安装 Spider Codex"}){
            foreach(var process in Process.GetProcessesByName(processName)){
                using(process){
                    string file;
                    try{file=process.MainModule.FileName;}catch(InvalidOperationException){continue;}
                    if(!file.StartsWith(packageBoundary,StringComparison.OrdinalIgnoreCase))continue;
                    if(process.Id==Process.GetCurrentProcess().Id)throw new IOException("请从解压的安装包打开安装程序后卸载。");
                    throw new IOException("请先用恢复工具还原外观，再正常退出此副本。");
                }
            }
        }
        Directory.CreateDirectory(Under(root,"receipts"));
        string linkReceipt=Under(receipts,"shortcut.sha256");
        if(File.Exists(linkReceipt)){RemoveMatching(Link,File.ReadAllText(linkReceipt));File.Delete(linkReceipt);}
        string pointer=Under(root,"current-release.json");
        foreach(var hash in Directory.GetFiles(receipts,"pointer-R*.sha256")){
            Plain(hash);RemoveMatching(pointer,File.ReadAllText(hash));File.Delete(hash);
        }
        foreach(var tool in RootTools){
            string receipt=Under(receipts,tool+".sha256");
            if(File.Exists(receipt)){RemoveMatching(Under(root,tool),File.ReadAllText(receipt));File.Delete(receipt);}
        }
        foreach(string receipt in Directory.GetFiles(receipts,"R*.json")){
            Plain(receipt);string tag=Path.GetFileNameWithoutExtension(receipt);
            if(!Regex.IsMatch(tag,@"^R\d+$"))continue;
            string folder=Under(root,"releases/"+tag);
            RemoveKnownRelease(folder,receipt);File.Delete(receipt);
        }
        try{
            if(ReleasePointer.ReadExperience(root).HasValue)File.Delete(Under(root,ReleasePointer.ExperienceFile));
        }catch(IOException){}catch(UnauthorizedAccessException){}
        Prune(receipts);Prune(Under(root,"releases"));File.Delete(Under(root,Marker));Prune(root);
        return Directory.Exists(root)?"已卸载。安装目录保留了其他文件。":"已卸载。";
    }
    internal string RunExclusive(Func<string> action)
    {
        using(var mutex=new Mutex(false,"Local\\SpiderCodex.UserSetup")){
            bool acquired=false;
            try{try{acquired=mutex.WaitOne(0);}catch(AbandonedMutexException){acquired=true;}
                if(!acquired)throw new IOException("另一个安装操作正在进行。");
                return action();
            }finally{if(acquired)mutex.ReleaseMutex();}
        }
    }
}
