import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { MultisessionAppSupport } from "@clerk/react/internal";
import { useSignUp } from "@clerk/react/legacy";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

import Home from "@/pages/home";
import Member from "@/pages/member";
import Admin from "@/pages/admin";
import Friends from "@/pages/friends";
import Profile from "@/pages/profile";
import Messages from "@/pages/messages";
import Premium from "@/pages/premium";
import NotFound from "@/pages/not-found";
import AddFriendPage from "@/pages/add-friend";


const isLocal = window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1" ||
                window.location.hostname.startsWith("192.168.");

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  ? (isLocal ? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY : publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY))
  : undefined;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type RealmSettings = {
  realmName?: string | null;
  realmLogoUrl?: string | null;
};

const FALLBACK_REALM_NAME = "Arcadia Studio";

function getRealmDisplayName(settings?: RealmSettings | null) {
  return settings?.realmName?.trim() || FALLBACK_REALM_NAME;
}

function useRealmSettings() {
  const [settings, setSettings] = useState<RealmSettings | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${basePath}/api/settings`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Settings request failed: ${response.status}`);
        }
        return response.json() as Promise<RealmSettings>;
      })
      .then((data) => {
        if (!cancelled) {
          setSettings(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSettings({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ClerkConfigWarning({ hasNoKey }: { hasNoKey: boolean }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      backgroundColor: "#16120e",
      color: "#ecd79d",
      fontFamily: "Inter, sans-serif",
      padding: "20px",
      textAlign: "center"
    }}>
      <div style={{
        maxWidth: "500px",
        padding: "30px",
        borderRadius: "12px",
        border: "1px solid #3b3223",
        backgroundColor: "#1a1512"
      }}>
        <h2 style={{ color: "#d9a05b", marginBottom: "15px" }}>Konfigurasi Clerk Diperlukan</h2>
        <p style={{ color: "#b3a486", lineHeight: "1.6", marginBottom: "20px" }}>
          {hasNoKey ? (
            <>Anda belum memasukkan API Key untuk Clerk Auth di file <code>.env</code> Anda.</>
          ) : (
            <>Anda sedang menjalankan website ini di lokal (localhost), tetapi masih menggunakan key Clerk bawaan Replit (<code>clerk.localhost</code>).</>
          )}
        </p>
        <p style={{ color: "#b3a486", lineHeight: "1.6", marginBottom: "20px" }}>
          Silakan buka file <code>.env</code> di root project Anda, isi <strong>CLERK_PUBLISHABLE_KEY</strong>, <strong>CLERK_SECRET_KEY</strong>, dan <strong>VITE_CLERK_PUBLISHABLE_KEY</strong> dengan key dari dashboard <a href="https://clerk.com" target="_blank" style={{ color: "#d9a05b", textDecoration: "underline" }}>clerk.com</a> milik Anda sendiri.
        </p>
        <div style={{
          fontSize: "12px",
          color: "#807055",
          borderTop: "1px solid #3b3223",
          paddingTop: "15px"
        }}>
          Setelah mengisi file <code>.env</code>, silakan restart server dev Anda (jalankan ulang <code>pnpm run dev</code>).
        </div>
      </div>
    </div>
  );
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "none" as const,
    logoLinkUrl: basePath || "/",
  },
  variables: {
    colorPrimary: "hsl(263 90% 70%)", // vibrant violet
    colorForeground: "hsl(210 40% 98%)", // near white
    colorMutedForeground: "hsl(215 20% 65%)", // muted grayish blue
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "rgba(15, 12, 28, 0.65)", // dark glass
    colorInput: "rgba(25, 20, 45, 0.8)", // dark input background
    colorInputForeground: "hsl(210 40% 98%)",
    colorNeutral: "rgba(255, 255, 255, 0.1)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "1rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full bg-transparent shadow-none border-0",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border border-white/5 !bg-[#0f0c1c]/40 !rounded-2xl mt-3 backdrop-blur-xl max-lg:!hidden",
    headerTitle: "!text-white font-black max-lg:!hidden",
    headerSubtitle: "!text-slate-400 max-lg:!hidden",
    socialButtonsBlockButtonText: "!text-white !font-semibold !opacity-100",
    formFieldLabel: "!text-slate-300 font-semibold",
    footerActionLink: "!text-[#a78bfa] hover:!text-[#c084fc]",
    footerActionText: "!text-slate-400",
    dividerText: "!text-slate-400",
    identityPreviewEditButton: "!text-[#a78bfa]",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-red-400",
    logoBox: "hidden",
    logoImage: "hidden",
    socialButtonsBlockButton: "!w-full !border !border-white/10 !bg-white/5 hover:!bg-white/10 !text-white !shadow-lg !backdrop-blur-2xl transition-all duration-200",
    formButtonPrimary: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black shadow-lg shadow-violet-500/20 border-0",
    formFieldInput: "!bg-white/5 !border !border-white/10 !text-white focus:!border-violet-500/50 focus:!bg-white/10 placeholder:!text-slate-500 !backdrop-blur-xl transition-all duration-200",
    footerAction: "",
    dividerLine: "!bg-white/10",
    alert: "bg-red-950/30 border border-red-500/20",
    otpCodeFieldInput: "!bg-white/5 !border !border-white/10 !text-white",
    formFieldRow: "",
    main: "",
  },
};


// ---- CINEMATIC AUTH PAGE ----
const AUTH_PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 9,
  duration: 6 + Math.random() * 7,
  size: 1.5 + Math.random() * 4,
  opacity: 0.15 + Math.random() * 0.65,
}));

