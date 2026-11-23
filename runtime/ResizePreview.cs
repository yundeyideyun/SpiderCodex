using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

// Normal-z-order, input-transparent sizing preview. Never terminates the client.
internal sealed class ResizePreview : Form {
    [StructLayout(LayoutKind.Sequential)] struct DibHeader {
        public uint size; public int width,height; public ushort planes,bits;
        public uint compression,imageSize; public int xppm,yppm; public uint colors,important;
    }
    [StructLayout(LayoutKind.Sequential,Pack=1)] struct Blend {public byte op,flags,alpha,format;}
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr h);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr h,IntPtr dc);
    [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h,uint command);
    [DllImport("user32.dll")] static extern int GetSystemMetricsForDpi(int index,uint dpi);
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr item);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr item);
    [DllImport("gdi32.dll",SetLastError=true)] static extern IntPtr CreateDIBSection(IntPtr dc,ref DibHeader header,uint usage,out IntPtr bits,IntPtr section,uint offset);
    [DllImport("user32.dll",SetLastError=true)] static extern bool UpdateLayeredWindow(IntPtr h,IntPtr dc,ref Native.POINT point,ref Native.POINT size,IntPtr source,ref Native.POINT origin,uint key,ref Blend blend,uint flags);
    const uint MoveSizeStart=0x000A,MoveSizeEnd=0x000B,LocationChange=0x800B;
    const int EdgeCaptureMs=350,StableResizeMs=125,ReleasePaintMs=105,ResizeCaptureIntervalMs=105;
    delegate void LocationCallback(IntPtr handle,uint message,IntPtr window,int objectId,int childId,uint eventThread,uint eventTime);
    [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SetWinEventHook(uint first,uint last,IntPtr module,LocationCallback callback,uint process,uint thread,uint flags);
    [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr hook);
    delegate IntPtr MouseCallback(int code, IntPtr message, IntPtr data);
    [StructLayout(LayoutKind.Sequential)] struct MouseData { public Native.POINT point; public uint mouseData,flags,time; public IntPtr extra; }
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h,out Native.RECT r);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h,ref Native.POINT p);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id,MouseCallback callback,IntPtr module,uint thread);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
    sealed class OwnerWindow : IWin32Window { public IntPtr Handle { get; private set; } public OwnerWindow(IntPtr h){Handle=h;} }
    readonly System.Windows.Forms.Timer pulse=new System.Windows.Forms.Timer();
    readonly ImageAttributes edgeSampling=CreateEdgeSampling();
    readonly string telemetryFile;
    volatile bool stopping;
    IntPtr target,requestedTarget,hook,locationHook,moveSizeHook;
    LocationCallback locationCallback;
    int reconciled,nativeFallbackStarts,hitTests,captionExpansions;
    Rectangle lastPreviewBounds,lastActualBounds,preparedCaptionBounds;
    MouseCallback callback;
    Bitmap frame;
    readonly object captureLock=new object();
    Bitmap capturedWindow;
    IntPtr capturedTarget;
    Rectangle capturedBounds;
    DateTime capturedAt;
    bool capturePending;
    bool windowFrame;
    int windowCaptures,desktopFallbacks,rejectedBands,liveResizeFrames,readyHandoffs;
    IntPtr screenDc,memoryDc,dib,previousBitmap;
    Bitmap layer;
    Graphics painter;
    bool tracking,nativeSizing,extendedRelease,captionTransition;
    int edge,starts;
    Point dragOrigin;
    Rectangle dragBounds;
    DateTime releaseAt=DateTime.MaxValue,nextCapture,nextWindowCapture,nextLog,activationDeadline,captionCapturedAt;
    DateTime lastResizeChange,nextResizeCapture,releaseStarted;
    internal ResizePreview(IntPtr h,string suffix=""){requestedTarget=h;telemetryFile=suffix==".qa"?"resize-preview.qa.json":"resize-preview.json";var thread=new Thread(Run);thread.IsBackground=true;thread.SetApartmentState(ApartmentState.STA);thread.Start();}
    internal void Track(IntPtr h){Interlocked.Exchange(ref requestedTarget,h);}
    internal void Stop(){stopping=true;}
    protected override bool ShowWithoutActivation { get { return true; } }
    protected override CreateParams CreateParams { get { var p=base.CreateParams;p.ExStyle|=0x80|0x20|0x80000|0x08000000;return p; } }
    void Run(){
        FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;StartPosition=FormStartPosition.Manual;DoubleBuffered=true;Text="Spider Codex Resize Preview";
        callback=OnMouse;hook=SetWindowsHookEx(14,callback,GetModuleHandle(null),0);
        locationCallback=OnLocation;UpdateTarget();
        pulse.Interval=16;pulse.Tick+=delegate{try{Tick();}catch(Exception e){Clear();Spider.Log("resize-preview",e.Message);}};pulse.Start();
        try{Application.Run();}finally{stopping=true;lock(captureLock){if(capturedWindow!=null)capturedWindow.Dispose();capturedWindow=null;}ReleaseLocationHook();if(hook!=IntPtr.Zero)UnhookWindowsHookEx(hook);Clear();pulse.Dispose();DisposeLayer();edgeSampling.Dispose();Dispose();}
    }
    void ReleaseLocationHook(){
        if(locationHook!=IntPtr.Zero)UnhookWinEvent(locationHook);
        if(moveSizeHook!=IntPtr.Zero)UnhookWinEvent(moveSizeHook);
        locationHook=moveSizeHook=IntPtr.Zero;
    }
    void UpdateTarget(){
        IntPtr next=Interlocked.CompareExchange(ref requestedTarget,IntPtr.Zero,IntPtr.Zero);
        if(target==next)return;
        Clear();
        ReleaseLocationHook();
        target=next;
        if(target==IntPtr.Zero)return;
        uint owner;
        Native.GetWindowThreadProcessId(target,out owner);
        if(owner!=0){
            locationHook=SetWinEventHook(LocationChange,LocationChange,IntPtr.Zero,locationCallback,owner,0,0);
            moveSizeHook=SetWinEventHook(MoveSizeStart,MoveSizeEnd,IntPtr.Zero,locationCallback,owner,0,0);
        }
    }
    void OnLocation(IntPtr hook,uint message,IntPtr window,int objectId,int childId,uint eventThread,uint eventTime){
        if(window!=target||objectId!=0||childId!=0)return;
        if(!Native.IsWindow(target)||Native.IsIconic(target))return;
        if(message==MoveSizeStart){
            nativeSizing=true;
            try{
                if(Native.GetForegroundWindow()!=target)activationDeadline=DateTime.UtcNow.AddMilliseconds(250);
                if(!tracking||releaseAt!=DateTime.MaxValue)TryStartSizing(Cursor.Position,true);
            }catch(Exception error){Clear();Spider.Log("resize-preview",error.Message);}
            return;
        }
        if(Native.GetForegroundWindow()!=target)return;
        if(message==MoveSizeEnd){
            nativeSizing=false;
            if(tracking){
                // Mouse-up can precede the end of Windows' modal sizing loop.
                // Start the handoff at the confirmed end so both windows agree.
                releaseAt=DateTime.MaxValue;
                BeginRelease();
                SynchronizeBounds();
            }
            return;
        }
        CheckCaptionExpansion();
        SynchronizeBounds();
    }
    void CheckCaptionExpansion(){
        if(captionCapturedAt==DateTime.MinValue&&!captionTransition)return;
        bool zoomed=IsZoomed(target);
        if(!zoomed&&captionTransition){Clear();return;}
        var now=DateTime.UtcNow;
        if(!captionTransition&&now-captionCapturedAt>TimeSpan.FromMilliseconds(900)){
            captionCapturedAt=DateTime.MinValue;
            preparedCaptionBounds=Rectangle.Empty;
            return;
        }
        if(!zoomed||tracking||nativeSizing||frame==null)return;
        var applied=ClientBounds();
        if(!Expands(applied))return;
        // The caption maximizes outside the native mouse-drag loop. Bridge
        // this one expansion with the fresh frame captured on the caption press.
        tracking=true;
        captionTransition=true;
        edge=0;
        dragBounds=Rectangle.Empty;
        extendedRelease=true;
        releaseAt=now.AddMilliseconds(950);
        captionExpansions++;
    }
    void SynchronizeBounds(){
        if(frame==null||(!tracking&&!nativeSizing))return;
        // Low-level mouse carries the prediction; the native sizing loop can
        // apply rounding or catch up to a coalesced move after that callback.
        try{
            var applied=ClientBounds();
            if(applied.Width<100||applied.Height<100)return;
            if(!tracking){
                // Native sizing also starts when a mouse hook misses the press.
                // Moving the caption alone should never bring up the preview.
                if(applied.Width==frame.Width&&applied.Height==frame.Height)return;
                tracking=true;edge=0;releaseAt=DateTime.MaxValue;extendedRelease=false;starts++;nativeFallbackStarts++;
            }
            if(releaseAt!=DateTime.MaxValue&&!extendedRelease&&Expands(applied)){
                extendedRelease=true;releaseAt=DateTime.UtcNow.AddMilliseconds(760);
            }
            if(applied!=lastActualBounds){
                lastActualBounds=applied;
                lastResizeChange=DateTime.UtcNow;
            }else if(edge>=10&&releaseAt==DateTime.MaxValue)return;
            if(Visible&&applied==lastPreviewBounds)return;
            reconciled++;
            Render(applied);
        }catch(Exception error){Clear();Spider.Log("resize-preview",error.Message);}

    }
    bool Expands(Rectangle bounds){
        if(frame==null)return false;
        var originalSize=dragBounds.IsEmpty?frame.Size:dragBounds.Size;
        return bounds.Width>originalSize.Width||bounds.Height>originalSize.Height;
    }
    void BeginRelease(){
        if(releaseAt!=DateTime.MaxValue)return;
        // A renderer can keep the old buffer briefly after an expanding drag ends.
        extendedRelease=Expands(ClientBounds());
        releaseStarted=DateTime.UtcNow;
        releaseAt=releaseStarted.AddMilliseconds(extendedRelease?760:160);
    }
    void Clear(){tracking=false;nativeSizing=false;extendedRelease=false;captionTransition=false;windowFrame=false;releaseAt=DateTime.MaxValue;activationDeadline=DateTime.MinValue;captionCapturedAt=DateTime.MinValue;releaseStarted=DateTime.MinValue;dragBounds=Rectangle.Empty;preparedCaptionBounds=Rectangle.Empty;if(Visible)Hide();if(frame!=null){frame.Dispose();frame=null;}}
    Rectangle ClientBounds(){Native.RECT r;GetClientRect(target,out r);var p=new Native.POINT(0,0);ClientToScreen(target,ref p);return new Rectangle(p.X,p.Y,r.Right,r.Bottom);}
    Rectangle WindowBounds(){Native.RECT r;Native.GetWindowRect(target,out r);return Rectangle.FromLTRB(r.Left,r.Top,r.Right,r.Bottom);}
    static bool NearBorder(Rectangle bounds,Point point,int margin){
        return Rectangle.Inflate(bounds,margin,margin).Contains(point)&&!Rectangle.Inflate(bounds,-margin,-margin).Contains(point);
    }
    internal static bool IsSizingBorder(Rectangle bounds,Point point,uint dpi){
        int frame=Math.Max(GetSystemMetricsForDpi(32,dpi),GetSystemMetricsForDpi(33,dpi));
        int padding=GetSystemMetricsForDpi(92,dpi);
        return NearBorder(bounds,point,frame+padding+2);
    }
    int Hit(Point p){hitTests++;long packed=((long)(p.Y&65535)<<16)|(uint)(p.X&65535);IntPtr result;return Native.SendMessageTimeout(target,0x84,IntPtr.Zero,new IntPtr(packed),2,50,out result)!=IntPtr.Zero?result.ToInt32():0;}
    void TryStartSizing(Point point,bool fallback){
        if(!IsSizingBorder(WindowBounds(),point,GetDpiForWindow(target)))return;
        int hit=Hit(point);
        if(hit<10||hit>17)return;
        var startBounds=ClientBounds();
        if(!UseWindowCapture(startBounds)&&(frame==null||frame.Width!=startBounds.Width||frame.Height!=startBounds.Height)){
            // Keep the last painted frame if Chromium has yet to fill the new size.
            Cache(startBounds);
        }
        if(frame==null)return;
        edge=hit;dragOrigin=point;dragBounds=startBounds;lastActualBounds=dragBounds;
        lastResizeChange=DateTime.UtcNow;
        tracking=true;extendedRelease=false;releaseAt=DateTime.MaxValue;starts++;
        if(fallback)nativeFallbackStarts++;
        if(Native.GetForegroundWindow()==target)Render(dragBounds);
        else activationDeadline=DateTime.UtcNow.AddMilliseconds(250);
    }
    void CaptureCaption(Point point){
        if(tracking||nativeSizing)return;
        var bounds=WindowBounds();
        var captionScale=GetDpiForWindow(target)/96.0;
        int fromRight=bounds.Right-point.X;
        if(!bounds.Contains(point)||point.Y-bounds.Top>=58*captionScale||fromRight>125*captionScale||fromRight<35*captionScale||IsZoomed(target))return;
        if(Native.GetAncestor(Native.WindowFromPoint(new Native.POINT(point.X,point.Y)),2)!=target)return;
        if(Hit(point)!=9)return; // HTMAXBUTTON
        if(!Cache(ClientBounds()))return;
        // Prepare the pixels while the original window is still visible.
        // The overlay only becomes visible once Windows applies the new bounds.
        var workArea=Screen.FromHandle(target).WorkingArea;
        PaintLayer(workArea.Size,false);
        preparedCaptionBounds=workArea;
        captionCapturedAt=DateTime.UtcNow;
    }
    internal static bool HasWindowPixels(Bitmap image){
        // GPU window capture can return success with an empty, solid buffer.
        int distinct=0;
        var first=image.GetPixel(image.Width/10,image.Height/10);
        for(int y=1;y<10;y+=2)for(int x=1;x<10;x+=2){
            var pixel=image.GetPixel(image.Width*x/10,image.Height*y/10);
            if(Math.Abs(first.R-pixel.R)+Math.Abs(first.G-pixel.G)+Math.Abs(first.B-pixel.B)>24)distinct++;
        }
        return distinct>=3;
    }
    static bool IsUnpaintedColor(Color pixel){
        return (pixel.R<=2&&pixel.G<=2&&pixel.B<=2)||
            (Math.Abs(pixel.R-17)<=2&&Math.Abs(pixel.G-16)<=2&&Math.Abs(pixel.B-19)<=2)||
            (Math.Abs(pixel.R-24)<=2&&Math.Abs(pixel.G-24)<=2&&Math.Abs(pixel.B-24)<=2);
    }
    static bool HasBlankBand(Bitmap image,bool vertical,bool trailing){
        int depth=vertical?image.Width:image.Height,length=vertical?image.Height:image.Width;
        int near=trailing?depth-7:6,inside=trailing?depth-15:14;
        int blank=0;
        for(int step=2;step<=8;step++){
            int along=length*step/10;
            Color outer=vertical?image.GetPixel(near,along):image.GetPixel(along,near);
            Color inner=vertical?image.GetPixel(inside,along):image.GetPixel(along,inside);
            if(IsUnpaintedColor(outer)&&outer.ToArgb()==inner.ToArgb())blank++;
        }
        // A few dark wallpaper details or a rounded corner are not a blank band.
        return blank>=6;
    }
    internal static bool HasUnpaintedEdge(Bitmap image){
        if(image.Width<100||image.Height<100)return false;
        return HasBlankBand(image,true,false)||HasBlankBand(image,true,true)||
            HasBlankBand(image,false,false)||HasBlankBand(image,false,true);
    }
    bool RejectUnpaintedEdge(Bitmap image){
        if(!HasUnpaintedEdge(image))return false;
        Interlocked.Increment(ref rejectedBands);
        return true;
    }
    void RequestWindowCapture(Rectangle bounds){
        if(bounds.Width<100||bounds.Height<100||(long)bounds.Width*bounds.Height>16777216)return;
        lock(captureLock){if(capturePending)return;capturePending=true;}
        var window=target;
        var requestAt=DateTime.UtcNow;
        // PrintWindow can wait on the application's rendering thread. Keep it
        // off the mouse hook and queue at most one capture at a time.
        ThreadPool.QueueUserWorkItem(delegate{
            Bitmap image=null;
            try{
                Native.RECT before;
                if(!Native.IsWindow(window)||!GetClientRect(window,out before)||before.Right!=bounds.Width||before.Bottom!=bounds.Height)return;
                image=new Bitmap(bounds.Width,bounds.Height,PixelFormat.Format24bppRgb);
                bool painted;
                using(var graphics=Graphics.FromImage(image)){
                    var dc=graphics.GetHdc();
                    try{painted=PrintWindow(window,dc,3);}
                    finally{graphics.ReleaseHdc(dc);}
                }
                Native.RECT after;
                if(!painted||!GetClientRect(window,out after)||after.Right!=bounds.Width||after.Bottom!=bounds.Height||
                   !HasWindowPixels(image)||RejectUnpaintedEdge(image))return;
                lock(captureLock){
                    if(stopping)return;
                    if(capturedWindow!=null)capturedWindow.Dispose();
                    capturedWindow=image;capturedTarget=window;capturedBounds=bounds;capturedAt=requestAt;image=null;
                }
            }catch(Exception error){Spider.Log("resize-preview-capture",error.Message);}
            finally{if(image!=null)image.Dispose();lock(captureLock)capturePending=false;}
        });
    }
    bool UseWindowCapture(Rectangle bounds,DateTime earliest=default(DateTime)){
        lock(captureLock){
            if(capturedWindow==null||capturedTarget!=target||capturedBounds!=bounds||capturedAt<earliest||(DateTime.UtcNow-capturedAt).TotalMilliseconds>1000)return false;
            if(frame!=null)frame.Dispose();
            frame=capturedWindow;capturedWindow=null;windowFrame=true;windowCaptures++;
            return true;
        }
    }
    void RefreshPaintedResizeFrame(DateTime now){
        if(!Visible||captionTransition||lastPreviewBounds!=lastActualBounds||frame==null)return;
        bool released=!nativeSizing&&releaseAt!=DateTime.MaxValue;
        if(!released&&(!nativeSizing||frame.Size==lastActualBounds.Size))return;
        var earliest=released?releaseStarted.AddMilliseconds(ReleasePaintMs):lastResizeChange.AddMilliseconds(StableResizeMs);
        if(lastResizeChange>earliest)earliest=lastResizeChange;
        if(now<earliest)return;
        if(UseWindowCapture(lastActualBounds,earliest)){
            if(released){
                readyHandoffs++;
                Clear();
            }else{
                liveResizeFrames++;
                lastPreviewBounds=Rectangle.Empty;
                Render(lastActualBounds);
            }
            return;
        }
        // Ask for fresh pixels once a size settles. A stalled renderer keeps
        // the existing preview and its original release deadline.
        if(now>=nextResizeCapture){
            RequestWindowCapture(lastActualBounds);
            nextResizeCapture=now.AddMilliseconds(ResizeCaptureIntervalMs);
        }
    }
    bool Cache(Rectangle bounds){
        if(bounds.Width<100||bounds.Height<100)return false;
        foreach(int x in new[]{24,bounds.Width/2,bounds.Width-24})foreach(int y in new[]{24,bounds.Height/2,bounds.Height-24})
            if(Native.GetAncestor(Native.WindowFromPoint(new Native.POINT(bounds.X+x,bounds.Y+y)),2)!=target)return false;
        // Desktop captures supply RGB. Initialize an opaque source before
        // passing it to the per-pixel-alpha presentation bitmap.
        var fresh=new Bitmap(bounds.Width,bounds.Height,PixelFormat.Format24bppRgb);
        try{using(var g=Graphics.FromImage(fresh))g.CopyFromScreen(bounds.Location,Point.Empty,bounds.Size);}catch{fresh.Dispose();throw;}
        if(RejectUnpaintedEdge(fresh)){fresh.Dispose();return false;}
        if(frame!=null)frame.Dispose();frame=fresh;windowFrame=false;desktopFallbacks++;
        preparedCaptionBounds=Rectangle.Empty;
        return true;
    }
    void Tick(){
        if(stopping){Clear();pulse.Stop();Application.ExitThread();return;}
        UpdateTarget();
        var now=DateTime.UtcNow;
        lock(captureLock){if(capturedWindow!=null&&(capturedTarget!=target||(now-capturedAt).TotalMilliseconds>1000)){capturedWindow.Dispose();capturedWindow=null;}}
        if(!Native.IsWindow(target)||Native.IsIconic(target)){Clear();return;}
        bool foreground=Native.GetForegroundWindow()==target;
        if(!tracking&&!nativeSizing&&(GetAsyncKeyState(1)&0x8000)==0&&now>=nextWindowCapture&&
           IsSizingBorder(WindowBounds(),Cursor.Position,GetDpiForWindow(target))){
            RequestWindowCapture(ClientBounds());nextWindowCapture=now.AddMilliseconds(EdgeCaptureMs);
        }
        if(!foreground){
            // One native edge press can activate and resize a background window.
            // Keep its captured frame through that short activation handoff.
            if((tracking||nativeSizing)&&DateTime.UtcNow<activationDeadline&&(GetAsyncKeyState(1)&0x8000)!=0)return;
            Clear();return;
        }
        activationDeadline=DateTime.MinValue;
        CheckCaptionExpansion();
        if(tracking){
            if(!windowFrame&&ClientBounds()==dragBounds&&UseWindowCapture(dragBounds))lastPreviewBounds=Rectangle.Empty;
            if(!nativeSizing&&(GetAsyncKeyState(1)&0x8000)==0)BeginRelease();
            if(nativeSizing||edge==0||releaseAt!=DateTime.MaxValue)SynchronizeBounds();
            if(tracking)RefreshPaintedResizeFrame(now);
            if(Visible)KeepAboveClient();
            if(DateTime.UtcNow>=releaseAt)Clear();
        }
        else if(nativeSizing)SynchronizeBounds();
        else if((GetAsyncKeyState(1)&0x8000)==0&&(frame==null||DateTime.UtcNow>=nextCapture)){
            var bounds=ClientBounds();
            if(frame==null||frame.Width!=bounds.Width||frame.Height!=bounds.Height||IsSizingBorder(WindowBounds(),Cursor.Position,GetDpiForWindow(target))){
                Cache(bounds);
                if(frame!=null)nextCapture=DateTime.UtcNow.AddMilliseconds(EdgeCaptureMs);
            }
        }
        if(DateTime.UtcNow>=nextLog){nextLog=DateTime.UtcNow.AddSeconds(1);Spider.Write(telemetryFile,new{starts=starts,reconciled=reconciled,nativeFallbackStarts,captionExpansions,hitTests,windowCaptures,desktopFallbacks,rejectedBands,liveResizeFrames,readyHandoffs,windowFrame,locationEvents=locationHook!=IntPtr.Zero,moveSizeEvents=moveSizeHook!=IntPtr.Zero,tracking=tracking,cached=frame!=null,target=target.ToInt64(),topmost=(Native.GetWindowLong(Handle,-20)&8)!=0});}
    }
    IntPtr OnMouse(int code,IntPtr message,IntPtr data){
        try{if(code>=0&&Native.IsWindow(target)){
            int m=message.ToInt32();
            if(m==0x201&&(!tracking||releaseAt!=DateTime.MaxValue)){
                var press=(MouseData)Marshal.PtrToStructure(data,typeof(MouseData));
                var point=new Point(press.point.X,press.point.Y);
                // Ordinary UI clicks must not synchronously wait on the target's UI thread.
                bool foreground=Native.GetForegroundWindow()==target;
                if(foreground||Native.GetAncestor(Native.WindowFromPoint(press.point),2)==target)
                    TryStartSizing(point,!foreground);
                if(foreground)CaptureCaption(point);
            }
            else if(m==0x200&&Native.GetForegroundWindow()==target&&tracking&&edge>=10&&releaseAt==DateTime.MaxValue){
                var p=(MouseData)Marshal.PtrToStructure(data,typeof(MouseData));
                var b=PredictBounds(dragBounds,edge,p.point.X-dragOrigin.X,p.point.Y-dragOrigin.Y);
                if(b.Width>=300&&b.Height>=200)Render(b);
            }else if(m==0x202&&tracking){BeginRelease();}
        }}catch(Exception e){Clear();Spider.Log("resize-preview",e.Message);}
        return CallNextHookEx(hook,code,message,data);
    }
    internal static Rectangle PredictBounds(Rectangle bounds,int edge,int dx,int dy){
        // WM_NCHITTEST values from HTLEFT through HTBOTTOMRIGHT.
        if(edge==10||edge==13||edge==16){bounds.X+=dx;bounds.Width-=dx;}
        if(edge==11||edge==14||edge==17)bounds.Width+=dx;
        if(edge==12||edge==13||edge==14){bounds.Y+=dy;bounds.Height-=dy;}
        if(edge==15||edge==16||edge==17)bounds.Height+=dy;
        return bounds;
    }
    void Render(Rectangle bounds){
        if(Visible&&bounds==lastPreviewBounds)return;
        if(!captionTransition||bounds!=preparedCaptionBounds)PaintLayer(bounds.Size,!IsZoomed(target));
        preparedCaptionBounds=Rectangle.Empty;
        var location=new Native.POINT(bounds.X,bounds.Y);var size=new Native.POINT(bounds.Width,bounds.Height);
        var origin=new Native.POINT();var blend=new Blend{alpha=255,format=1};
        // Publish pixels and extent together. A Form bounds change followed by
        // WM_PAINT can expose an empty surface to DWM during a native drag.
        if(!UpdateLayeredWindow(Handle,screenDc,ref location,ref size,memoryDc,ref origin,0,ref blend,2))
            throw new System.ComponentModel.Win32Exception();
        lastPreviewBounds=bounds;
        if(!Visible){Show(new OwnerWindow(target));Native.SetProp(Handle,"SpiderCodex.ResizePreview.v1",target);}
        KeepAboveClient();
    }
    void PaintLayer(Size size,bool rounded){
        EnsureLayer(size);
        var surface=new Rectangle(Point.Empty,size);
        painter.ResetClip();
        painter.CompositingMode=CompositingMode.SourceCopy;
        using(var transparent=new SolidBrush(Color.Transparent))painter.FillRectangle(transparent,surface);
        if(rounded){
            int d=Math.Max(2,(int)Math.Round(16*GetDpiForWindow(target)/96.0));
            using(var corners=new GraphicsPath()){
                corners.AddArc(0,0,d,d,180,90);corners.AddArc(size.Width-d,0,d,d,270,90);
                corners.AddArc(size.Width-d,size.Height-d,d,d,0,90);corners.AddArc(0,size.Height-d,d,d,90,90);
                corners.CloseFigure();painter.SetClip(corners);
            }
        }
        DrawFrame(painter,frame,surface,edgeSampling);
        painter.Flush(FlushIntention.Sync);
    }
    void KeepAboveClient(){
        // The system modal sizing loop can put the native client above its
        // preview again even though the preview is visible and correctly sized.
        if(Native.GetForegroundWindow()!=target)return;
        for(var preceding=GetWindow(Handle,3);preceding!=IntPtr.Zero;preceding=GetWindow(preceding,3)){
            if(preceding!=target)continue;
            Native.SetWindowPos(Handle,IntPtr.Zero,0,0,0,0,0x0010|0x0002|0x0001|0x0200);
            break;
        }
    }
    void EnsureLayer(Size size){
        if(layer!=null&&layer.Width>=size.Width&&layer.Height>=size.Height)return;
        var width=(size.Width+127)&~127;var height=(size.Height+127)&~127;
        DisposeLayer();
        screenDc=GetDC(IntPtr.Zero);
        memoryDc=CreateCompatibleDC(screenDc);
        var header=new DibHeader{size=40,width=width,height=-height,planes=1,bits=32};
        IntPtr pixels;
        dib=CreateDIBSection(memoryDc,ref header,0,out pixels,IntPtr.Zero,0);
        if(dib==IntPtr.Zero)throw new System.ComponentModel.Win32Exception();
        previousBitmap=SelectObject(memoryDc,dib);
        if(previousBitmap==IntPtr.Zero||previousBitmap==new IntPtr(-1))throw new System.ComponentModel.Win32Exception();
        layer=new Bitmap(width,height,width*4,PixelFormat.Format32bppPArgb,pixels);
        painter=Graphics.FromImage(layer);
    }
    void DisposeLayer(){
        if(painter!=null)painter.Dispose();
        if(layer!=null)layer.Dispose();
        if(previousBitmap!=IntPtr.Zero&&previousBitmap!=new IntPtr(-1))SelectObject(memoryDc,previousBitmap);
        if(dib!=IntPtr.Zero)DeleteObject(dib);
        if(memoryDc!=IntPtr.Zero)DeleteDC(memoryDc);
        if(screenDc!=IntPtr.Zero)ReleaseDC(IntPtr.Zero,screenDc);
        painter=null;layer=null;screenDc=memoryDc=dib=previousBitmap=IntPtr.Zero;
    }
    internal static ImageAttributes CreateEdgeSampling(){
        var sampling=new ImageAttributes();
        // Bilinear sampling can reach beyond the outer source pixel. Mirror
        // that pixel at the boundary instead of blending with transparency.
        sampling.SetWrapMode(WrapMode.TileFlipXY);
        return sampling;
    }
    internal static void DrawFrame(Graphics graphics,Bitmap image,Rectangle bounds,ImageAttributes sampling){
        graphics.CompositingMode=CompositingMode.SourceCopy;
        graphics.CompositingQuality=CompositingQuality.HighSpeed;
        graphics.InterpolationMode=InterpolationMode.Bilinear;
        graphics.DrawImage(image,bounds,0,0,image.Width,image.Height,GraphicsUnit.Pixel,sampling);
    }
}
