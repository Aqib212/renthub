import { useState } from "react";
import {
  Box, Card, CardContent, Grid, Typography, Chip, Button, IconButton, Switch, Tooltip, Stack, Skeleton,
} from "@mui/material";
import { Add, EditOutlined, DeleteOutline, ApartmentOutlined, ArrowUpward, ArrowDownward } from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { billTypeApi } from "@/api/billType";
import { PageHeader } from "@/components/ui/PageHeader";
import { methodLabel, type BillType, SPLIT_RULES } from "@/types/billType";
import { formatBDT, apiError } from "@/utils/format";
import { BillTypeDialog } from "./components/BillTypeDialog";
import { BillTypeFlatsDialog } from "./components/BillTypeFlatsDialog";

const summary = (bt: BillType) => {
  const vat = bt.vatPercent ? ` + VAT ${bt.vatPercent}%` : "";
  switch (bt.calcMethod) {
    case "FIXED": return `${formatBDT(bt.rate)} per month${vat}`;
    case "METERED": return `${formatBDT(bt.rate)} per ${bt.unitLabel || "unit"}${bt.fixedCharge ? ` + ${formatBDT(bt.fixedCharge)} meter rent` : ""}${vat}`;
    case "SLAB": return `${bt.slabs?.steps.length ?? 0} slabs${bt.demandChargePerKw ? ` · ${formatBDT(bt.demandChargePerKw)}/kW demand` : ""}${vat}`;
    case "PER_PERSON": return `${formatBDT(bt.rate)} per person${vat}`;
    case "MANUAL": return "Amount entered each month";
    case "SHARED": return `Building bill split ${SPLIT_RULES.find((s) => s.value === (bt.split ?? "EQUAL"))?.label.toLowerCase()}`;
  }
};

export const BillTypesPage = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BillType | "new" | null>(null);
  const [flatsFor, setFlatsFor] = useState<BillType | null>(null);

  const { data: types = [], isLoading } = useQuery({ queryKey: ["bill-types"], queryFn: billTypeApi.list });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["bill-types"] });
    qc.invalidateQueries({ queryKey: ["billing-month"] });
  };

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BillType> }) => billTypeApi.update(id, data),
    onSuccess: invalidate,
    onError: (e) => toast.error(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => billTypeApi.remove(id),
    onSuccess: () => { invalidate(); toast.success("Bill type deleted"); },
    onError: (e) => toast.error(apiError(e)),
  });

  const move = async (index: number, dir: -1 | 1) => {
    const a = types[index];
    const b = types[index + dir];
    if (!a || !b) return;
    // re-number everything so equal sortOrders can't get stuck
    const order = types.map((t) => t.id);
    [order[index], order[index + dir]] = [order[index + dir], order[index]];
    await Promise.all(order.map((id, i) => billTypeApi.update(id, { sortOrder: i + 1 })));
    invalidate();
  };

  return (
    <Box>
      <PageHeader
        title="Bill Types"
        subtitle="Everything you collect from tenants each month. Choose how each one is calculated and which flats pay it."
        actions={<Button variant="contained" startIcon={<Add />} onClick={() => setEditing("new")}>Add bill type</Button>}
      />

      <Grid container spacing={2}>
        {isLoading && [1, 2, 3].map((i) => (
          <Grid item xs={12} md={6} lg={4} key={i}><Skeleton variant="rounded" height={150} /></Grid>
        ))}
        {types.map((bt, i) => (
          <Grid item xs={12} md={6} lg={4} key={bt.id}>
            <Card sx={{ height: "100%", opacity: bt.isActive ? 1 : 0.6, transition: "opacity .2s" }}>
              <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>{bt.name}</Typography>
                    <Chip label={methodLabel(bt.calcMethod)} size="small" color="primary" variant="outlined" sx={{ mt: 0.5 }} />
                  </Box>
                  <Tooltip title={bt.isActive ? "Active: added to invoices" : "Inactive: not billed"}>
                    <Switch checked={bt.isActive} onChange={(e) => update.mutate({ id: bt.id, data: { isActive: e.target.checked } })} />
                  </Tooltip>
                </Stack>

                <Typography variant="body2" sx={{ mt: 1.5, minHeight: 20 }}>{summary(bt)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {bt.appliesToAll ? "All occupied flats" : `${bt._count?.flatCharges ?? 0} selected flat(s)`}
                </Typography>

                <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, mx: -1 }}>
                  <Button size="small" startIcon={<EditOutlined />} onClick={() => setEditing(bt)}>Edit</Button>
                  <Button size="small" startIcon={<ApartmentOutlined />} onClick={() => setFlatsFor(bt)}>Flats</Button>
                  <Box sx={{ flexGrow: 1 }} />
                  <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUpward fontSize="small" /></IconButton>
                  <IconButton size="small" disabled={i === types.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDownward fontSize="small" /></IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Delete"
                    onClick={() => confirm(`Delete "${bt.name}"? Existing invoices keep their lines.`) && remove.mutate(bt.id)}
                  >
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {editing && (
        <BillTypeDialog
          billType={editing === "new" ? null : editing}
          nextSortOrder={types.length + 1}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      )}
      {flatsFor && <BillTypeFlatsDialog billType={flatsFor} onClose={() => setFlatsFor(null)} onSaved={invalidate} />}
    </Box>
  );
};
