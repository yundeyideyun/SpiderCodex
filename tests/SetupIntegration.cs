using System;
using System.IO;
using System.Diagnostics;
using System.Linq;
using System.Security.Cryptography;
using System.Web.Script.Serialization;

internal class SetupIntegration
{
    internal static void Expect(bool result,string detail){if(!result)throw new InvalidOperationException(detail);}
    [STAThread] static void Main(string[] args)
    {
        string sandbox=Path.GetFullPath(args[2]);
        if(Directory.Exists(sandbox))throw new IOException("Use a new test directory.");
        Directory.CreateDirectory(sandbox);
        string desktop=Directory.CreateDirectory(Path.Combine(sandbox,"desktop")).FullName;
        string root=Path.Combine(sandbox,"Programs 测试","Spider Codex");
        string link=Path.Combine(desktop,"Spider Codex.lnk");
        var app=new UserSetup(root,desktop);
        string old=Path.GetFullPath(args[0]),next=Path.GetFullPath(args[1]);
        string oldVersion,newVersion;ReleaseSelection.Verify(old,out oldVersion);ReleaseSelection.Verify(next,out newVersion);
        string oldName="R"+oldVersion.Split('.').Last().Split('-')[0],newName="R"+newVersion.Split('.').Last().Split('-')[0];

        bool oldBundled=File.Exists(Path.Combine(old,"tools","node","node.exe"));
        bool newBundled=File.Exists(Path.Combine(next,"tools","node","node.exe"));
        string originalPath=Environment.GetEnvironmentVariable("PATH");
        bool missingNode=false;
        try{
            Environment.SetEnvironmentVariable("PATH",Environment.GetFolderPath(Environment.SpecialFolder.System));
            if(newBundled)Diagnostics.RequireInstallReady(next);
            if(!oldBundled){
                try{app.Install(old,Diagnostics.RequireInstallReady);}
                catch(InvalidOperationException error){missingNode=error.Message.Contains("Node.js");}
            }
        }finally{Environment.SetEnvironmentVariable("PATH",originalPath);}
        Expect((oldBundled||missingNode)&&!Directory.Exists(root)&&!File.Exists(link),"Prerequisite checks left an installation footprint");

        app.Install(old);
        Expect(File.Exists(link)&&app.Current=="releases/"+oldName,"First install failed");
        VerifyInstalledEntries(root,oldName);
        string setting=Path.Combine(root,ReleasePointer.ExperienceFile);
        string oldRelease=Path.Combine(root,"releases",oldName);
        Expect(app.Experience==null&&!ReleasePointer.FullExperienceForLaunch(oldRelease,new string[0]),"Existing installations must default to lightweight mode");
        app.SaveExperience(true);
        Expect(app.Experience==true&&ReleasePointer.FullExperienceForLaunch(oldRelease,new string[0]),"Full mode failed for the normal launch");
        Expect(!ReleasePointer.FullExperienceForLaunch(oldRelease,new[]{"--profile","fixture"})&&!ReleasePointer.FullExperienceForLaunch(oldRelease,new[]{"--lightweight"}),"An isolated or explicitly light launch inherited full mode");
        var initialLink=File.ReadAllBytes(link);
        app.Install(old);
        Expect(initialLink.SequenceEqual(File.ReadAllBytes(link)),"Idempotent install rewrote link");
        if(oldName==newName){
            VerifySameVersionRefresh(app,root,link,initialLink,old,next,oldName);
            return;
        }
        string data=Path.Combine(root,"personal.txt");File.WriteAllText(data,"personal file");
        Directory.CreateDirectory(Path.Combine(root,"releases",".install-"+newName));
        string retryFile=Path.Combine(root,"releases",".install-"+newName,"SpiderCodex.exe");
        File.WriteAllBytes(retryFile,new byte[]{1,2,3});
        app.Install(next);
        Expect(app.Current=="releases/"+newName && File.Exists(data),"Interrupted staging was not recovered");
        VerifyInstalledEntries(root,newName);
        Expect(app.Experience==true,"Upgrade forgot the selected experience");
        Expect(initialLink.SequenceEqual(File.ReadAllBytes(link)),"An upgrade changed the desktop shortcut");
        VerifyLaunchMode(root,true);
        app.SaveExperience(false);
        VerifyLaunchMode(root,false);
        Expect(initialLink.SequenceEqual(File.ReadAllBytes(link)),"Changing experience changed the desktop shortcut");
        ReleaseSelection.Switch(root,oldName);
        Expect(app.Current=="releases/"+oldName,"Rollback failed");
        VerifyInstalledEntries(root,oldName);
        app.Install(next);
        string modified=Path.Combine(root,"releases",oldName,"assets","v5","reference-ui.json");
        File.AppendAllText(modified," user change");
        app.Uninstall();
        Expect(!File.Exists(link)&&!File.Exists(setting)&&File.Exists(modified)&&File.ReadAllText(data)=="personal file"&&!app.Managed,"User file or shortcut ownership error");
        bool refused=false;try{app.Install(next);}catch(IOException){refused=true;}
        Expect(refused,"Unmanaged nonempty directory claimed");

        var second=new UserSetup(Path.Combine(sandbox,"second"),desktop);
        File.WriteAllText(link,"Existing foreign entry");
        second.Install(next,null,true);
        Expect(second.Experience==true,"First install did not save the chosen experience");
        Expect(File.ReadAllText(link)=="Existing foreign entry","Foreign shortcut overwritten");
        second.Uninstall();
        Expect(File.ReadAllText(link)=="Existing foreign entry" && !Directory.Exists(Path.Combine(sandbox,"second")),"Clean removal or foreign shortcut failed");
        Console.WriteLine(new JavaScriptSerializer().Serialize(new{passed=true,noNodeInstallRejected=missingNode,bundledNodePreflightWithoutSystemNode=newBundled,noFootprintAfterPreflight=true,unicodeAndSpaceInstallPath=true,firstInstall=true,repeatInstall=true,resumedStaging=true,upgrade=true,rollback=true,uninstall=true,modifiedAndUnknownFilesPreserved=true,existingShortcutPreserved=true,emptyInstallTreeRemoved=true,bothEntryHashesVerified=true,experienceSavedAtInstall=true,experiencePreservedAcrossUpgrade=true,experienceChangedWithoutNewShortcut=true,launchPreferenceVerifiedAtStableEntryTarget=true,experienceRemovedOnUninstall=true,officialClientsStarted=0}));
    }

