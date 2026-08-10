import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ExternalLink, Clock } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ClientAssignments() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/client/assignments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const active = (res.data.assignments || []).filter((a) => !a.expired);
        setAssignments(res.data.assignments || []);
        // Auto-redirect if exactly one active assignment
        if (active.length === 1) {
          navigate(`/client/project/${active[0].id}`, { replace: true });
        }
      } catch (e) {
        setAssignments([]);
      }
    })();
  }, [token, navigate]);

  if (assignments === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center py-24">
        <h1 className="text-xl font-semibold text-slate-900">No projects assigned</h1>
        <p className="text-sm text-slate-500 mt-2">Contact your administrator to gain access.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Your projects</h1>
      <p className="text-sm text-slate-500 mb-6">Click any project to view the vetted creator list.</p>
      <div className="grid sm:grid-cols-2 gap-3" data-testid="client-assignments-grid">
        {assignments.map((a) => (
          <Card
            key={a.id}
            className={`cursor-pointer hover:border-indigo-300 hover:shadow-sm transition ${a.expired ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => !a.expired && navigate(`/client/project/${a.id}`)}
            data-testid={`assignment-card-${a.id}`}
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-900">{a.project_name}</h3>
                {!a.expired && <ExternalLink className="h-4 w-4 text-slate-400" />}
              </div>
              <p className="text-sm text-slate-500">
                {a.expired ? "Access expired" : `${a.channel_count} creator${a.channel_count === 1 ? "" : "s"}`}
              </p>
              {a.expires_at && !a.expired && (
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                  <Clock className="h-3 w-3" />
                  Expires {new Date(a.expires_at).toLocaleDateString()}
                </div>
              )}
              {a.export_enabled && !a.expired && (
                <div className="text-xs text-emerald-600 mt-1.5 font-medium">CSV export enabled</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
