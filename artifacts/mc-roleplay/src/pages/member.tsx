import { Layout } from "@/components/layout";
import { useGetMe, useListAnnouncements, useListDevelopments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link } from "wouter";

export default function Member() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: announcements, isLoading: announcementsLoading } = useListAnnouncements();
  const { data: developments, isLoading: developmentsLoading } = useListDevelopments();

  if (userLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-8"><Skeleton className="h-[200px] w-full" /></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome back, {user?.displayName || user?.username}</h1>
            <p className="text-muted-foreground">Your player portal.</p>
          </div>
          {user?.role === 'admin' && (
            <Link href="/admin" className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors">
              Admin Citadel
            </Link>
          )}
        </div>

        <Tabs defaultValue="announcements" className="space-y-8">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="announcements">Town Crier</TabsTrigger>
            <TabsTrigger value="developments">The Forge</TabsTrigger>
          </TabsList>

          <TabsContent value="announcements" className="space-y-4">
            {announcementsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : announcements?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">The town is quiet today.</div>
            ) : (
              announcements?.map((ann) => (
                <Card key={ann.id} className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl text-primary flex items-center justify-between">
                      <span>{ann.title}</span>
                      <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                        {ann.type.toUpperCase()}
                      </span>
                    </CardTitle>
                    <div className="text-xs text-muted-foreground">
                      By {ann.authorName} • {format(new Date(ann.createdAt), 'MMM d, yyyy')}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{ann.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="developments" className="grid gap-4 md:grid-cols-2">
            {developmentsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              developments?.map((dev) => (
                <Card key={dev.id} className="bg-card border-border flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg flex justify-between items-center">
                      {dev.title}
                      <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded">
                        {dev.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                    <p className="text-sm text-muted-foreground">{dev.description}</p>
                    {dev.progress !== null && dev.progress !== undefined && (
                      <div className="space-y-1 mt-4">
                        <div className="flex justify-between text-xs">
                          <span>Progress</span>
                          <span>{dev.progress}%</span>
                        </div>
                        <Progress value={dev.progress} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
