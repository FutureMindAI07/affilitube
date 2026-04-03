import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function UpgradeDialog({ open, onOpenChange }) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="upgrade-dialog" className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <Lock className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle className="text-xl">Upgrade to Unlock</DialogTitle>
          <DialogDescription className="text-base">
            This feature requires a Starter or Pro plan. Upgrade to access CSV exports, saved searches, saved reports, and more.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/pricing");
            }}
            className="w-full btn-gradient"
            data-testid="upgrade-view-pricing-btn"
          >
            View Pricing
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full text-muted-foreground"
            data-testid="upgrade-maybe-later-btn"
          >
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
