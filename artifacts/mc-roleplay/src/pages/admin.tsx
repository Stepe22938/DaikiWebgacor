import { Layout } from "@/components/layout";
import { useGetMe } from "@workspace/api-client-react";
import { Redirect } from "wouter";

export default function Admin() {
  const { data: user, isLoading } = useGetMe();

  if (isLoading) return <Layout><div className="p-8">Loading...</div></Layout>;
  
  if (user?.role !== 'admin') {
    return <Redirect to="/member" />;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-primary mb-8">Admin Citadel</h1>
        <p className="text-muted-foreground">Manage the realm here.</p>
        <div className="mt-8 p-8 border border-border rounded-xl bg-card">
          <p className="text-center text-muted-foreground">
            Development and Announcement management forms would be implemented here using the provided hooks.
          </p>
        </div>
      </div>
    </Layout>
  );
}
