import { Clock, Globe, Shield } from "lucide-react";

const StatsBar = () => {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { icon: Clock, label: "Auto-delete", value: "1 hour" },
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
  );
};

export default StatsBar;
