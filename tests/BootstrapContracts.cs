using System;using System.IO;using System.Diagnostics;using System.Security.Cryptography;
class BootstrapContracts{
 [STAThread]static void Main(string[] args){
  if(args.Length==3&&args[0]=="--restart-fixture"){
   File.WriteAllText(args[1],Spider.Json.Serialize(new[]{Process.GetCurrentProcess().MainModule.FileName,Environment.CurrentDirectory,args[2]}));
   return;
  }
  string root=Path.Combine(Path.GetTempPath(),"Spider Source 中文");string expected=Path.Combine(root,"releases","R41","SpiderCodex.exe");
  if(ReleasePointer.Resolve(root,"releases/R41","SpiderCodex.exe")!=expected)throw new Exception("Versioned path changed");
  int rejected=0;
  foreach(string relative in new[]{".","../outside","C:\\outside"})try{ReleasePointer.Resolve(root,relative,"SpiderCodex.exe");}catch(InvalidOperationException){rejected++;}
  try{ReleasePointer.Resolve(root,"releases/R41","other.exe");}catch(InvalidOperationException){rejected++;}
  if(rejected!=4)throw new Exception("Invalid release target accepted");
  string binary=Process.GetCurrentProcess().MainModule.FileName,digest;
  using(var file=File.OpenRead(binary))using(var sha=SHA256.Create())digest=BitConverter.ToString(sha.ComputeHash(file)).Replace("-","");
  ReleasePointer.EnsureMatches(binary,digest,Spider.Version);
  bool changed=false,wrongVersion=false;
  try{ReleasePointer.EnsureMatches(binary,new string('0',64),Spider.Version);}catch(InvalidOperationException){changed=true;}
  try{ReleasePointer.EnsureMatches(binary,digest,"different-version");}catch(InvalidOperationException){wrongVersion=true;}
  if(!changed||!wrongVersion)throw new Exception("Changed program accepted");
  root=Path.Combine(Path.GetTempPath(),"Spider restart "+Guid.NewGuid().ToString("N"));
  string releases=Path.Combine(root,"releases"),old=Path.Combine(releases,"R57"),next=Path.Combine(releases,"R58");
  string pointer=Path.Combine(root,"current-release.json"),result=Path.Combine(root,"selected.json"),selected=Path.Combine(next,"SpiderCodex.exe");
  Directory.CreateDirectory(old);Directory.CreateDirectory(next);
  try{
   if(ReleasePointer.RestartEntry(old)!=Path.Combine(old,"SpiderCodex.exe"))throw new Exception("Standalone restart changed");
   File.Copy(binary,selected);
   File.WriteAllText(pointer,Spider.Json.Serialize(new{schemaVersion=1,relativeDirectory="releases/R58",version=Spider.Version,
    programs=new System.Collections.Generic.Dictionary<string,string>{{"SpiderCodex.exe",digest}}}));
   using(var child=ReleasePointer.Start(ReleasePointer.RestartEntry(old+Path.DirectorySeparatorChar),new[]{"--restart-fixture",result,"测试 空格"})){
    if(child==null||!child.WaitForExit(4000)||child.ExitCode!=0)throw new Exception("Reopen child did not finish.");
   }
   var actual=Spider.Json.Deserialize<string[]>(File.ReadAllText(result));
   if(actual==null||actual.Length!=3||actual[0]!=selected||actual[1]!=next||actual[2]!="测试 空格")
    throw new Exception("Reopen did not use the verified selected release and working directory.");
   File.WriteAllText(pointer,File.ReadAllText(pointer).Replace(digest,new string('0',64)));
   bool refused=false;try{ReleasePointer.RestartEntry(old);}catch(InvalidOperationException){refused=true;}
   if(!refused)throw new Exception("Invalid restart pointer accepted");
  }finally{
   foreach(string file in new[]{pointer,result,selected})File.Delete(file);
   foreach(string directory in new[]{old,next,releases,root})Directory.Delete(directory);
  }
  Console.WriteLine(Spider.Json.Serialize(new{passed=true,validVersionedPath=true,unsafePathsRejected=rejected,changedHashRejected=changed,changedVersionRejected=wrongVersion,reopenedSelectedRelease=true,rejectedCorruptRestartPointer=true,processLaunches=1}));
 }
}
