import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Mail, ExternalLink, Download, Users } from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import { selectVisiblePlatforms, platformLabelFor } from "@/lib/affiliatePlatformDisplay";
import { flagEmoji, countryName } from "@/lib/countries";
import { toast } from "sonner";
import { ChannelDetailSheet } from "@/components/ChannelDetailSheet";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ClientProjectView() {
  const { assignmentId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Axios instance passed to ChannelDetailSheet. Client tokens can't hit
  // /channels/{id}/sponsorship-data (returns 404), so the sheet is told to
  // use embedded channel.sponsorship_data via readOnly=true.
  const api = useMemo(() => axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${token}` },
  }), [token]);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/client/assignments/${assignmentId}/channels`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (e) {
        setError(e.response?.data?.detail || "Failed to load project");
      }
    })();
  }, [assignmentId, token]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await axios.post(`${API}/client/assignments/${assignmentId}/export/csv`, {}, {
        headers: { Authorization: `Bearer ${token}` }, responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      const today = new Date().toISOString().slice(0, 10);
      link.download = `${data.assignment.project_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${today}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const openChannelSheet = (ch) => {
    setSelectedChannel(ch);
    setSheetOpen(true);
  };

  if (error) {
    return (
      <div className="text-center py-24">
        <h1 className="text-xl font-semibold text-slate-900" data-testid="client-project-error">{error}</h1>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/client")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>
    );
  }
  if (!data) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }
  const { assignment, channels } = data;

  return (
    <div data-testid="client-project-view">
      <div className="flex items-center justify-between mb-4">
        <div>
          <button onClick={() => navigate("/client")} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> All projects
          </button>
          <h1 className="text-2xl font-semibold text-slate-900" data-testid="client-project-title">{assignment.project_name}</h1>
          <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
            <Users className="h-3.5 w-3.5" /> {channels.length} vetted creator{channels.length === 1 ? "" : "s"}
          </p>
        </div>
        {assignment.export_enabled && (
          <Button variant="outline" onClick={handleExport} disabled={exporting} data-testid="client-export-btn">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Export CSV
          </Button>
        )}
      </div>

      <p className="text-xs text-slate-400 mb-3">Click any creator to see the full profile — scores, health signals, brand intelligence, and past sponsorship history.</p>

      <div className="space-y-3">
        {channels.map((ch) => {
          const { visible, hiddenCount, hiddenLabels } = selectVisiblePlatforms(ch.affiliate_platforms_found, 2);
          const links = ch.public_links || {};
          return (
            <Card
              key={ch.channel_id}
              className="cursor-pointer hover:border-indigo-300 hover:shadow-sm transition"
              onClick={() => openChannelSheet(ch)}
              data-testid={`client-creator-card-${ch.channel_id}`}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 hover:text-indigo-700">
                        {ch.channel_name}
                      </span>
                      <a
                        href={ch.channel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-slate-700"
                        title="Open on YouTube"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      {ch.country_name && (
                        <span className="text-xs text-slate-500" title={countryName(ch.country_code || ch.country)}>
                          {flagEmoji(ch.country_code || ch.country)} {ch.country_name}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 mb-2">
                      <span><strong>{formatNumber(ch.subscriber_count)}</strong> subs</span>
                      <span>·</span>
                      <span>{formatNumber(ch.video_count)} videos</span>
                      {ch.score_total !== undefined && (
                        <>
                          <span>·</span>
                          <Badge variant="outline" className="text-xs">Score {ch.score_total}</Badge>
                        </>
                      )}
                      {ch.upload_consistency && (
                        <Badge variant="secondary" className="text-xs">{ch.upload_consistency}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {visible.map((p) => (
                        <span key={p} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-700 border border-teal-200">
                          {platformLabelFor(p)}
                        </span>
                      ))}
                      {hiddenCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600" title={hiddenLabels}>+{hiddenCount}</span>
                      )}
                      {ch.affiliate_platforms_found?.length === 0 && ch.affiliate_links_total > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {ch.affiliate_links_total} aff links
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1 text-sm">
                    {ch.business_email && (
                      <a
                        href={`mailto:${ch.business_email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 justify-end text-blue-600 hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span className="text-xs truncate max-w-[200px]">{ch.business_email}</span>
                      </a>
                    )}
                    <div className="flex gap-2 justify-end flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {links.instagram && <a href={links.instagram} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-800">IG</a>}
                      {links.twitter && <a href={links.twitter} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-800">X</a>}
                      {links.linkedin && <a href={links.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-800">LI</a>}
                      {links.tiktok && <a href={links.tiktok} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-800">TT</a>}
                      {links.website && <a href={links.website} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-800">Web</a>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Read-only detail sheet — same component as the admin pipeline */}
      <ChannelDetailSheet
        channel={selectedChannel}
        open={sheetOpen}
        onOpenChange={(v) => { setSheetOpen(v); if (!v) setSelectedChannel(null); }}
        api={api}
        userTier="pro"
        readOnly={true}
      />
    </div>
  );
}
