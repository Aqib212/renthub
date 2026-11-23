import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem, Stack, TextField,
  Typography, useMediaQuery, useTheme,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { expenseApi } from "@/api/expense";
import { EXPENSE_CATEGORIES } from "@/types/expense";
import type { Expense, ExpenseCategory } from "@/types/expense";
import { useT } from "@/i18n";
import { apiError } from "@/utils/format";
import { CategoryChip, catKey } from "./CategoryChip";

interface Props {
  open: boolean;
  onClose: () => void;
  expense?: Expense | null;
  buildings: { id: number; name: string }[];
  onDelete?: () => void;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function ExpenseFormDialog({ open, onClose, expense, buildings, onDelete }: Props) {
  const { t } = useT();
  const qc = useQueryClient();
  const phone = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [category, setCategory] = useState<ExpenseCategory>("MISC");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [buildingId, setBuildingId] = useState<number | "">("");

  useEffect(() => {
    if (!open) return;
    setCategory(expense?.category ?? "MISC");
    setAmount(expense ? String(expense.amount) : "");
    setDescription(expense?.description ?? "");
    setDate(expense ? expense.date.slice(0, 10) : today());
    setBuildingId(expense?.buildingId ?? "");
  }, [open, expense]);

  const save = useMutation({
    mutationFn: () => {
      const body = { category, amount: parseFloat(amount), description, date, buildingId: buildingId === "" ? null : buildingId };
      return expense ? expenseApi.update(expense.id, body) : expenseApi.create(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });
  useEffect(() => { if (open) save.reset(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = parseFloat(amount) > 0 && !!date;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={phone}>
      <form onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
        <DialogTitle>{expense ? t("exp.edit") : t("exp.add")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} sx={{ mt: 0.5 }}>
            {save.isError && <Alert severity="error">{apiError(save.error)}</Alert>}
            <Box>
              <Typography fontSize={14} fontWeight={600} sx={{ mb: 1 }}>{t("exp.whatFor")}</Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <CategoryChip key={c} c={c} label={t(catKey(c))} selected={category === c} onClick={() => setCategory(c)} />
                ))}
              </Stack>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={t("exp.amount")} type="number" required autoFocus value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputProps={{ min: 0, step: "0.01" }}
                InputProps={{ startAdornment: <InputAdornment position="start">৳</InputAdornment> }}
              />
              <TextField label={t("exp.date")} type="date" required InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
            </Stack>
            <TextField select label={t("exp.building")} value={buildingId}
              onChange={(e) => setBuildingId(e.target.value === "" ? "" : Number(e.target.value))}>
              <MenuItem value="">{t("exp.generalAll")}</MenuItem>
              {buildings.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </TextField>
            <TextField label={t("exp.note")} placeholder={t("exp.notePh")} multiline minRows={2} value={description}
              onChange={(e) => setDescription(e.target.value)} inputProps={{ maxLength: 500 }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {onDelete && <Button color="error" onClick={onDelete} sx={{ mr: "auto" }}>{t("exp.delete")}</Button>}
          <Button onClick={onClose}>{t("exp.cancel")}</Button>
          <Button type="submit" variant="contained" disabled={!valid || save.isPending}>
            {save.isPending ? t("exp.saving") : t("exp.save")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