const AUTH_STYLES = `
  @keyframes auth-float-up {
    0%   { transform: translateY(100vh) scale(0.4); opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 0.7; }
    100% { transform: translateY(-12vh) scale(1.3); opacity: 0; }
  }
  @keyframes auth-sparkle {
    0%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); }
    50%       { opacity: 1; transform: scale(1.3) rotate(180deg); }
  }
  @keyframes auth-mobile-header {
    from { transform: translateY(-30px); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
  }
  @keyframes auth-card-in {
    from { transform: translateY(26px) scale(0.97); opacity: 0; filter: blur(10px); }
    to   { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
  }
  @keyframes auth-card-aura {
    0%, 100% { opacity: 0.42; transform: translate3d(-50%, -50%, 0) scale(0.96); }
    50%      { opacity: 0.72; transform: translate3d(-50%, -50%, 0) scale(1.04); }
  }
  @keyframes auth-logo-float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50%      { transform: translateY(-5px) rotate(1.5deg); }
  }
  .auth-particle     { animation: auth-float-up linear infinite; }
  .auth-sparkle      { animation: auth-sparkle ease-in-out infinite; }
  .auth-login-card  { animation: auth-card-in 0.82s cubic-bezier(0.22,1,0.36,1) both; }
  .auth-card-aura   { animation: auth-card-aura 5.6s ease-in-out infinite; }
  .auth-login-logo  { animation: auth-logo-float 4.6s ease-in-out infinite; }

  /* Double Slider Animations */
  .auth-container {
    position: relative;
    width: 850px;
    max-width: 100%;
    min-height: 660px;
    background: #09090b;
    border: 1px solid rgba(63, 63, 70, 0.4);
    border-radius: 32px;
    box-shadow: 0 50px 100px rgba(0, 0, 0, 0.8);
    overflow: hidden;
  }
  
  .form-container {
    position: absolute;
    top: 0;
    height: 100%;
    transition: all 0.7s cubic-bezier(0.25, 1, 0.5, 1);
    overflow-y: auto;
  }
  
  .sign-in-container {
    left: 0;
    width: 50%;
    z-index: 2;
    pointer-events: auto;
  }
  
  .auth-container.right-panel-active .sign-in-container {
    transform: translateX(100%);
    opacity: 0;
    z-index: 1;
    pointer-events: none;
  }
  
  .sign-up-container {
    left: 0;
    width: 50%;
    opacity: 0;
    z-index: 1;
    pointer-events: none;
  }
  
  .auth-container.right-panel-active .sign-up-container {
    transform: translateX(100%);
    opacity: 1;
    z-index: 5;
    pointer-events: auto;
    animation: show 0.7s;
  }
  
  @keyframes show {
    0%, 49.99% {
      opacity: 0;
      z-index: 1;
    }
    50%, 100% {
      opacity: 1;
      z-index: 5;
    }
  }
  
  .overlay-container {
    position: absolute;
    top: 0;
    left: 50%;
    width: 50%;
    height: 100%;
    overflow: hidden;
    transition: transform 0.7s cubic-bezier(0.25, 1, 0.5, 1);
    z-index: 100;
    border-radius: 0 32px 32px 0;
  }
  
  .auth-container.right-panel-active .overlay-container {
    transform: translateX(-100%);
    border-radius: 32px 0 0 32px;
  }
  
  .overlay {
    background: linear-gradient(135deg, #7c3aed, #4f46e5, #2563eb);
    background-repeat: no-repeat;
    background-size: cover;
    background-position: 0 0;
    color: #ffffff;
    position: relative;
    left: -100%;
    height: 100%;
    width: 200%;
    transform: translateX(0);
    transition: transform 0.7s cubic-bezier(0.25, 1, 0.5, 1);
  }
  
  .auth-container.right-panel-active .overlay {
    transform: translateX(50%);
  }
  
  .overlay-panel {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 0 40px;
    text-align: center;
    top: 0;
    height: 100%;
    width: 50%;
    transform: translateX(0);
    transition: transform 0.7s cubic-bezier(0.25, 1, 0.5, 1);
  }
  
  .overlay-left {
    transform: translateX(-20%);
  }
  
  .auth-container.right-panel-active .overlay-left {
    transform: translateX(0);
  }
  
  .overlay-right {
    right: 0;
    transform: translateX(0);
  }
  
  .auth-container.right-panel-active .overlay-right {
    transform: translateX(20%);
  }
  .cl-socialButtonsBlock,
  .cl-socialButtonsBlock > div,
  .cl-socialButtonsBlock > div > div,
  .cl-socialButtonsBlock > div > div > div {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 12px !important;
    width: 100% !important;
  }
  .cl-socialButtonsBlockButton {
    width: 100% !important;
    min-height: 46px !important;
    justify-content: center !important;
    gap: 12px !important;
    color: #ffffff !important;
    background: rgba(255,255,255,0.05) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 38px rgba(0,0,0,0.3) !important;
    backdrop-filter: blur(22px) saturate(150%) !important;
    -webkit-backdrop-filter: blur(22px) saturate(150%) !important;
  }
  .cl-socialButtonsBlockButtonText {
    display: none !important;
  }
  .cl-socialButtonsBlockButton::after {
    display: inline-flex !important;
    color: #f1f5f9 !important;
    font-weight: 800 !important;
    opacity: 1 !important;
    visibility: visible !important;
    line-height: 1 !important;
    pointer-events: none !important;
  }
  .cl-socialButtonsBlockButton__google::after {
    content: "Continue with Google" !important;
  }
  .cl-socialButtonsBlockButton__discord::after {
    content: "Continue with Discord" !important;
  }
  .cl-socialButtonsBlockButton__facebook::after {
    content: "Continue with Facebook" !important;
  }
  @media (max-width: 1023px) {
    .cl-rootBox,
    .cl-cardBox,
    .cl-card,
    .cl-main {
      min-width: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
    }
    .cl-socialButtonsBlockButton {
      min-height: 40px !important;
      border-radius: 12px !important;
    }
    .cl-socialButtonsBlockButton::after {
      color: #f1f5f9 !important;
      font-size: 11.5px !important;
      font-weight: 800 !important;
      white-space: nowrap !important;
    }
  }
  /* Mobile styles */
  .auth-mobile-sheet { animation: auth-slide-up 0.65s cubic-bezier(0.22,1,0.36,1) 0.15s both; }
  .auth-mobile-hdr   { animation: auth-mobile-header 0.8s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
`;

