using System;
using System.Drawing;

class ResizeFrameContracts {
    static void AssertPixel(Bitmap image,int x,int y,Color expected){
        if(image.GetPixel(x,y).ToArgb()!=expected.ToArgb())
            throw new InvalidOperationException("Resize preview changed an opaque edge pixel.");
    }
    static void Main(){
        var clock=new DateTime(2026,11,24,0,0,0,DateTimeKind.Utc);
        var next=DateTime.MinValue;
        if(!ResizePreview.ScheduleIdleCapture(clock,false,ref next))throw new Exception("Initial idle capture was missed.");
        for(int ms=16;ms<1000;ms+=16)
            if(ResizePreview.ScheduleIdleCapture(clock.AddMilliseconds(ms),false,ref next))
                throw new Exception("A rejected idle capture was retried too quickly.");
        if(!ResizePreview.ScheduleIdleCapture(clock.AddMilliseconds(1000),true,ref next)||
           ResizePreview.ScheduleIdleCapture(clock.AddMilliseconds(1349),true,ref next)||
           !ResizePreview.ScheduleIdleCapture(clock.AddMilliseconds(1350),true,ref next))
            throw new Exception("Edge capture cadence changed.");
        foreach(uint dpi in new uint[]{96,120,144,192}){
            var window=new Rectangle(-600,80,1000,800);
            if(!ResizePreview.IsSizingBorder(window,new Point(window.Right-2,window.Top+200),dpi))
                throw new InvalidOperationException("A native sizing edge was missed.");
            int iconInset=(int)(32*dpi/96);
            if(ResizePreview.IsSizingBorder(window,new Point(window.Left+iconInset,window.Top+200),dpi)||
               ResizePreview.IsSizingBorder(window,new Point(window.Left+500,window.Bottom-iconInset),dpi))
                throw new InvalidOperationException("A sidebar or composer action entered the sizing path.");
        }
        var start=Rectangle.FromLTRB(-600,80,200,580);
        var expected=new[]{
            Rectangle.FromLTRB(-560,80,200,580),Rectangle.FromLTRB(-600,80,240,580),
            Rectangle.FromLTRB(-600,110,200,580),Rectangle.FromLTRB(-560,110,200,580),
            Rectangle.FromLTRB(-600,110,240,580),Rectangle.FromLTRB(-600,80,200,610),
            Rectangle.FromLTRB(-560,80,200,610),Rectangle.FromLTRB(-600,80,240,610)
        };
        for(int i=0;i<expected.Length;i++){
            var forward=ResizePreview.PredictBounds(start,10+i,40,30);
            var reverse=ResizePreview.PredictBounds(forward,10+i,-40,-30);
            if(forward!=expected[i]||reverse!=start)
                throw new InvalidOperationException("Resize prediction moved the stationary edge: "+(10+i));
        }
        var color=Color.FromArgb(255,106,44,85);
        var sizes=new[]{new Size(741,569),new Size(301,220),new Size(825,220),new Size(305,597)};
        int samples=0;
        using(var capture=new Bitmap(160,120))
        using(var graphics=Graphics.FromImage(capture)){
            graphics.Clear(Color.Black);
            if(ResizePreview.HasWindowPixels(capture))throw new InvalidOperationException("Empty capture was accepted.");
            graphics.FillRectangle(Brushes.MediumVioletRed,80,0,80,120);
            if(!ResizePreview.HasWindowPixels(capture))throw new InvalidOperationException("Painted capture was rejected.");
        }
        int blankEdges=0;
        using(var capture=new Bitmap(720,480))
        using(var graphics=Graphics.FromImage(capture))
        using(var nativeFill=new SolidBrush(Color.FromArgb(17,16,19))){
            var cases=new[]{
                new Rectangle(0,0,74,480),new Rectangle(645,0,75,480),
                new Rectangle(0,0,720,36),new Rectangle(0,420,720,60),
                new Rectangle(702,0,18,480),new Rectangle(0,462,720,18)
            };
            foreach(var band in cases){
                graphics.Clear(color);
                graphics.FillRectangle(nativeFill,band);
                if(!ResizePreview.HasUnpaintedEdge(capture))
                    throw new InvalidOperationException("A partially painted capture was accepted.");
                blankEdges++;
            }
            graphics.Clear(color);
            graphics.FillRectangle(nativeFill,700,200,20,90);
            graphics.FillRectangle(nativeFill,0,0,720,8);
            if(ResizePreview.HasUnpaintedEdge(capture))
                throw new InvalidOperationException("Normal dark details were mistaken for a blank band.");
        }
        using(var source=new Bitmap(430,330))
        using(var sampling=ResizePreview.CreateEdgeSampling()){
            using(var graphics=Graphics.FromImage(source))graphics.Clear(color);
            foreach(var size in sizes){
                using(var frame=new Bitmap(size.Width,size.Height)){
                    using(var graphics=Graphics.FromImage(frame)){
                        graphics.Clear(Color.Black);
                        ResizePreview.DrawFrame(graphics,source,new Rectangle(Point.Empty,size),sampling);
                    }
                    for(int x=0;x<frame.Width;x++){
                        AssertPixel(frame,x,0,color);
                        AssertPixel(frame,x,frame.Height-1,color);
                        samples+=2;
                    }
                    for(int y=1;y<frame.Height-1;y++){
                        AssertPixel(frame,0,y,color);
                        AssertPixel(frame,frame.Width-1,y,color);
                        samples+=2;
                    }
                }
            }
        }
        Console.WriteLine(Spider.Json.Serialize(new{passed=true,opaqueEdgeSamples=samples,resizeCases=sizes.Length,directionalSteps=expected.Length*2,blankEdgesRejected=blankEdges,rejectedIdleCaptureThrottled=true,edgeCaptureCadencePreserved=true,officialClientInputs=0}));
    }
}
