import { Card, CardContent, Typography, Box, LinearProgress } from "@mui/material";
import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: string;
  subtitle?: string;
  progress?: number; // 0–100
}

export const StatCard = ({ title, value, icon, color = "#0B5D46", subtitle, progress }: StatCardProps) => (
  <Card sx={{ height: "100%" }}>
    <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>{title}</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.25, mt: 0.5, letterSpacing: "-0.02em" }} noWrap>
            {value}
          </Typography>
        </Box>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: `${color}14`, color }}>
          {icon}
        </Box>
      </Box>
      {progress !== undefined && (
        <LinearProgress
          variant="determinate" value={Math.min(100, progress)}
          sx={{ mt: 1.5, height: 6, borderRadius: 3, bgcolor: `${color}1f`, "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 } }}
        />
      )}
      {subtitle && <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>{subtitle}</Typography>}
    </CardContent>
  </Card>
);
