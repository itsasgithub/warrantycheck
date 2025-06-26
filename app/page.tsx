export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-4xl mx-auto p-8 text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Warranty Watcher
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          A warranty information management system that bridges the gap between IT management platforms and manufacturer warranty databases.
        </p>
        <div className="bg-muted p-6 rounded-lg">
          <p className="text-foreground">
            Welcome to Warranty Watcher! This system helps you manage warranty information across multiple platforms and manufacturers.
          </p>
        </div>
      </div>
    </div>
  );
}