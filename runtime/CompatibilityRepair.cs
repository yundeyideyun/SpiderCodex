using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

internal static class CompatibilityRepair
{
    internal sealed class AnchorPair
    {
        public string mainAttribute { get; set; }
        public string composerAttribute { get; set; }
    }
    internal sealed class Observation
    {
        public string version { get; set; }
        public string at { get; set; }
        public List<AnchorPair> pairs { get; set; }
    }
    internal sealed class Preset
    {
        public string version { get; set; }
        public string mainAttribute { get; set; }
        public string composerAttribute { get; set; }
    }

    const string PresetName="layout-repair.json";
    const string ObservationName="layout-observation.json";
    const string Schema="{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"mainAttribute\",\"composerAttribute\"],\"properties\":{\"mainAttribute\":{\"type\":\"string\"},\"composerAttribute\":{\"type\":\"string\"}}}";
    static readonly Regex Attribute=new Regex(@"\Adata-[a-z][a-z0-9-]{1,63}\z");
    static readonly Regex VersionNumber=new Regex(@"\A[0-9]+(?:\.[0-9]+){3}\z");
    static bool IsPair(string main,string composer)
    {
        return Attribute.IsMatch(main??"")&&Attribute.IsMatch(composer??"")&&main!=composer;
    }
    static string ReadSmall(string file)
    {
        if(!File.Exists(file))return null;
        var item=new FileInfo(file);
        if((item.Attributes&FileAttributes.ReparsePoint)!=0||item.Length>16384)return null;
        return File.ReadAllText(file);
    }
    internal static string CurrentPreset(string directory,string version)
    {
        try{
            string raw=ReadSmall(Path.Combine(directory,PresetName));
            var preset=raw==null?null:Spider.Json.Deserialize<Preset>(raw);
            return preset!=null&&preset.version==version&&VersionNumber.IsMatch(version??"")&&
                IsPair(preset.mainAttribute,preset.composerAttribute)?Spider.Json.Serialize(preset):null;
        }catch{return null;}
    }
    internal static Preset Qualify(Observation evidence,string version,string output)
    {
        VerifyEvidence(evidence,version);
        if(string.IsNullOrWhiteSpace(output)||output.Length>2000)throw new IOException("没有收到可验证的修复结果。原有版本保留。");
        var answer=Spider.Json.Deserialize<Dictionary<string,object>>(output);
        object main,composer;
        if(answer==null||answer.Count!=2||!answer.TryGetValue("mainAttribute",out main)||
           !answer.TryGetValue("composerAttribute",out composer)||!IsPair(main as string,composer as string)||
           !evidence.pairs.Any(pair=>pair!=null&&Equals(main,pair.mainAttribute)&&Equals(composer,pair.composerAttribute)))
            throw new IOException("修复结果与本机实测界面不匹配。原有版本保留。");
        if(Equals(main,"data-app-shell-main-surface")&&Equals(composer,"data-codex-composer"))
            throw new IOException("当前界面已经匹配，未发现需要修复的布局识别问题。原有版本保留。");
        return new Preset{version=version,mainAttribute=(string)main,composerAttribute=(string)composer};
    }
    internal static void Apply(string directory,Preset preset,string currentVersion)
    {
        if(preset==null||preset.version!=currentVersion||!VersionNumber.IsMatch(currentVersion??"")||
           !IsPair(preset.mainAttribute,preset.composerAttribute))
            throw new IOException("官方版本已改变，修复未应用。");
        if((File.GetAttributes(directory)&FileAttributes.ReparsePoint)!=0)throw new IOException("修复位置已重定向。");
        string target=Path.Combine(directory,PresetName);
        string backup=Path.Combine(directory,"layout-repair.previous.json");
        foreach(string check in new[]{target,backup})
            if(File.Exists(check)&&(File.GetAttributes(check)&FileAttributes.ReparsePoint)!=0)throw new IOException("修复文件已重定向。");
        string temp=target+"."+Guid.NewGuid().ToString("N")+".tmp";
        try{
            File.WriteAllText(temp,Spider.Json.Serialize(preset),new UTF8Encoding(false));
            if(File.Exists(target))File.Replace(temp,target,backup);
            else File.Move(temp,target);
        }finally{if(File.Exists(temp))File.Delete(temp);}
    }
    internal static void RollBack(string directory)
    {
        if((File.GetAttributes(directory)&FileAttributes.ReparsePoint)!=0)throw new IOException("修复位置已重定向。");
        string original=Path.Combine(directory,PresetName),backup=Path.Combine(directory,"layout-repair.previous.json");
        foreach(string file in new[]{original,backup})
            if(File.Exists(file)&&(File.GetAttributes(file)&FileAttributes.ReparsePoint)!=0)throw new IOException("修复文件已重定向。");
        if(File.Exists(backup)){
            if(File.Exists(original))File.Replace(backup,original,null);
            else File.Move(backup,original);
        }else if(File.Exists(original))File.Delete(original);
    }

