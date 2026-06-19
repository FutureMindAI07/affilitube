/**
 * AddToPipelineDialog — extracted from Dashboard.jsx (Phase 2 refactor).
 * Behaviour is unchanged. All state lives in the parent and is passed via props.
 */
import PropTypes from "prop-types";
import { Handshake, FolderOpen, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OUTREACH_STATUS_CONFIG } from "@/lib/outreachConfig";

export default function AddToPipelineDialog({
  open,
  onOpenChange,
  channel,
  projectName,
  setProjectName,
  userProjects,
  status,
  setStatus,
  submitting,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="add-pipeline-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-indigo-500" />
            Add to Pipeline
          </DialogTitle>
          <DialogDescription>
            Add {channel?.channel_name} to your outreach pipeline
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Project / Campaign</Label>
            <div className="relative">
              <Input
                placeholder="e.g. Q1 Outreach, SaaS Partners..."
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="pr-8"
                data-testid="pipeline-project-input"
                autoComplete="off"
              />
              <FolderOpen className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
            {userProjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {userProjects.map(p => (
                  <button
                    key={p}
                    onClick={() => setProjectName(p)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      projectName === p
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-medium"
                        : "bg-white border-slate-200 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Initial Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="pipeline-status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OUTREACH_STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${cfg.color.split(" ")[0]}`}></span>
                      {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
            data-testid="pipeline-confirm-btn"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add to Pipeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

AddToPipelineDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  channel: PropTypes.shape({ channel_name: PropTypes.string }),
  projectName: PropTypes.string.isRequired,
  setProjectName: PropTypes.func.isRequired,
  userProjects: PropTypes.arrayOf(PropTypes.string).isRequired,
  status: PropTypes.string.isRequired,
  setStatus: PropTypes.func.isRequired,
  submitting: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
};