    static void VerifyLaunchMode(string root,bool expected){
        string runtime=ReleasePointer.VerifiedEntry(root,"SpiderCodex.exe");
        var start=new ProcessStartInfo(runtime,"--probe-effect-mode --stdout"){
            UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true
        };
        using(var process=Process.Start(start)){
            var answer=process.StandardOutput.ReadToEndAsync();
            Expect(process.WaitForExit(8000)&&process.ExitCode==0,"The verified launcher diagnostic did not finish");
            var result=new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string,object>>(answer.GetAwaiter().GetResult());
            Expect(Equals(result["dynamicWallpaper"],expected)&&Equals(result["intro"],expected)&&Equals(result["theme"],true),
                "The packaged launcher did not read the stored experience mode");
        }
    }

    static void VerifyInstalledEntries(string root,string tag){
        string target=Path.Combine(root,"releases",tag);
        foreach(string entry in new[]{"SpiderCodex.exe","恢复原界面和桌面.exe"})
            Expect(ReleasePointer.VerifiedEntry(root,entry)==Path.Combine(target,entry),"The installed entry selected the wrong release: "+entry);
    }

    static void VerifySameVersionRefresh(UserSetup app,string root,string link,byte[] initialLink,string old,string next,string tag){
        const string manifest="release-manifest.json";
        byte[] oldManifest=File.ReadAllBytes(Path.Combine(old,manifest));
        byte[] newManifest=File.ReadAllBytes(Path.Combine(next,manifest));
        Expect(!oldManifest.SequenceEqual(newManifest),"The test requires different packages of one release.");
        string target=Path.Combine(root,"releases",tag);
        string userFile=Path.Combine(root,"personal.txt");
        File.WriteAllText(userFile,"Preserve my file");
        string pointer=Path.Combine(root,"current-release.json");
        byte[] before=File.ReadAllBytes(pointer);
        string node=Path.Combine(target,"tools","node","node.exe");
        bool runningBlocked=false;
        if(File.Exists(node)){
            using(var child=Process.Start(new ProcessStartInfo(node,"-e "+Spider.Quote("setTimeout(()=>{},30000)")){UseShellExecute=false,CreateNoWindow=true})){
                try{app.Install(next);}catch(IOException e){runningBlocked=e.Message.Contains("仍在运行");}
                finally{if(!child.HasExited){child.Kill();child.WaitForExit(5000);}}
            }
            Expect(runningBlocked&&before.SequenceEqual(File.ReadAllBytes(pointer)),"Refresh ignored an active package");
        }

        // Simulate interruption after the directory moves but before receipt publication.
        string journal=Path.Combine(root,"receipts",".refresh-"+tag);
        Directory.CreateDirectory(journal);
        File.WriteAllBytes(Path.Combine(journal,"pointer.json"),before);
        File.WriteAllBytes(Path.Combine(journal,"receipt.json"),oldManifest);
        using(var sha=SHA256.Create())
            File.WriteAllText(Path.Combine(journal,"next.sha256"),BitConverter.ToString(sha.ComputeHash(newManifest)).Replace("-",""));
        Directory.Move(target,Path.Combine(journal,"previous"));
        Directory.CreateDirectory(target);
        foreach(var entry in new JavaScriptSerializer().Deserialize<ReleaseSelection.ReleaseFiles>(File.ReadAllText(Path.Combine(next,manifest))).files){
            string destination=Path.Combine(target,entry.path);
            Directory.CreateDirectory(Path.GetDirectoryName(destination));
            File.Copy(Path.Combine(next,entry.path),destination);
        }
        File.WriteAllBytes(Path.Combine(target,manifest),newManifest);
        app.Install(next);
        Expect(app.Current=="releases/"+tag,"Refresh changed the visible release name");
        Expect(newManifest.SequenceEqual(File.ReadAllBytes(Path.Combine(target,manifest))),"Refresh left the old package installed");
        Expect(initialLink.SequenceEqual(File.ReadAllBytes(link)),"Refresh changed the existing shortcut");
        Expect(File.ReadAllText(userFile)=="Preserve my file","Refresh changed user data");
        Expect(Directory.GetDirectories(Path.Combine(root,"releases")).Length==1,"Refresh left a duplicate release directory");
        Expect(!Directory.Exists(journal),"Refresh did not retire the completed journal");
        string installedVersion;ReleaseSelection.Verify(target,out installedVersion);
        VerifyInstalledEntries(root,tag);

        string userEdited=Path.Combine(target,"assets","v5","reference-ui.json");
        File.AppendAllText(userEdited," user change");
        byte[] priorPointer=File.ReadAllBytes(pointer);
        bool blocked=false;
        try{app.Install(old);}catch(IOException){blocked=true;}
        Expect(blocked,"Refresh overwrote a user-edited installation");
        Expect(File.ReadAllText(userEdited).EndsWith(" user change"),"Refresh modified edited bytes");
        Expect(priorPointer.SequenceEqual(File.ReadAllBytes(pointer)),"Rejected refresh changed entry");
        Console.WriteLine(new JavaScriptSerializer().Serialize(new{passed=true,sameReleaseRefresh=true,shortcutPreserved=true,
            userDataPreserved=true,onlyOneReleaseDirectory=true,editedPackageRejected=true,runningPackageRejected=runningBlocked,
            interruptedRefreshRecovered=true,bothEntryHashesVerified=true,officialClientsStarted=0}));
    }
}
