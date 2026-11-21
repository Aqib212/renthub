import { useState } from "react";
import { Card, CardContent, Stack, TextField, Typography, InputAdornment, Chip } from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { buildingApi } from "@/api/building";
import { billTypeApi } from "@/api/billType";
import { SPLIT_RULES, type BillingMonth, type BillType } from "@/types/billType";
import { apiError, formatBDT } from "@/utils/format";

/**
 * Shared bills (WASA, common electricity…): the owner types the building's total for the month,
 * the server splits it into each let unit's amount, and the grid below shows the shares.
 */
export const BuildingBillsPanel = ({ month, year, data, locked }: { month: number; year: number; data: BillingMonth; locked: boolean }) => {
  const shared = data.billTypes.filter((b) => b.calcMethod === "SHARED");
  const { data: buildings = [] } = useQuery({
    queryKey: ["buildings", { limit: 200 }],
    queryFn: async () => {
      const res = await buildingApi.getAll({ limit: 200 });
      return (res.data.data || res.data) as { id: number; name: string }[];
    },
    enabled: shared.length > 0,
  });
  if (!shared.length) return null;
  // only buildings that have a unit billed this month
  const billed = buildings.filter((b) => data.rows.some((r) => r.buildingName === b.name));

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" fontSize={16}>Building bills</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Enter each building's total; it is split across the let units and appears in the table below.
        </Typography>
        <Stack spacing={1.25}>
          {billed.flatMap((b) =>
            shared.map((bt) => (
              <BillRow key={`${b.id}:${bt.id}:${month}:${year}:${data.buildingBills.length}`} building={b} bt={bt} month={month} year={year} locked={locked}
                saved={data.buildingBills.find((x) => Number(x.buildingId) === Number(b.id) && Number(x.billTypeId) === Number(bt.id))?.total ?? null} />
            ))
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

const BillRow = ({ building, bt, month, year, saved, locked }: {
  building: { id: number; name: string }; bt: BillType; month: number; year: number; saved: number | null; locked: boolean;
}) => {
  const qc = useQueryClient();
  const [total, setTotal] = useState(saved === null ? "" : String(saved));
  const save = useMutation({
    mutationFn: () => billTypeApi.saveBuildingBill({ buildingId: Number(building.id), billTypeId: Number(bt.id), month, year, total: Number(total) }),
    onSuccess: (fresh) => {
      qc.setQueryData(["billing-month", month, year], fresh);
      toast.success(`${bt.name} split for ${building.name}`);
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const rule = SPLIT_RULES.find((s) => s.value === (bt.split ?? "EQUAL"))?.label.toLowerCase();
  const changed = total !== (saved === null ? "" : String(saved));

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
      <Typography sx={{ flex: 1, minWidth: 180 }} fontWeight={600} fontSize={14}>
        {building.name} · {bt.name}
        <Typography component="span" variant="caption" color="text.secondary" display="block">Split {rule}</Typography>
      </Typography>
      <TextField
        size="small" type="number" label="Building total" value={total} disabled={locked} sx={{ width: { sm: 180 } }}
        onChange={(e) => setTotal(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start">৳</InputAdornment> }}
      />
      {saved !== null && !changed && <Chip size="small" color="success" variant="outlined" label={`Split ${formatBDT(saved)}`} />}
      <LoadingButton variant="outlined" size="small" loading={save.isPending} disabled={locked || !(Number(total) > 0) || !changed} onClick={() => save.mutate()}>
        Save and split
      </LoadingButton>
    </Stack>
  );
};
