import { Mail, Shield } from "lucide-react";

const Header = () => {
  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 glow-blue">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gradient">TempMail</h1>
            <p className="text-[10px] text-muted-foreground leading-none">Disposable Email</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span>Secured</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
