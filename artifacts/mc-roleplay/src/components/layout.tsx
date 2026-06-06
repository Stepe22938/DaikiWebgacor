import { Link } from "wouter";
import { useClerk, Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: me } = useGetMe();
  const updateMe = useUpdateMe();
  const queryClient = useQueryClient();
  const [mcName, setMcName] = useState("");
  const [savingMc, setSavingMc] = useState(false);
  const [errorMc, setErrorMc] = useState("");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src={`${basePath}/logo.svg`} alt="Arcadia Studio" className="w-8 h-8" />
            <span className="font-bold text-xl text-primary tracking-wider">Arcadia Studio</span>
          </Link>
          
          <nav className="flex items-center gap-4">
            <Show when="signed-out">
              <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors">
                Sign In
              </Link>
              <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/sign-up">Play Now</Link>
              </Button>
            </Show>
            <Show when="signed-in">
              <Link href="/member" className="text-sm font-medium hover:text-primary transition-colors">
                Player Hub
              </Link>
              <Link href="/friends" className="text-sm font-medium hover:text-primary transition-colors">
                Guild
              </Link>
              <Link href="/messages" className="text-sm font-medium hover:text-primary transition-colors">
                Messages
              </Link>
              <Button variant="ghost" onClick={() => signOut({ redirectUrl: basePath || "/" })}>
                Disconnect
              </Button>
            </Show>
          </nav>
        </div>
      </header>
      
      <main className="flex-1">
        {children}
      </main>
      
      <footer className="border-t border-border bg-card/80 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>Arcadia Studio &copy; {new Date().getFullYear()}. Forged in myth.</p>
        </div>
      </footer>

      {/* Minecraft Username Prompt Overlay */}
      <Dialog open={!!(me && !me.mcUsername)} onOpenChange={() => {}}>
        <DialogContent className="bg-card border-border max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-primary text-center text-xl font-bold flex items-center justify-center gap-2">
              🎮 Minecraft Username
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm text-muted-foreground">
              Selamat datang di **Arcadia Studio**! Silakan masukkan username Minecraft Anda terlebih dahulu untuk melanjutkan.
            </p>
            <div className="space-y-2 text-left">
              <Label htmlFor="promptMcUsername">Username Minecraft</Label>
              <Input
                id="promptMcUsername"
                placeholder="Contoh: Steve_Gacor"
                value={mcName}
                onChange={(e) => {
                  setMcName(e.target.value);
                  setErrorMc("");
                }}
                className="bg-input border-border"
              />
              {errorMc && <p className="text-xs text-destructive">{errorMc}</p>}
            </div>
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              onClick={async () => {
                const trimmed = mcName.trim();
                if (!trimmed) {
                  setErrorMc("Username tidak boleh kosong.");
                  return;
                }
                if (trimmed.length < 3) {
                  setErrorMc("Username minimal 3 karakter.");
                  return;
                }
                setSavingMc(true);
                try {
                  await updateMe.mutateAsync({ data: { mcUsername: trimmed } });
                  await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : "Gagal menyimpan username.";
                  setErrorMc(msg);
                } finally {
                  setSavingMc(false);
                }
              }}
              disabled={savingMc || !mcName.trim()}
            >
              {savingMc ? "Menghubungkan..." : "Hubungkan Karakter"}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground/90 font-medium text-xs mt-1"
              onClick={async () => {
                try {
                  await signOut();
                } catch (err) {
                  console.error("Logout failed:", err);
                }
              }}
              disabled={savingMc}
            >
              Keluar / Log Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
