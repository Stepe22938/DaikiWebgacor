import { Layout } from "@/components/layout";
import { useGetStats, useListDevelopments } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function Home() {
  const { data: stats } = useGetStats();
  const { data: developments } = useListDevelopments();

  return (
    <Layout>
      <div className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background pointer-events-none" />
        
        <div className="container mx-auto px-4 py-24 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground">
              Forge Your Legend in <span className="text-primary">Nusantara</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              An immersive Indonesian dark fantasy Minecraft roleplay experience. Step into a world of myth, politics, and survival.
            </p>
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button size="lg" asChild className="text-lg px-8 bg-primary text-primary-foreground">
                <Link href="/sign-up">Begin Journey</Link>
              </Button>
            </div>
            
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 border-t border-border mt-12">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{stats.totalMembers}</div>
                  <div className="text-sm text-muted-foreground uppercase tracking-wider">Players</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{stats.totalDevelopments}</div>
                  <div className="text-sm text-muted-foreground uppercase tracking-wider">Features</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{stats.completedDevelopments}</div>
                  <div className="text-sm text-muted-foreground uppercase tracking-wider">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{stats.totalAnnouncements}</div>
                  <div className="text-sm text-muted-foreground uppercase tracking-wider">Lore Drops</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-24">
        <h2 className="text-3xl font-bold text-center mb-12 text-primary">Development Roadmap</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {developments?.slice(0, 6).map((dev) => (
            <Card key={dev.id} className="bg-card/50 border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <span className="text-xl">{dev.title}</span>
                  <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">
                    {dev.status.replace('_', ' ').toUpperCase()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm line-clamp-3">{dev.description}</p>
                {dev.progress !== null && dev.progress !== undefined && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{dev.progress}%</span>
                    </div>
                    <Progress value={dev.progress} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
