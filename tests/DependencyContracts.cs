using System;using System.Diagnostics;
class DependencyContracts{
 [STAThread]static void Main(string[] args){
  if(args.Length==1&&args[0]=="--version"){Console.WriteLine("v18.0.0");return;}
  bool oldRejected=false,missingRejected=false;
  try{RuntimeDependencies.ResolveNode(Process.GetCurrentProcess().MainModule.FileName);}catch(InvalidOperationException){oldRejected=true;}
  try{RuntimeDependencies.ResolveNode("C:\\SpiderCodex-missing-fixture-"+Guid.NewGuid()+"\\node.exe");}catch(InvalidOperationException){missingRejected=true;}
  if(!oldRejected||!missingRejected)throw new Exception("Unsupported or missing Node runtime was accepted");
  string current=RuntimeDependencies.ResolveNode(null);
  string profile=System.IO.Path.Combine(System.IO.Path.GetTempPath(),"Spider QA 中文");var client=new ProcessStartInfo("fixture-client.exe");var connector=new ProcessStartInfo("fixture-node.exe");RuntimeDependencies.IsolateProfile(client,profile);RuntimeDependencies.IsolateProfile(connector,profile);
  foreach(var info in new[]{client,connector})if(info.UseShellExecute||info.EnvironmentVariables["CODEX_HOME"]!=System.IO.Path.Combine(profile,"agent-home")||info.EnvironmentVariables["CODEX_ELECTRON_USER_DATA_PATH"]!=profile)throw new Exception("Client and connector profile scopes diverged");
  var normal=new ProcessStartInfo("fixture-normal.exe");normal.UseShellExecute=true;RuntimeDependencies.IsolateProfile(normal,"");if(!normal.UseShellExecute)throw new Exception("Normal launch configuration changed");
  Console.WriteLine(Spider.Json.Serialize(new{passed=true,oldRuntimeRejected=oldRejected,missingRuntimeRejected=missingRejected,installedRuntimeAccepted=!string.IsNullOrWhiteSpace(current),clientAndConnectorScopesMatch=true,normalProfilePreserved=true,officialClientInputs=0}));
 }
}
