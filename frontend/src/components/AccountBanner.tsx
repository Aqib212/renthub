import { Alert, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { orgApi } from "@/api/org";

/** Dashboard: plan limit reached / plan expired / SMS credit low. Hidden when all is well. */
export const AccountBanner = () => {
  const { data: org } = useQuery({ queryKey: ["org-current"], queryFn: orgApi.current });
  if (!org?.planInfo) return null;
  const p = org.planInfo;
  const notes: { severity: "warning" | "error"; text: string }[] = [];
  if (p.expired) notes.push({ severity: "warning", text: `Your ${p.name} plan ended on ${new Date(p.paidUntil!).toLocaleDateString("en-GB")}. The free limit of ${p.limit} units applies until you renew; nothing has been removed.` });
  if (p.used >= p.limit) notes.push({ severity: "warning", text: `You have ${p.used} of ${p.limit} units and vehicles on your plan: ask RentHub to upgrade before adding more.` });
  if ((org.smsCredits ?? 0) < 50) notes.push({ severity: (org.smsCredits ?? 0) <= 0 ? "error" : "warning", text: (org.smsCredits ?? 0) <= 0 ? "SMS credit is used up: receipts and reminders are not being sent. Ask RentHub for a top-up." : `Only ${org.smsCredits} SMS left. Ask RentHub for a top-up.` });
  if (!notes.length) return null;
  return <Stack spacing={1} sx={{ mb: 2 }}>{notes.map((n) => <Alert key={n.text} severity={n.severity}>{n.text}</Alert>)}</Stack>;
};
