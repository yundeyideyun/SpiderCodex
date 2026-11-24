using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;

static class CompatibilityRepairContracts
{
    static void Expect(bool condition,string message){if(!condition)throw new Exception(message);}
    static void Main(string[] args)
    {
        const string version="26.1120.5083.0";
        string directory=Path.GetFullPath(args[0]);
        Directory.CreateDirectory(directory);
        var evidence=new CompatibilityRepair.Observation{
            version=version,at=DateTimeOffset.UtcNow.ToString("o"),
            pairs=new List<CompatibilityRepair.AnchorPair>{
                new CompatibilityRepair.AnchorPair{mainAttribute="data-new-shell",composerAttribute="data-new-composer"},
                new CompatibilityRepair.AnchorPair{mainAttribute="data-new-shell",composerAttribute="data-other-composer"}
            }
        };
        string candidate="{\"mainAttribute\":\"data-new-shell\",\"composerAttribute\":\"data-new-composer\"}";
        var validated=CompatibilityRepair.Qualify(evidence,version,candidate);
        Expect(CompatibilityRepair.CurrentPreset(directory,version)==null,"Staging changed the live preset");
        CompatibilityRepair.Apply(directory,validated,version);
        string applied=CompatibilityRepair.CurrentPreset(directory,version);
        Expect(applied!=null&&applied.Contains("data-new-composer"),"Valid repair did not apply");
        Expect(CompatibilityRepair.CurrentPreset(directory,"26.1120.5084.0")==null,"Repair crossed an official version boundary");
        int refused=0;
        foreach(string bad in new[]{"{}","{\"mainAttribute\":\"data-new-shell]\" ,\"composerAttribute\":\"data-new-composer\"}",
                                    "{\"mainAttribute\":\"data-unobserved\",\"composerAttribute\":\"data-new-composer\"}"}){
            try{CompatibilityRepair.Qualify(evidence,version,bad);}
            catch(IOException){refused++;}
        }
        Expect(refused==3&&CompatibilityRepair.CurrentPreset(directory,version)==applied,"Failure replaced the working preset");
        var another=CompatibilityRepair.Qualify(evidence,version,candidate.Replace("data-new-composer","data-other-composer"));
        CompatibilityRepair.Apply(directory,another,version);
        CompatibilityRepair.RollBack(directory);
        Expect(CompatibilityRepair.CurrentPreset(directory,version)==applied,"Rollback did not restore the previous version");
        CompatibilityRepair.RollBack(directory);
        Expect(CompatibilityRepair.CurrentPreset(directory,version)==null,"Rollback did not restore defaults");
        bool cancelled=false;
        try{CompatibilityRepair.PrepareFromEvidence(evidence,null,new CancellationToken(true));}
        catch(OperationCanceledException){cancelled=true;}
        Expect(cancelled,"Cancellation did not stop the request before it started");
        if(args.Length>1&&args[1]=="--real-codex"){
            evidence.pairs.RemoveAt(1);
            var real=CompatibilityRepair.PrepareFromEvidence(evidence,InstalledClient.Resolve(),CancellationToken.None);
            Expect(real!=null,"The real Codex request did not produce a valid candidate");
        }
        Console.WriteLine(Spider.Json.Serialize(new{passed=true,validRepair=true,rejectedInvalidResults=refused,
            originalPreservedOnFailure=true,versionBound=true,rollback=true,cancelled=true,realCodex=args.Length>1}));
    }
}
