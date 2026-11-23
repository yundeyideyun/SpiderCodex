using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

internal static class ReleasePointer {
    internal static string Resolve(string root,string relativeDirectory,string executable){
        string boundary=Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
        if(Path.IsPathRooted(relativeDirectory))throw new InvalidOperationException("发行目录必须位于启动入口内。");
        string directory=Path.GetFullPath(Path.Combine(boundary,relativeDirectory.Replace('/',Path.DirectorySeparatorChar)));
        if(!directory.StartsWith(boundary,StringComparison.OrdinalIgnoreCase)||directory.TrimEnd(Path.DirectorySeparatorChar)==boundary.TrimEnd(Path.DirectorySeparatorChar))
            throw new InvalidOperationException("发行目录无效。");
        if(executable!="SpiderCodex.exe"&&executable!="恢复原界面和桌面.exe")throw new InvalidOperationException("不支持的程序入口。");
        return Path.Combine(directory,executable);
    }
    internal static void EnsureMatches(string target,string expected,string version){
        string actual;
        using(var input=File.OpenRead(target))
        using(var hash=SHA256.Create())actual=BitConverter.ToString(hash.ComputeHash(input)).Replace("-","");
        if(!string.Equals(expected,actual,StringComparison.OrdinalIgnoreCase)||FileVersionInfo.GetVersionInfo(target).ProductVersion!=version)
            throw new InvalidOperationException("程序内容与发行记录不一致。请恢复完整发行包后重试。");
    }
    internal static string VerifiedEntry(string root,string executable){
        var manifest=Spider.Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,"current-release.json")));
        if(Convert.ToInt32(manifest["schemaVersion"])!=1)throw new InvalidOperationException("发行指针版本不支持。");
        string target=Resolve(root,(string)manifest["relativeDirectory"],executable);
        var programs=(Dictionary<string,object>)manifest["programs"];
        EnsureMatches(target,(string)programs[executable],(string)manifest["version"]);
        return target;
    }
    internal const string ExperienceFile="experience.txt";
    internal static bool? ReadExperience(string root){
        string file=Path.Combine(root,ExperienceFile);
        if(!File.Exists(file))return null;
        if((File.GetAttributes(file)&FileAttributes.ReparsePoint)!=0||new FileInfo(file).Length>16)
            throw new IOException("体验设置文件无法识别。");
        string value=File.ReadAllText(file).Trim();
        if(value=="full")return true;
        if(value=="light")return false;
        throw new IOException("体验设置文件无法识别。");
    }
    internal static bool FullExperienceForLaunch(string runningDirectory,string[] args){
        if(Array.IndexOf(args,"--lightweight")>=0)return false;
        if(Array.IndexOf(args,"--full-effects")>=0)return true;
        if(Array.IndexOf(args,"--profile")>=0)return false;
        var release=new DirectoryInfo(Path.GetFullPath(runningDirectory));
        var releases=release.Parent;
        if(releases==null||releases.Parent==null||!releases.Name.Equals("releases",StringComparison.OrdinalIgnoreCase)||
            !Regex.IsMatch(release.Name,@"^R[0-9]+$",RegexOptions.IgnoreCase))return false;
        string installation=releases.Parent.FullName;
        if(!File.Exists(Path.Combine(installation,"current-release.json")))return false;
        try{return ReadExperience(installation)==true;}
        catch(IOException){return false;}
        catch(UnauthorizedAccessException){return false;}
    }
    internal static string RestartEntry(string runningDirectory){
        var running=new DirectoryInfo(Path.GetFullPath(runningDirectory));
        var releases=running.Parent;
        if(releases!=null&&releases.Parent!=null&&releases.Name.Equals("releases",StringComparison.OrdinalIgnoreCase)&&
            Regex.IsMatch(running.Name,@"^R[0-9]+$",RegexOptions.IgnoreCase)){
            string installation=releases.Parent.FullName;
            if(File.Exists(Path.Combine(installation,"current-release.json")))
                return VerifiedEntry(installation,"SpiderCodex.exe");
        }
        return Path.Combine(running.FullName,"SpiderCodex.exe");
    }
    internal static Process Start(string target,string[] args){
        var command=new StringBuilder();
        foreach(string arg in args)command.Append(Spider.Quote(arg)).Append(' ');
        return Process.Start(new ProcessStartInfo(target,command.ToString()){
            UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=Path.GetDirectoryName(target)
        });
    }
}
