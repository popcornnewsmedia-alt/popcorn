import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-8xl font-display font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold text-foreground">Lost in the noise</h2>
        <p className="text-muted-foreground text-lg">
          The article or page you're looking for doesn't exist or has been moved.
        </p>
        <div className="pt-4">
          <Link 
            href="/" 
            className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Return to Feed
          </Link>
        </div>
      </div>
    </div>
  );
}
