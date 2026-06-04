import { Link } from "wouter";
import { useClerk, Show } from "@clerk/react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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
    </div>
  );
}
