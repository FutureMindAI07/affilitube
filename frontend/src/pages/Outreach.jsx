import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Mail,
  Copy,
  Check,
  Pencil,
  Eye,
  Handshake,
  Megaphone,
  Gift,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const TEMPLATES = [
  {
    id: "intro",
    name: "Initial Introduction",
    category: "First Contact",
    icon: Handshake,
    description: "A warm first message to introduce yourself and your product",
    subject: "Collaboration opportunity with {{YOUR_PRODUCT}}",
    body: `Hi {{CHANNEL_NAME}},

I've been following your channel and really enjoy your content on {{TOPIC}}. Your {{RECENT_VIDEO}} video was particularly insightful.

I'm reaching out from {{YOUR_PRODUCT}} — {{PRODUCT_DESCRIPTION}}. Given your audience's interest in {{TOPIC}}, I think there could be a great fit for a collaboration.

We offer an affiliate programme with {{COMMISSION_DETAILS}}, and I'd love to explore how we could work together. Would you be open to a quick chat this week?

Best regards,
{{YOUR_NAME}}`,
  },
  {
    id: "affiliate-pitch",
    name: "Affiliate Programme Pitch",
    category: "Affiliate",
    icon: Gift,
    description: "Direct pitch for joining your affiliate programme with commission details",
    subject: "Earn {{COMMISSION_RATE}} per referral — {{YOUR_PRODUCT}} affiliate programme",
    body: `Hi {{CHANNEL_NAME}},

I noticed you've been covering {{TOPIC}} and tools related to it — your audience seems like the perfect fit for what we've built.

{{YOUR_PRODUCT}} is {{PRODUCT_DESCRIPTION}}, and we've just launched our affiliate programme:

- {{COMMISSION_RATE}} commission per sale
- 30-day cookie window
- Dedicated affiliate dashboard with real-time tracking
- Custom discount codes for your audience

Several creators in the {{TOPIC}} space are already seeing great results with us. I'd be happy to set you up with a free account to try it first-hand.

Interested? I can have you set up in under 5 minutes.

Cheers,
{{YOUR_NAME}}`,
  },
  {
    id: "review-request",
    name: "Product Review Request",
    category: "Review",
    icon: Megaphone,
    description: "Request for an honest product review with free access",
    subject: "Free access to {{YOUR_PRODUCT}} — honest review request",
    body: `Hi {{CHANNEL_NAME}},

I'm a fan of your {{TOPIC}} content and thought you might find {{YOUR_PRODUCT}} interesting to review for your audience.

{{YOUR_PRODUCT}} is {{PRODUCT_DESCRIPTION}}. I'd love to offer you full access completely free — no strings attached. If you find it useful, a mention or review would be brilliant, but there's absolutely no obligation.

Here's what makes it stand out:
- {{KEY_FEATURE_1}}
- {{KEY_FEATURE_2}}
- {{KEY_FEATURE_3}}

Shall I set you up with an account?

All the best,
{{YOUR_NAME}}`,
  },
  {
    id: "follow-up",
    name: "Friendly Follow-Up",
    category: "Follow-Up",
    icon: Mail,
    description: "A gentle follow-up for when you haven't heard back",
    subject: "Re: Collaboration opportunity with {{YOUR_PRODUCT}}",
    body: `Hi {{CHANNEL_NAME}},

Just wanted to circle back on my previous message about a potential collaboration between {{YOUR_PRODUCT}} and your channel.

I completely understand how busy things get — I just didn't want this to slip through the cracks in case it's something you'd be interested in.

Happy to work around your schedule. Even a 10-minute call would be great to see if there's a fit.

No worries at all if the timing isn't right — I appreciate your content either way!

Best,
{{YOUR_NAME}}`,
  },
  {
    id: "collab-video",
    name: "Video Collaboration",
    category: "Collaboration",
    icon: Users,
    description: "Propose a joint video or sponsored content partnership",
    subject: "Video collaboration idea — {{YOUR_PRODUCT}} x {{CHANNEL_NAME}}",
    body: `Hi {{CHANNEL_NAME}},

I love the production quality of your videos on {{TOPIC}}, and I have an idea I think your audience would genuinely enjoy.

We've been working on {{YOUR_PRODUCT}} ({{PRODUCT_DESCRIPTION}}), and I think there's a great video idea here:

"{{VIDEO_IDEA}}"

We'd cover:
- Full creative freedom — your style, your approach
- Sponsorship fee of {{SPONSORSHIP_AMOUNT}}
- Affiliate link for ongoing passive income
- Free product access for your team

Would you be open to discussing this? I can share more details and some examples of collabs we've done with other creators.

Looking forward to hearing from you,
{{YOUR_NAME}}`,
  },
];

