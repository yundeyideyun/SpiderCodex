using System;
using System.IO;
using System.Threading;

class StateFileContracts {
    static void Main(){
        try{Run();}
        catch(Exception error){Console.Error.WriteLine(error.GetType().FullName);Console.Error.WriteLine(error.Message);Environment.ExitCode=1;}
    }
    static void Run(){
        Spider.Init();
        string name="atomic-contract-"+Guid.NewGuid().ToString("N")+".json";
        string path=Spider.FileAt(name);
        int errors=0,reads=0;
        var failures=new System.Collections.Concurrent.ConcurrentQueue<string>();
        try{
            Spider.Write(name,new{value=0,payload=new string('a',4096)});
            var writers=new Thread[2];
            for(int i=0;i<writers.Length;i++){
                writers[i]=new Thread(delegate(){
                    try{for(int n=0;n<80;n++)Spider.Write(name,new{value=n,payload=new string('b',4096)});}
                    catch(Exception error){failures.Enqueue(error.GetType().Name+" "+error.Message);Interlocked.Increment(ref errors);}
                });
                writers[i].Start();
            }
            while(writers[0].IsAlive||writers[1].IsAlive){
                var value=Spider.Read(name);
                if(!value.ContainsKey("value")||!value.ContainsKey("payload"))errors++;
                reads++;
            }
            foreach(var thread in writers)thread.Join();
            if(errors!=0||reads==0)throw new Exception("Concurrent state exchange lost a complete record. Errors="+errors+" reads="+reads+" writers="+String.Join(" | ",failures.ToArray()));
            var original=File.ReadAllBytes(path);
            bool blocked=false;
            using(var held=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read)){
                try{Spider.Write(name,new{value=999});}catch(IOException){blocked=true;}
            }
            if(!blocked||Convert.ToBase64String(original)!=Convert.ToBase64String(File.ReadAllBytes(path)))
                throw new Exception("A blocked publication must preserve the prior state and report failure.");
            if(Directory.GetFiles(Spider.State,name+".*.tmp").Length!=0)throw new Exception("Staging files leaked.");
            Console.WriteLine(Spider.Json.Serialize(new{passed=true,concurrentWrites=160,reads=reads,blockedWritePreserved=true,stagingCleaned=true}));
        }finally{
            if(File.Exists(path))File.Delete(path);
        }
    }
}
