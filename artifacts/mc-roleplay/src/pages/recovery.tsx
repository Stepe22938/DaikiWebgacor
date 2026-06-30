import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useRequestRecovery, useVerifyRecovery } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, ArrowLeft, CheckCircle2, KeyRound, Mail } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const AUTH_PARTICLES = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 9,
  duration: 6 + Math.random() * 7,
  size: 1.5 + Math.random() * 4,
  opacity: 0.15 + Math.random() * 0.65,
}));

const RECOVERY_STYLES = `
  @keyframes auth-float-up {
    0%   { transform: translateY(100vh) scale(0.4); opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 0.7; }
    100% { transform: translateY(-12vh) scale(1.3); opacity: 0; }
  }
  @keyframes auth-card-in {
    from { transform: translateY(26px) scale(0.97); opacity: 0; filter: blur(10px); }
    to   { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
  }
  .auth-particle { animation: auth-float-up linear infinite; }
  .auth-login-card { animation: auth-card-in 0.82s cubic-bezier(0.22,1,0.36,1) both; }
`;

export default function RecoveryPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const { toast } = useToast();

  const requestRecovery = useRequestRecovery();
  const verifyRecovery = useVerifyRecovery();

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      const res = await requestRecovery.mutateAsync({
        data: { email: email.trim() }
      });
      
      toast({
        title: "OTP Dikirim",
        description: res.message || "Kode OTP pemulihan telah dikirim.",
      });

      if (res.code) {
        setDevOtp(res.code);
      }
      setStep(2);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Gagal meminta kode pemulihan.";
      toast({
        title: "Gagal",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !email.trim()) return;

    try {
      const res = await verifyRecovery.mutateAsync({
        data: {
          email: email.trim(),
          code: code.trim()
        }
      });

      toast({
        title: "Verifikasi Berhasil",
        description: "Menghubungkan sesi Anda. Mohon tunggu...",
      });

      // Redirect to Clerk login token URL
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Kode OTP salah atau telah kedaluwarsa.";
      toast({
        title: "Gagal Verifikasi",
        description: msg,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#05030a] text-white p-4">
      <style dangerouslySetInnerHTML={{ __html: RECOVERY_STYLES }} />

      {/* Background Slideshow Overlay */}
      <div className="absolute inset-0 z-0 bg-black opacity-40" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#05030a] via-[#05030a]/40 to-[#05030a]/80" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.15),transparent_50%)]" />

      {/* Floating Particles */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {AUTH_PARTICLES.map((p) => (
          <div
            key={p.id}
            className="auth-particle absolute rounded-full"
            style={{
              left: `${p.x}%`,
              bottom: 0,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: p.id % 2 === 0 ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.15)",
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              boxShadow: p.id % 2 === 0 ? `0 0 ${p.size * 2}px rgba(168,85,247,0.7)` : "none",
            }}
          />
        ))}
      </div>

      {/* Glassmorphic Recovery Card */}
      <div className="auth-login-card relative z-30 w-full max-w-[420px] overflow-hidden rounded-[32px] border border-white/10 bg-[#0d0a1b]/30 p-4 shadow-2xl backdrop-blur-2xl">
        <div className="relative rounded-[24px] border border-white/10 bg-[#07050d]/85 px-6 py-8 shadow-lg backdrop-blur-3xl">
          
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 shadow-lg mb-3 text-violet-400">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white uppercase">
              {step === 1 ? "Pemulihan Akun" : "Masukkan OTP"}
            </h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">
              {step === 1 
                ? "Masukkan email pemulihan untuk masuk ke akun Anda" 
                : "Masukkan 6 digit kode OTP yang dikirim ke email pemulihan Anda"}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Email Pemulihan
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="email-pemulihan@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white focus:border-violet-500 focus:bg-white/10 placeholder:text-slate-500 rounded-xl text-xs h-11 pl-11 transition-all w-full"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={requestRecovery.isPending}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl h-11 shadow-lg shadow-violet-950/30 transition-all duration-200 uppercase tracking-widest w-full"
              >
                {requestRecovery.isPending ? "Mengirim..." : "Kirim Kode OTP"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Kode OTP
                </Label>
                <Input
                  id="otp"
                  type="text"
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="bg-white/5 border border-white/10 text-white text-center tracking-[0.75em] font-black focus:border-violet-500 focus:bg-white/10 placeholder:text-slate-500 placeholder:tracking-normal rounded-xl text-sm h-11 transition-all w-full"
                />
              </div>

              {devOtp && (
                <div className="bg-violet-950/20 border border-violet-800/30 p-3 rounded-xl text-center">
                  <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">
                    (Dev Mode) OTP Code:
                  </p>
                  <p className="text-sm font-black text-white mt-0.5 tracking-widest">
                    {devOtp}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={verifyRecovery.isPending}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl h-11 shadow-lg shadow-violet-950/30 transition-all duration-200 uppercase tracking-widest w-full"
              >
                {verifyRecovery.isPending ? "Memverifikasi..." : "Verifikasi & Masuk"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[10px] text-zinc-500 hover:text-white font-bold uppercase tracking-wider transition-colors"
                >
                  Kembali ke Input Email
                </button>
              </div>
            </form>
          )}

          {/* Back to Sign In */}
          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Sign In
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