    internal static Preset Prepare(CancellationToken cancel)
    {
        var official=InstalledClient.Resolve();
        string evidenceText=ReadSmall(Path.Combine(Spider.State,ObservationName));
        var evidence=evidenceText==null?null:Spider.Json.Deserialize<Observation>(evidenceText);
        return PrepareFromEvidence(evidence,official,cancel);
    }
    internal static Preset PrepareFromEvidence(Observation evidence,InstalledClient official,CancellationToken cancel)
    {
        cancel.ThrowIfCancellationRequested();
        // Validate the evidence before requesting an inference.
        VerifyEvidence(evidence,official.Version);
        var pairs=evidence.pairs.Where(p=>p!=null&&IsPair(p.mainAttribute,p.composerAttribute)).ToArray();
        if(pairs.Length==0)throw new IOException("没有可校验的聊天界面标记，原有版本保留。");
        string cli=Path.Combine(official.InstallDirectory,"app","resources","codex.exe");
        if(!File.Exists(cli))throw new IOException("这版官方 Codex 没有提供本机修复入口，原有版本保留。");
        string staging=Path.Combine(Path.GetTempPath(),"SpiderCodex-repair-"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(staging);
        string schema=Path.Combine(staging,"response-schema.json"),answer=Path.Combine(staging,"response.json");
        try{
            File.WriteAllText(schema,Schema,new UTF8Encoding(false));
            string prompt="Choose only one observed pair of data attributes for the main chat workspace and its message composer. "+
                "Do not run tools, read local files, modify anything, or invent attributes. Prefer an explicit composer marker. "+
                "If no pair is unambiguous, return both fields empty. Observed pairs: "+Spider.Json.Serialize(pairs);
            var info=new ProcessStartInfo(cli,"exec --sandbox read-only --skip-git-repo-check --ephemeral --ignore-user-config --disable shell_tool --disable unified_exec "+
                "-c "+Spider.Quote("approval_policy=\"never\"")+" --output-schema "+Spider.Quote(schema)+" --output-last-message "+Spider.Quote(answer)+" -"){
                UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=staging,
                RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true};
            using(var process=Process.Start(info)){
                process.OutputDataReceived+=delegate{};
                process.ErrorDataReceived+=delegate{};
                process.BeginOutputReadLine();process.BeginErrorReadLine();
                process.StandardInput.WriteLine(prompt);process.StandardInput.Close();
                var timer=Stopwatch.StartNew();
                while(!process.WaitForExit(150)){
                    if(cancel.IsCancellationRequested||timer.ElapsedMilliseconds>=180000){
                        try{process.Kill();process.WaitForExit(3000);}catch{}
                        cancel.ThrowIfCancellationRequested();
                        throw new IOException("修复等待超时。原有版本保留。");
                    }
                }
                cancel.ThrowIfCancellationRequested();
                if(process.ExitCode!=0)throw new IOException("Codex 没能生成修复。请确认官方 Codex 已登录并能联网。原有版本保留。");
            }
            return Qualify(evidence,official.Version,ReadSmall(answer));
        }finally{
            foreach(string file in new[]{schema,answer})if(File.Exists(file))try{File.Delete(file);}catch(IOException){}
            if(!Directory.EnumerateFileSystemEntries(staging).Any())Directory.Delete(staging);
        }
    }
    static void VerifyEvidence(Observation evidence,string version)
    {
        DateTimeOffset observed;
        if(evidence==null||evidence.version!=version||!VersionNumber.IsMatch(version??"")||
           !DateTimeOffset.TryParse(evidence.at,out observed)||observed>DateTimeOffset.UtcNow.AddMinutes(1)||
           observed<DateTimeOffset.UtcNow.AddHours(-24)||evidence.pairs==null||evidence.pairs.Count==0||evidence.pairs.Count>20)
            throw new IOException("没有当前官方版本的界面记录。用 Spider Codex 打开一次有问题的聊天页，再试修复。原有版本保留。");
    }
}
