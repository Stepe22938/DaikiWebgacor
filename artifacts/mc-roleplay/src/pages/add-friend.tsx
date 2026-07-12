import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  useFollowUser,
  useUnfollowUser,
  useGetMe,
} from "@workspace/api-client-react";
import {
  UserPlus,
  UserMinus,
  MessageSquare,
  ArrowLeft,
  QrCode,
  Users,
  Copy,
  Check,
  Camera,
  X
} from "lucide-react";

type PublicUser = {
  id: number;
  username: string;
  userTag: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  equippedBorder?: string | null;
  equippedBadge?: string | null;
  equippedBackground?: string | null;
};

export default function AddFriendPage() {
  const [, params] = useRoute("/add-friend/:target");
  const targetParam = params?.target;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: me } = useGetMe();
  
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();

  const [targetUser, setTargetUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMyQr, setShowMyQr] = useState(false);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!showScanDialog) {
      setIsScanning(false);
      setScanError(null);
    }
  }, [showScanDialog]);

  useEffect(() => {
    let animationFrameId: number;

    const scanLoop = () => {
      if (!videoRef.current || !isScanning) return;
      
      const video = videoRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current || document.createElement("canvas");
        const context = canvas.getContext("2d");
        
        if (context) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const jsQR = (window as any).jsQR;
          
          if (jsQR) {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            
            if (code) {
              const text = code.data;
              let targetUser = text;
              if (text.includes("/add-friend/")) {
                const parts = text.split("/add-friend/");
                targetUser = parts[parts.length - 1];
              }
              
              if (targetUser) {
                toast({ title: "Player scanned!", description: `Resolving profile for ${targetUser}...` });
                setIsScanning(false);
                setShowScanDialog(false);
                setLocation(`/add-friend/${encodeURIComponent(targetUser)}`);
                return;
              }
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(scanLoop);
    };

    if (isScanning) {
      const scriptId = "jsqr-cdn-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
        document.body.appendChild(script);
      }

      // Wait for React to render the <video> element into the DOM
      const startCamera = () => {
        if (!videoRef.current) return;
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
          .then((stream) => {
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.setAttribute("playsinline", "true");
              videoRef.current.play();
              animationFrameId = requestAnimationFrame(scanLoop);
            }
          })
          .catch((err) => {
            console.error("Camera access failed:", err);
            setScanError("Camera access denied or not available.");
            setIsScanning(false);
          });
      };

      requestAnimationFrame(() => requestAnimationFrame(startCamera));
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isScanning]);

  useEffect(() => {
    if (!targetParam) return;
    setLoading(true);
    setError(null);
    
    fetch(`/api/users/resolve/${encodeURIComponent(targetParam)}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to resolve user" }));
          throw new Error(err.error || "User not found");
        }
        return res.json();
      })
      .then((data) => {
        setTargetUser(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [targetParam]);

  const handleFollowToggle = async () => {
    if (!targetUser) return;
    try {
      if (targetUser.isFollowing) {
        await unfollowUser.mutateAsync({ userId: targetUser.id });
        setTargetUser({
          ...targetUser,
          isFollowing: false,
          followerCount: Math.max(0, targetUser.followerCount - 1)
        });
        toast({ title: "Unfollowed", description: `You unfollowed ${targetUser.displayName || targetUser.username}.` });
      } else {
        await followUser.mutateAsync({ data: { userId: targetUser.id } });
        setTargetUser({
          ...targetUser,
          isFollowing: true,
          followerCount: targetUser.followerCount + 1
        });
        toast({ title: "Following", description: `You are now following ${targetUser.displayName || targetUser.username}.` });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update follow status.", variant: "destructive" });
    }
  };

  const handleStartChat = async () => {
    if (!targetUser) return;
    try {
      const res = await fetch("/api/conversations/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetUser.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create DM" }));
        throw new Error(err.error || "Failed to start chat");
      }
      const conv = await res.json();
      setLocation(`/member?tab=messages&id=${conv.id}`);
    } catch (err: any) {
      toast({ title: "Cannot start chat", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f3f8] flex items-center justify-center font-sans">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-slate-500">Resolving player profile...</p>
        </div>
      </div>
    );
  }

  if (error || !targetUser) {
    return (
      <div className="min-h-screen bg-[#f4f3f8] flex items-center justify-center p-6 font-sans">
        <Card className="max-w-md w-full bg-white border-[#eae8f5] shadow-xl rounded-2xl p-6 text-center">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-[#110e3d] mb-1">Player Not Found</h2>
          <p className="text-xs font-bold text-slate-400 mb-6">{error || "This user is not registered on our server."}</p>
          <Button
            onClick={() => setLocation("/friends")}
            className="w-full bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl font-bold text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Back to Guild Portal
          </Button>
        </Card>
      </div>
    );
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const selfDisplayName = targetUser.displayName || targetUser.username;

  return (
    <div className="min-h-screen bg-[#f4f3f8] flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full space-y-6">
        {/* Back navigation */}
        <button
          onClick={() => setLocation("/friends")}
          className="flex items-center gap-1.5 text-xs font-black text-slate-400 hover:text-[#110e3d] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Guilds
        </button>

        {/* User Card */}
        <Card className="bg-white border-[#eae8f5] shadow-xl rounded-3xl overflow-hidden">
          {/* Header background banner based on background cosmetic */}
          <div className={`h-24 bg-gradient-to-r from-violet-500 to-indigo-500 ${targetUser.equippedBackground || ""}`} />
          
          <CardContent className="p-6 relative pt-0">
            {/* Avatar */}
            <div className="absolute -top-12 left-6">
              <div className={`w-20 h-20 rounded-full bg-white flex items-center justify-center overflow-visible p-0.5 ${targetUser.equippedBorder || "border border-violet-100"}`}>
                <Avatar className="h-full w-full">
                  <AvatarImage src={targetUser.avatarUrl || undefined} />
                  <AvatarFallback className="text-xl bg-slate-50 font-black text-[#6366f1]">
                    {getInitials(selfDisplayName)}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            <div className="pt-10 space-y-4">
              {/* Profile Details */}
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-lg font-black text-[#110e3d] leading-none">{selfDisplayName}</h2>
                  {targetUser.equippedBadge && (
                    <span className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase border tracking-wider shrink-0 ${targetUser.equippedBadge}`}>
                      Badge
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  @{targetUser.username} <span className="text-[#6366f1] font-semibold">{targetUser.userTag}</span>
                </p>
              </div>

              {/* Bio */}
              {targetUser.bio && (
                <p className="text-xs text-slate-500 font-semibold leading-relaxed border-t border-slate-50 pt-3">
                  {targetUser.bio}
                </p>
              )}

              {/* Stats */}
              <div className="flex gap-4 text-xs font-bold text-slate-400 border-t border-slate-50 pt-3">
                <div>
                  <span className="text-[#110e3d] font-black mr-1">{targetUser.followerCount}</span>
                  followers
                </div>
                <div>
                  <span className="text-[#110e3d] font-black mr-1">{targetUser.followingCount}</span>
                  following
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={handleFollowToggle}
                  variant={targetUser.isFollowing ? "outline" : "default"}
                  className={`flex-1 rounded-xl font-black text-xs h-10 ${
                    targetUser.isFollowing
                      ? "border-[#eae8f5] text-slate-500 hover:bg-red-50 hover:text-[#ef4444] hover:border-red-200"
                      : "bg-[#6366f1] text-white hover:bg-violet-700 shadow-md shadow-violet-500/10"
                  }`}
                >
                  {targetUser.isFollowing ? (
                    <>
                      <UserMinus className="w-3.5 h-3.5 mr-2" /> Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5 mr-2" /> Follow Player
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleStartChat}
                  className="flex-1 bg-[#110e3d] hover:bg-slate-900 text-white rounded-xl font-black text-xs h-10 shadow-md"
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-2" /> Direct Message
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scan Barcode / QR Code info box */}
        <Card className="bg-white border-[#eae8f5] shadow-md rounded-2xl p-4 text-center space-y-3">
          <div className="flex items-center justify-center gap-1.5 text-xs font-black text-[#110e3d]">
            <QrCode className="w-4 h-4 text-[#6366f1]" />
            <span>Show QR to Exchange Profiles</span>
          </div>
          <p className="text-[11px] font-bold text-slate-400">
            Let this player scan your QR code or click the button below to display your QR Code.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMyQr(true)}
              className="w-full rounded-xl border-[#eae8f5] text-slate-500 hover:text-[#6366f1] text-xs font-bold"
            >
              Show My Add Friend QR Code
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowScanDialog(true);
                setIsScanning(true);
              }}
              className="w-full rounded-xl bg-[#6366f1] text-white hover:bg-violet-700 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" /> Scan Player's QR Code
            </Button>
          </div>
        </Card>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showMyQr} onOpenChange={setShowMyQr}>
        <DialogContent className="max-w-xs bg-white border border-[#eae8f5] rounded-3xl p-5 text-center flex flex-col items-center">
          <DialogHeader className="w-full">
            <DialogTitle className="text-sm font-extrabold text-[#110e3d]">
              📱 My Add Friend QR Code
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-bold">
              Let other players scan this code to follow you!
            </DialogDescription>
          </DialogHeader>

          {me && (
            <div className="mt-4 p-4 bg-white rounded-3xl border border-violet-100 shadow-xl flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=6366f1&data=${encodeURIComponent(
                  `${window.location.origin}/add-friend/${me.username}`
                )}`}
                alt="My QR Code"
                className="w-44 h-44"
              />
            </div>
          )}

          <div className="mt-4 w-full flex gap-2">
            <Button
              onClick={() => {
                if (me) {
                  navigator.clipboard.writeText(`${window.location.origin}/add-friend/${me.username}`);
                  setCopied(true);
                  toast({ title: "Copied!", description: "Add friend link copied." });
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="flex-1 bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl text-xs font-bold h-9"
            >
              {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowMyQr(false)}
              className="flex-1 rounded-xl border-[#eae8f5] text-slate-500 hover:text-slate-700 text-xs font-bold h-9"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera Scan Dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="max-w-xs bg-white border border-[#eae8f5] rounded-3xl p-5 text-center flex flex-col items-center">
          <DialogHeader className="w-full">
            <DialogTitle className="text-sm font-extrabold text-[#110e3d] flex items-center justify-center gap-1.5">
              <Camera className="w-4.5 h-4.5 text-[#6366f1]" /> Scan Player's QR Code
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-bold">
              Point your camera at another player's profile QR code.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 w-full">
            {isScanning ? (
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden border-2 border-[#6366f1] bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-4 border-2 border-dashed border-emerald-400 rounded-xl animate-pulse pointer-events-none" />
              </div>
            ) : (
              <div className="py-8 space-y-4">
                <Button
                  onClick={() => {
                    setScanError(null);
                    setIsScanning(true);
                  }}
                  className="w-full bg-[#6366f1] text-white hover:bg-violet-700 rounded-xl text-xs font-bold h-10"
                >
                  <Camera className="w-4 h-4 mr-2" /> Start Camera Scan
                </Button>
                {scanError && (
                  <p className="text-[10px] text-red-500 font-bold">{scanError}</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 w-full">
            <Button
              variant="outline"
              onClick={() => {
                setIsScanning(false);
                setShowScanDialog(false);
              }}
              className="w-full rounded-xl border-[#eae8f5] text-slate-500 hover:text-slate-700 text-xs font-bold h-9"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