const slideshowImages = [
  { src: `${basePath}/lobby.png`, title: "The Arcadia Spawn", desc: "Where all legends begin their journey." },
  { src: `${basePath}/village.png`, title: "Whispering Woods", desc: "A bustling player-run trading hub." },
  { src: `${basePath}/dungeon.png`, title: "Underworld Crypts", desc: "Defeat bosses and claim mythic loot." }
];

const serverFeatures = [
  { title: "Kingdoms & Lore", desc: "Forge alliances, claim lands, and build empires." },
  { title: "Dynamic Economy", desc: "Trade custom goods and run player shops." },
  { title: "RPG Class Skills", desc: "Level up abilities and unlock magic traits." },
  { title: "Voice & Video Calls", desc: "Chat with your guild directly in the browser." }
];

function AuthPageLayout({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [, setLocation] = useLocation();
  const realmSettings = useRealmSettings();
  const realmName = getRealmDisplayName(realmSettings);
  const realmLogoUrl = realmSettings?.realmLogoUrl?.trim();
  const logoSrc = realmLogoUrl || `${basePath}/logo.svg`;
  const authAction = mode === "sign-in" ? "Enter" : "Join";
  const authEyebrow = mode === "sign-in" ? "Welcome Back" : "New Legend";

  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentFeature, setCurrentFeature] = useState(0);
  const { data: stats } = useGetStats();

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
    }, 6000);
    const featureTimer = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % serverFeatures.length);
    }, 4000);
    return () => {
      clearInterval(slideTimer);
      clearInterval(featureTimer);
    };
  }, []);

  const isSignUp = mode === "sign-up";

  // Shared: particles + sparkles + ambient
  const particlesLayer = (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {AUTH_PARTICLES.map((p) => (
        <div
          key={p.id}
          className="auth-particle absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: 0,
            width:  `${p.size}px`,
            height: `${p.size}px`,
            background: p.id % 3 === 0
              ? `rgba(249,115,22,${p.opacity})` // Orange spark
              : p.id % 3 === 1
              ? `rgba(168,85,247,${p.opacity})` // Purple spark
              : `rgba(255,255,255,${p.opacity * 0.45})`,
            animationDuration: `${p.duration}s`,
            animationDelay:    `${p.delay}s`,
            boxShadow: p.id % 3 === 0
              ? `0 0 ${p.size * 2.5}px rgba(249,115,22,0.9)`
              : `0 0 ${p.size * 2}px rgba(168,85,247,0.7)`,
          }}
        />
      ))}

      {[...Array(15)].map((_, i) => (
        <div
          key={`star-${i}`}
          className="auth-sparkle absolute text-violet-300 select-none opacity-40"
          style={{
            left:              `${4 + (i * 7.3) % 92}%`,
            top:               `${6 + (i * 13.1) % 85}%`,
            fontSize:          `${6 + (i % 3) * 4}px`,
            animationDuration: `${1.8 + (i * 0.4) % 2.5}s`,
            animationDelay:    `${(i * 0.45) % 2.5}s`,
          }}
        >
          {i % 2 === 0 ? "*" : "+"}
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#05030a] text-white p-4">
      <style dangerouslySetInnerHTML={{ __html: AUTH_STYLES }} />

      {/* Cinematic Background Slideshow (Matches other pages) */}
      <div className="absolute inset-0 z-0 bg-black">
        {slideshowImages.map((slide, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              currentSlide === idx ? "opacity-35 scale-105" : "opacity-0 scale-100"
            } transform`}
            style={{
              backgroundImage: `url(${slide.src})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ))}
      </div>

      {/* Overlays */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#05030a] via-[#05030a]/40 to-[#05030a]/80" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.15),transparent_50%)]" />
      {particlesLayer}

      {/* DESKTOP DOUBLE-SLIDER CARD */}
      <div className={`auth-container relative hidden lg:flex z-30 ${isSignUp ? "right-panel-active" : ""}`}>
        
        {/* Sign In Form Container */}
        <div className="form-container sign-in-container flex flex-col justify-center px-12 py-8">
          <div className="flex flex-col items-center mb-6">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 shadow-lg mb-3">
              <img src={logoSrc} alt={realmName} className="h-6 w-6 object-contain" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white uppercase">Sign In</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Gunakan akun Anda untuk masuk</p>
          </div>
          <div className="w-full min-w-0 [&_.cl-cardBox]:!w-full [&_.cl-main]:!gap-3 [&_.cl-socialButtonsBlock]:!gap-2 [&_.cl-socialButtonsBlockButton]:!min-h-10 [&_.cl-socialButtonsBlockButton]:!text-xs [&_.cl-formFieldInput]:!h-10 [&_.cl-formButtonPrimary]:!h-10 [&_.cl-footer]:!hidden">
            <SignIn
              routing="path"
              path={`${basePath}/sign-in`}
              signUpUrl={`${basePath}/sign-up`}
              oidcPrompt="login select_account consent"
              appearance={{
                elements: {
                  card: "bg-transparent border-0 shadow-none p-0 w-full",
                  header: "hidden",
                  footer: "hidden",
                  formButtonPrimary: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl py-3 px-5 shadow-lg shadow-violet-950/30 transition-all duration-200 uppercase tracking-widest w-full",
                  formFieldInput: "bg-zinc-900/50 border-zinc-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-950/50 text-white rounded-xl text-xs h-10 transition-all duration-200",
                  socialButtonsBlockButton: "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 text-white rounded-xl transition-all",
                }
              }}
            />
          </div>
        </div>

        {/* Sign Up Form Container */}
        <div className="form-container sign-up-container flex flex-col justify-center px-12 py-8">
          <div className="flex flex-col items-center mb-6">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 shadow-lg mb-3">
              <img src={logoSrc} alt={realmName} className="h-6 w-6 object-contain" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white uppercase">Create Account</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Daftar untuk memulai petualangan baru</p>
          </div>
          <div className="w-full min-w-0 [&_.cl-cardBox]:!w-full [&_.cl-main]:!gap-3 [&_.cl-socialButtonsBlock]:!gap-2 [&_.cl-socialButtonsBlockButton]:!min-h-10 [&_.cl-socialButtonsBlockButton]:!text-xs [&_.cl-formFieldInput]:!h-10 [&_.cl-formButtonPrimary]:!h-10 [&_.cl-footer]:!hidden">
            <SignUp
              routing="path"
              path={`${basePath}/sign-up`}
              signInUrl={`${basePath}/sign-in`}
              oidcPrompt="login select_account consent"
              appearance={{
                elements: {
                  card: "bg-transparent border-0 shadow-none p-0 w-full",
                  header: "hidden",
                  footer: "hidden",
                  formButtonPrimary: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl py-3 px-5 shadow-lg shadow-violet-950/30 transition-all duration-200 uppercase tracking-widest w-full",
                  formFieldInput: "bg-zinc-900/50 border-zinc-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-950/50 text-white rounded-xl text-xs h-10 transition-all duration-200",
                  socialButtonsBlockButton: "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 text-white rounded-xl transition-all",
                }
              }}
            />
          </div>
        </div>

        {/* Overlay Container */}
        <div className="overlay-container">
          <div className="overlay">
            
            {/* Overlay Left */}
            <div className="overlay-panel overlay-left flex flex-col items-center justify-center p-12">
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">Sudah Punya Akun?</h2>
              <p className="text-xs text-violet-200 font-semibold mt-3 max-w-[260px] leading-relaxed">
                Masuk menggunakan akun Anda yang sudah ada untuk melanjutkan permainan di {realmName}
              </p>
              <button
                onClick={() => setLocation("/sign-in")}
                className="mt-8 px-10 py-3 rounded-full border border-white/55 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                Sign In
              </button>
            </div>

            {/* Overlay Right */}
            <div className="overlay-panel overlay-right flex flex-col items-center justify-center p-12">
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">Halo, Kawan!</h2>
              <p className="text-xs text-violet-200 font-semibold mt-3 max-w-[260px] leading-relaxed">
                Daftarkan diri Anda dan mulailah petualangan roleplay yang seru bersama kami di {realmName}
              </p>
              <button
                onClick={() => setLocation("/sign-up")}
                className="mt-8 px-10 py-3 rounded-full border border-white/55 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                Sign Up
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* MOBILE RESPONSIVE LAYOUT (Glassmorphic Dark Card) */}
      <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#07050d] px-4 pb-6 pt-6 lg:hidden z-30">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(139,92,246,0.18),transparent_50%),linear-gradient(180deg,#07050d_0%,#0e091a_60%,#07050d_100%)]" />
        <div className="pointer-events-none absolute -left-20 top-20 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-20 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
        {particlesLayer}

        {/* Top Header */}
        <div className="relative z-20 flex items-center justify-between">
          <button
            type="button"
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white shadow-lg backdrop-blur-xl"
            onClick={() => window.history.back()}
          >
            <span className="relative block h-4 w-4">
              <span className="absolute left-0 top-1/2 h-[2px] w-4 -translate-y-1/2 rounded-full bg-current" />
              <span className="absolute left-0 top-1/2 h-[2px] w-2.5 origin-left -translate-y-1/2 rotate-45 rounded-full bg-current" />
              <span className="absolute left-0 top-1/2 h-[2px] w-2.5 origin-left -translate-y-1/2 -rotate-45 rounded-full bg-current" />
            </span>
          </button>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/80 backdrop-blur-xl">
            {realmName}
          </div>
        </div>

        {/* Card and Forms */}
        <div className="relative z-10 flex flex-1 flex-col justify-center py-6">
          <div className="mx-auto mb-5 flex max-w-[320px] flex-col items-center text-center">
            <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 shadow-lg backdrop-blur-2xl">
              <img src={logoSrc} alt={realmName} className="h-9 w-9 object-contain" />
            </div>
            <p className="mt-3 text-[9px] font-black uppercase tracking-[0.38em] text-violet-400">
              {authEyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
              {authAction} {realmName}
            </h1>
          </div>

          <div className="auth-login-card relative mx-auto w-full max-w-[370px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0a1b]/30 p-3 shadow-2xl backdrop-blur-2xl">
            <div className="relative rounded-[20px] border border-white/10 bg-[#07050d]/85 px-4 py-5 shadow-lg backdrop-blur-3xl">
              <div className="min-w-0 [&_.cl-cardBox]:!w-full [&_.cl-main]:!gap-3 [&_.cl-socialButtonsBlock]:!gap-2 [&_.cl-socialButtonsBlockButton]:!min-h-10 [&_.cl-socialButtonsBlockButton]:!text-xs [&_.cl-formFieldInput]:!h-10 [&_.cl-formButtonPrimary]:!h-10 [&_.cl-footer]:!hidden">
                {isSignUp ? (
                  <SignUp
                    routing="path"
                    path={`${basePath}/sign-up`}
                    signInUrl={`${basePath}/sign-in`}
                    oidcPrompt="login select_account consent"
                  />
                ) : (
                  <SignIn
                    routing="path"
                    path={`${basePath}/sign-in`}
                    signUpUrl={`${basePath}/sign-up`}
                    oidcPrompt="login select_account consent"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function AuthPageWrapper() {
  const [location] = useLocation();
  const mode = location.includes("sign-up") ? "sign-up" : "sign-in";
  return <AuthPageLayout mode={mode} />;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkMissingUsernameAutoCompleter() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const isSubmittingRef = useRef(false);
  const [publicUsername, setPublicUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsPublicUsername =
    isLoaded &&
    signUp?.status === "missing_requirements" &&
    signUp.missingFields.includes("username");

  async function completeWithPublicUsername(mode: "manual" | "auto") {
    if (!isLoaded || !signUp || isSubmittingRef.current) return;

    const normalizedManual = publicUsername
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);

    if (mode === "manual" && normalizedManual.length < 3) {
      setError("Handle minimal 3 karakter.");
      return;
    }

    const generatedPublicUsername =
      signUp.emailAddress?.split("@")[0]?.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) ||
      "player";
    const chosenPublicUsername = mode === "manual" ? normalizedManual : generatedPublicUsername;

    setError(null);
    isSubmittingRef.current = true;
    try {
      const updated = await signUp.update({
        username: `arcadia_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        unsafeMetadata: { publicUsername: chosenPublicUsername },
      });

      if (updated.status === "complete" && updated.createdSessionId) {
        await setActive({ session: updated.createdSessionId, redirectUrl: `${basePath}/member` });
      }
    } catch (error) {
      console.error("Failed to complete Clerk username", error);
      setError("Gagal menyimpan handle. Coba lagi.");
    } finally {
      isSubmittingRef.current = false;
    }
  }

  if (!needsPublicUsername) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050408]/90 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-purple-500/10 backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 border border-purple-500/20">
            <img src={`${basePath}/logo.svg`} alt="" className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-black text-white">Pilih Handle Publik</h2>
          <p className="mt-2 text-sm text-white/40">
            Handle boleh sama dengan akun lain karena nanti dibedakan pakai tagar.
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-white/70" htmlFor="public-username">
            Handle manual
          </label>
          <input
            id="public-username"
            value={publicUsername}
            onChange={(event) => setPublicUsername(event.target.value)}
            placeholder="contoh: steve"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none focus:border-purple-500/60 placeholder:text-white/25"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void completeWithPublicUsername("manual")}
            disabled={isSubmittingRef.current}
            className="h-11 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 font-black text-white hover:from-purple-500 hover:to-violet-500 disabled:opacity-60 shadow-lg shadow-purple-500/25"
          >
            Pakai Manual
          </button>
          <button
            type="button"
            onClick={() => void completeWithPublicUsername("auto")}
            disabled={isSubmittingRef.current}
            className="h-11 rounded-xl border border-white/10 bg-white/5 font-bold text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            Generate Otomatis
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect to="/member" />;
  }

  return <Home />;
}


function MemberProtected() {
  return (
    <>
      <Show when="signed-in">
        <Member />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function AdminProtected() {
  return (
    <>
      <Show when="signed-in">
        <Admin />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function FriendsProtected() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/member?tab=guilds" />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ProfileProtected({ params }: { params: { id: string } }) {
  return (
    <>
      <Show when="signed-in">
        <Redirect to={`/member?tab=profile&id=${params.id}`} />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function MessagesProtected() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/member?tab=messages" />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function PremiumProtected() {
  return (
    <>
      <Show when="signed-in">
        <Premium />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function AddFriendProtected() {
  return (
    <>
      <Show when="signed-in">
        <AddFriendPage />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

import { setAuthTokenGetter, useGetStats } from "@workspace/api-client-react";

function ClerkTokenHelper() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setAuthTokenGetter(() => getToken());
    } else {
      setAuthTokenGetter(null);
    }
    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken, isSignedIn, isLoaded]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [location, setLocation] = useLocation();
  const realmSettings = useRealmSettings();
  const realmName = getRealmDisplayName(realmSettings);
  const isAuth = location.startsWith("/sign-in") || location.startsWith("/sign-up");

  return (
    <ClerkProvider
      publishableKey={clerkPubKey || ""}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: `Enter ${realmName}`,
            subtitle: "Sign in to access your player profile",
          },
        },
        signUp: {
          start: {
            title: `Join ${realmName}`,
            subtitle: "Forge your legend today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkTokenHelper />
      <QueryClientProvider client={queryClient}>
        <MultisessionAppSupport>
          <ClerkMissingUsernameAutoCompleter />
          <ClerkQueryClientCacheInvalidator />
          {isAuth ? (
            <AuthPageWrapper />
          ) : (
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/member" component={MemberProtected} />
              <Route path="/admin" component={AdminProtected} />
              <Route path="/friends" component={FriendsProtected} />
              <Route path="/profile/:id" component={ProfileProtected} />
              <Route path="/messages" component={MessagesProtected} />
              <Route path="/premium" component={PremiumProtected} />
              <Route path="/invite/:code">
                {(params) => <Redirect to={`/member?tab=messages&inviteCode=${params.code}`} />}
              </Route>
              <Route path="/join/:code">
                {(params) => <Redirect to={`/member?tab=messages&inviteCode=${params.code}`} />}
              </Route>
              <Route path="/add-friend/:target" component={AddFriendProtected} />
              <Route component={NotFound} />
            </Switch>
          )}
        </MultisessionAppSupport>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  const hasNoKey = !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const isReplitClerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.includes("Y2xlcmsubG9jYWx0aG9zdCQ");
  const isRunningLocally = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.startsWith("192.168.");

  if (hasNoKey || (isReplitClerkKey && isRunningLocally)) {
    return <ClerkConfigWarning hasNoKey={hasNoKey} />;
  }

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
      <Toaster />
    </WouterRouter>
  );
}

export default App;