const VARIABLE_LABELS = {
  "CHANNEL_NAME": "Channel Name",
  "TOPIC": "Content Topic/Niche",
  "RECENT_VIDEO": "Recent Video Title",
  "YOUR_PRODUCT": "Your Product Name",
  "PRODUCT_DESCRIPTION": "Short Product Description",
  "COMMISSION_DETAILS": "Commission Details",
  "COMMISSION_RATE": "Commission Rate (e.g., 30%)",
  "YOUR_NAME": "Your Name",
  "KEY_FEATURE_1": "Key Feature 1",
  "KEY_FEATURE_2": "Key Feature 2",
  "KEY_FEATURE_3": "Key Feature 3",
  "VIDEO_IDEA": "Video Idea Title",
  "SPONSORSHIP_AMOUNT": "Sponsorship Amount",
};

function extractVariables(text) {
  const matches = text.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/[{}]/g, "")))];
}

export default function Outreach() {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variables, setVariables] = useState({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(null); // "subject" | "body" | null

  const openTemplate = (template) => {
    setSelectedTemplate(template);
    const vars = extractVariables(template.subject + template.body);
    const initial = {};
    vars.forEach((v) => { initial[v] = variables[v] || ""; });
    setVariables(initial);
    setPreviewOpen(false);
  };

  const fillTemplate = (text) => {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || `{{${key}}}`);
    });
    return result;
  };

  const filledSubject = selectedTemplate ? fillTemplate(selectedTemplate.subject) : "";
  const filledBody = selectedTemplate ? fillTemplate(selectedTemplate.body) : "";
  const allVarsFilled = selectedTemplate
    ? extractVariables(selectedTemplate.subject + selectedTemplate.body).every((v) => variables[v]?.trim())
    : false;

  const handleCopy = (type) => {
    const text = type === "subject" ? filledSubject : filledBody;
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success(`${type === "subject" ? "Subject" : "Email body"} copied to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6" data-testid="outreach-page">
      {selectedTemplate ? (
        /* Template Editor */
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Variables Panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-slate-900">{selectedTemplate.name}</h2>
              <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={() => setSelectedTemplate(null)} data-testid="back-to-templates">
                All Templates
              </Button>
            </div>
            <p className="text-sm text-slate-500">{selectedTemplate.description}</p>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Fill in the details</h3>
              {extractVariables(selectedTemplate.subject + selectedTemplate.body).map((v) => (
                <div key={v} className="space-y-1">
                  <Label className="text-xs text-slate-500">{VARIABLE_LABELS[v] || v.replace(/_/g, " ")}</Label>
                  <Input
                    value={variables[v] || ""}
                    onChange={(e) => setVariables({ ...variables, [v]: e.target.value })}
                    placeholder={VARIABLE_LABELS[v] || v}
                    className="h-9 text-sm rounded-lg"
                    data-testid={`var-${v.toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-3">
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading text-sm">Email Preview</CardTitle>
                  <Badge variant={allVarsFilled ? "default" : "outline"} className="rounded-full text-[10px]">
                    {allVarsFilled ? (
                      <><Check className="h-3 w-3 mr-1" /> Ready to copy</>
                    ) : (
                      <><Pencil className="h-3 w-3 mr-1" /> Fill all fields</>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Subject */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs text-slate-500">Subject Line</Label>
                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-full gap-1" onClick={() => handleCopy("subject")} data-testid="copy-subject">
                      {copied === "subject" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied === "subject" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-sm text-slate-800 font-medium" data-testid="preview-subject">
                    {filledSubject}
                  </div>
                </div>

                {/* Body */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs text-slate-500">Email Body</Label>
                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-full gap-1" onClick={() => handleCopy("body")} data-testid="copy-body">
                      {copied === "body" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied === "body" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 text-sm text-slate-700 whitespace-pre-line leading-relaxed max-h-[450px] overflow-y-auto" data-testid="preview-body">
                    {filledBody}
                  </div>
                </div>

                {/* Copy All */}
                <Button
                  className="w-full btn-gradient"
                  onClick={() => {
                    navigator.clipboard.writeText(`Subject: ${filledSubject}\n\n${filledBody}`);
                    toast.success("Full email copied to clipboard");
                    setCopied("all");
                    setTimeout(() => setCopied(null), 2000);
                  }}
                  data-testid="copy-all"
                >
                  {copied === "all" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied === "all" ? "Copied!" : "Copy Full Email"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Template Gallery */
        <>
          <div>
            <h2 className="font-heading text-xl font-bold text-slate-900 mb-1">Outreach Templates</h2>
            <p className="text-sm text-slate-500">Ready-to-use email templates for reaching out to YouTube creators. Fill in your details, preview, and copy.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <Card
                  key={t.id}
                  className="glass-card group cursor-pointer hover:border-indigo-200/60 transition-all"
                  onClick={() => openTemplate(t)}
                  data-testid={`template-${t.id}`}
                >
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0 group-hover:from-indigo-200 group-hover:to-purple-200 transition-colors">
                        <Icon className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-heading font-semibold text-slate-900 text-sm">{t.name}</h3>
                        <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0 mt-1 border-slate-200">{t.category}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-3">{t.description}</p>
                    <div className="text-xs text-indigo-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                      Use template <ArrowRight className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
