/**
 * BugReportDialog — extracted from Dashboard.jsx (Phase 2 refactor).
 * Behaviour is unchanged. All state lives in the parent and is passed via props.
 */
import PropTypes from "prop-types";
import { Bug, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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

export default function BugReportDialog({
  open,
  onOpenChange,
  bugSubject,
  setBugSubject,
  bugSeverity,
  setBugSeverity,
  bugDescription,
  setBugDescription,
  bugSteps,
  setBugSteps,
  bugSubmitting,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-orange-500" />
            Report a Bug
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bug-subject">Subject</Label>
            <Input
              id="bug-subject"
              placeholder="Brief summary of the issue"
              value={bugSubject}
              onChange={(e) => setBugSubject(e.target.value)}
              data-testid="bug-subject-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bug-severity">Severity</Label>
            <Select value={bugSeverity} onValueChange={setBugSeverity}>
              <SelectTrigger data-testid="bug-severity-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — Minor issue, workaround exists</SelectItem>
                <SelectItem value="medium">Medium — Feature not working correctly</SelectItem>
                <SelectItem value="high">High — Major feature broken</SelectItem>
                <SelectItem value="critical">Critical — App unusable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bug-description">Description</Label>
            <Textarea
              id="bug-description"
              placeholder="What happened? What did you expect to happen?"
              value={bugDescription}
              onChange={(e) => setBugDescription(e.target.value)}
              rows={3}
              data-testid="bug-description-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bug-steps">Steps to Reproduce (optional)</Label>
            <Textarea
              id="bug-steps"
              placeholder="1. Go to...\n2. Click on...\n3. See error..."
              value={bugSteps}
              onChange={(e) => setBugSteps(e.target.value)}
              rows={3}
              data-testid="bug-steps-input"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onSubmit}
            disabled={bugSubmitting}
            className="btn-gradient"
            data-testid="bug-submit-btn"
          >
            {bugSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

BugReportDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  bugSubject: PropTypes.string.isRequired,
  setBugSubject: PropTypes.func.isRequired,
  bugSeverity: PropTypes.string.isRequired,
  setBugSeverity: PropTypes.func.isRequired,
  bugDescription: PropTypes.string.isRequired,
  setBugDescription: PropTypes.func.isRequired,
  bugSteps: PropTypes.string.isRequired,
  setBugSteps: PropTypes.func.isRequired,
  bugSubmitting: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
};
