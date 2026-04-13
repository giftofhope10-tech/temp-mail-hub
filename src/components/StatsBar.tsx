import { useState, useEffect } from "react";
import { Clock, Globe, Shield } from "lucide-react";

const SESSION_DURATION = 24 * 60 * 60 * 1000;

interface StatsBarProps {
  createdAt: number;
}

const StatsBar = ({ createdAt }: StatsBarProps) => {
  const [remaining, setRemaining] = useState(SESSION_DURATION);

  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - createdAt;
      setRemaining(Math.max(0, SESSION_DURATION - elapsed));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const progress = (remaining / SESSION_DURATION) * 100;
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const timeStr = `${hours}h ${minutes}m`;

  return (
    <div className="space-y-3">
      {/* Timer progress bar */}
      <div className="gradient-card rounded-lg border border-border/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>Time remaining</span>
          </div>
          <span className="text-xs font-semibold text-primary">{timeStr}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{
              width: `${progress}%`,
              background: progress > 50
                ? "hsl(140, 60%, 45%)"
                : progress > 20
                ? "hsl(45, 80%, 50%)"
                : "hsl(0, 70%, 50%)",
            }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Email auto-deletes after 24 hours</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Clock, label: "Auto-delete", value: "24 hours" },
          { icon: Globe, label: "Domains", value: "3 active" },
          { icon: Shield, label: "Privacy", value: "100%" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="gradient-card rounded-lg border border-border/30 p-3 text-center">
            <Icon className="h-4 w-4 text-primary mx-auto mb-1.5" />
            <p className="text-xs font-semibold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsBar;
