/**
 * SaveSearchDialog — extracted from Dashboard.jsx (Phase 2 refactor).
 * Behaviour is unchanged. All state lives in the parent and is passed via props.
 *
 * The trigger Button stays in the parent next to the other action buttons;
 * only the modal markup itself was moved out.
 */
import PropTypes from "prop-types";
import { Save } from "lucide-react";
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

export default function SaveSearchDialog({
  open,
  onOpenChange,
  searchName,
  setSearchName,
  keywords,
  minSubs,
  maxSubs,
  uploadedWithin,
  searchMode,
  channelsCount,
  onSave,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="save-search-dialog">
        <DialogHeader>
          <DialogTitle>Save Search</DialogTitle>
          <DialogDescription>
            Save this search configuration to quickly run it again later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="search-name">Search Name</Label>
            <Input
              id="search-name"
              placeholder="e.g., Automation YouTubers Q1 2026"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              data-testid="search-name-input"
            />
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Keywords:</strong> {keywords.split("\n").filter(k => k.trim()).length}</p>
            <p><strong>Filters:</strong> {minSubs.toLocaleString()}-{maxSubs.toLocaleString()} subs, {uploadedWithin} days</p>
            <p><strong>Mode:</strong> {searchMode.replace("_", " + ")}</p>
            {channelsCount > 0 && (
              <p><strong>Last Results:</strong> {channelsCount} channels</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} data-testid="confirm-save-search-btn" className="btn-gradient">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

SaveSearchDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  searchName: PropTypes.string.isRequired,
  setSearchName: PropTypes.func.isRequired,
  keywords: PropTypes.string.isRequired,
  minSubs: PropTypes.number.isRequired,
  maxSubs: PropTypes.number.isRequired,
  uploadedWithin: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  searchMode: PropTypes.string.isRequired,
  channelsCount: PropTypes.number.isRequired,
  onSave: PropTypes.func.isRequired,
};
