/**
 * SaveReportDialog — extracted from Dashboard.jsx (Phase 2 refactor).
 * Behaviour is unchanged. All state lives in the parent and is passed via props.
 *
 * The trigger Button stays in the parent; only the modal markup itself was
 * moved out.
 */
import PropTypes from "prop-types";
import { FileText } from "lucide-react";
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

export default function SaveReportDialog({
  open,
  onOpenChange,
  reportName,
  setReportName,
  channelsCount,
  shortlistCount,
  keywords,
  minSubs,
  maxSubs,
  onSave,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="save-report-dialog">
        <DialogHeader>
          <DialogTitle>Save Report</DialogTitle>
          <DialogDescription>
            Save this search with all results for future reference.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="report-name">Report Name</Label>
            <Input
              id="report-name"
              placeholder="e.g., Automation Prospects Jan 2026"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              data-testid="report-name-input"
            />
          </div>
          <div className="text-sm text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-md">
            <p><strong>Channels:</strong> {channelsCount}</p>
            <p><strong>Shortlisted:</strong> {shortlistCount}</p>
            <p><strong>Keywords:</strong> {keywords.split("\n").filter(k => k.trim()).length}</p>
            <p><strong>Filters:</strong> {minSubs.toLocaleString()}-{maxSubs.toLocaleString()} subs</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} data-testid="confirm-save-report-btn" className="btn-gradient">
            <FileText className="h-4 w-4 mr-2" />
            Save Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

SaveReportDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  reportName: PropTypes.string.isRequired,
  setReportName: PropTypes.func.isRequired,
  channelsCount: PropTypes.number.isRequired,
  shortlistCount: PropTypes.number.isRequired,
  keywords: PropTypes.string.isRequired,
  minSubs: PropTypes.number.isRequired,
  maxSubs: PropTypes.number.isRequired,
  onSave: PropTypes.func.isRequired,
};
