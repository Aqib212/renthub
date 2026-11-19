import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Stack, CircularProgress,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expenseApi } from "@/api/expense";
import { buildingApi } from "@/api/building";
import { CATEGORY_LABELS } from "@/types/expense";
import type { Expense, ExpenseCategory } from "@/types/expense";

interface Props {
  open: boolean;
  onClose: () => void;
  expense?: Expense | null;
}

export function ExpenseFormDialog({ open, onClose, expense }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!expense;
  const [category, setCategory] = useState<ExpenseCategory>("MISC");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [buildingId, setBuildingId] = useState<number | "">("");

  const { data: buildingsData } = useQuery({
    queryKey: ["buildings", { limit: 200 }],
    queryFn: async () => {
      const res = await buildingApi.getAll({ limit: 200 });
      return res.data.data || res.data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      if (expense) {
        setCategory(expense.category);
        setAmount(String(expense.amount));
        setDescription(expense.description || "");
        setDate(new Date(expense.date).toISOString().split("T")[0]);
        setBuildingId(expense.buildingId ?? "");
      } else {
        setCategory("MISC");
        setAmount("");
        setDescription("");
        setDate(new Date().toISOString().split("T")[0]);
        setBuildingId("");
      }
    }
  }, [open, expense]);

  const createMutation = useMutation({
    mutationFn: () => expenseApi.create({
      category, amount: parseFloat(amount), description: description || undefined, date, buildingId: typeof buildingId === "number" ? buildingId : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => expenseApi.update(expense!.id, {
      category, amount: parseFloat(amount), description, date, buildingId: typeof buildingId === "number" ? buildingId : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{isEdit ? "Edit Expense" : "Add Expense"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select label="Category" required fullWidth value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            >
              {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                <MenuItem key={c} value={c}>{CATEGORY_LABELS[c]}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Amount" type="number" required fullWidth
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputProps={{ min: 0, step: 0.01 }}
            />
            <TextField
              label="Date" type="date" required fullWidth
              InputLabelProps={{ shrink: true }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <TextField
              select label="Building" fullWidth value={buildingId}
              onChange={(e) => setBuildingId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <MenuItem value="">None (General)</MenuItem>
              {(buildingsData?.data || []).map((b: any) => (
                <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Description" fullWidth multiline rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit" variant="contained"
            disabled={isPending || !amount || parseFloat(amount) <= 0}
            startIcon={isPending ? <CircularProgress size={16} /> : undefined}
          >
            {isPending ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
