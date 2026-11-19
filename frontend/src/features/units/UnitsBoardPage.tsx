import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, ButtonBase, Card, CardContent, Chip, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { PageHeader } from "@/components/ui/PageHeader";
import { flatApi } from "@/api/flat";
import { formatBDT } from "@/utils/format";
import { CHIP } from "@/theme";
import type { Flat } from "@/types/flat";

type UnitRow = Flat & { floor: { name: string; buildingId: number; building: { name: string } } };

const LOOK: Record<string, { label: string; bg: string; fg: string }> = {
  OCCUPIED: { label: "Occupied", bg: CHIP.ok.bg, fg: CHIP.ok.fg },
  NOTICE: { label: "On notice", bg: CHIP.warning.bg, fg: CHIP.warning.fg },
  VACANT: { label: "Vacant", bg: CHIP.error.bg, fg: CHIP.error.fg },
  UNDER_MAINTENANCE: { label: "Maintenance", bg: CHIP.muted.bg, fg: CHIP.muted.fg },
};

/** Every unit by building and floor, coloured by status. Click: the agreement, or let a vacant unit. */
export const UnitsBoardPage = () => {
  const navigate = useNavigate();
  const { data: units = [], isLoading } = useQuery({
    queryKey: ["flats", "all"],
    queryFn: async () => (await flatApi.getAllForOwner()).data.data as UnitRow[],
  });
  const buildings = useMemo(() => [...new Map(units.map((u) => [u.floor.buildingId, u.floor.building.name])).entries()], [units]);
  const [buildingId, setBuildingId] = useState<number | "all">("all");

  const shown = units.filter((u) => buildingId === "all" || u.floor.buildingId === buildingId);
  const byFloor = [...shown.reduce((m, u) => m.set(`${u.floor.building.name} · ${u.floor.name}`, [...(m.get(`${u.floor.building.name} · ${u.floor.name}`) ?? []), u]), new Map<string, UnitRow[]>())];
  const count = (s: string) => shown.filter((u) => u.status === s).length;

  return (
    <Box>
      <PageHeader title="Units board" subtitle="Who lives where, and what is free to let." />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {Object.entries(LOOK).map(([k, v]) => (
          <Chip key={k} label={`${v.label} ${count(k)}`} sx={{ bgcolor: v.bg, color: v.fg }} />
        ))}
      </Stack>
      {buildings.length > 1 && (
        <ToggleButtonGroup exclusive size="small" value={buildingId} onChange={(_, v) => v !== null && setBuildingId(v)} sx={{ mb: 2, flexWrap: "wrap" }} aria-label="Building">
          <ToggleButton value="all">All buildings</ToggleButton>
          {buildings.map(([id, name]) => <ToggleButton key={id} value={id}>{name}</ToggleButton>)}
        </ToggleButtonGroup>
      )}
      {isLoading && <Typography>Loading…</Typography>}
      <Stack spacing={2}>
        {byFloor.map(([floor, list]) => (
          <Card key={floor}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>{floor}</Typography>
              <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                {list.map((u) => {
                  const look = LOOK[u.status] ?? LOOK.VACANT;
                  const a = u.currentAgreement;
                  return (
                    <ButtonBase
                      key={u.id}
                      onClick={() => navigate(a ? `/agreements/${a.id}` : `/agreements/new?flatId=${u.id}`)}
                      aria-label={`${u.name}: ${look.label}${a ? `, ${a.tenant.firstName} ${a.tenant.lastName}` : ", let this unit"}`}
                      sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.25, textAlign: "left", p: 1.5, minHeight: 92, borderRadius: 2, bgcolor: look.bg, color: look.fg, "&:hover": { outline: "2px solid", outlineColor: look.fg } }}
                    >
                      <Typography fontWeight={700} fontSize={15} color="inherit">{u.name}</Typography>
                      <Typography fontSize={13} color="inherit">{a ? `${a.tenant.firstName} ${a.tenant.lastName}` : look.label}</Typography>
                      <Typography fontSize={13} color="inherit">{formatBDT(a ? a.rate : u.rent)}{a ? "" : " asking"}</Typography>
                    </ButtonBase>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
};
