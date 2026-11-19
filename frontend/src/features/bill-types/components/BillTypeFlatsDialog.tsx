import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableHead, TableBody, TableRow, TableCell,
  Checkbox, TextField, Typography, InputAdornment, TableContainer, CircularProgress, Box,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { billTypeApi } from "@/api/billType";
import type { BillType, FlatChargeRow } from "@/types/billType";
import { apiError, formatBDT } from "@/utils/format";

interface Props {
  billType: BillType;
  onClose: () => void;
  onSaved: () => void;
}

export const BillTypeFlatsDialog = ({ billType, onClose, onSaved }: Props) => {
  const { data, isLoading } = useQuery({ queryKey: ["bill-type-flats", billType.id], queryFn: () => billTypeApi.getFlats(billType.id) });
  const [rows, setRows] = useState<FlatChargeRow[]>([]);
  useEffect(() => { if (data) setRows(data); }, [data]);

  const save = useMutation({
    mutationFn: () => billTypeApi.setFlats(billType.id, rows.map(({ flatId, isActive, amount }) => ({ flatId, isActive, amount }))),
    onSuccess: () => { toast.success("Saved"); onSaved(); onClose(); },
    onError: (e) => toast.error(apiError(e)),
  });

  const patch = (flatId: number, change: Partial<FlatChargeRow>) =>
    setRows((rs) => rs.map((r) => (r.flatId === flatId ? { ...r, ...change } : r)));

  const allOn = rows.length > 0 && rows.every((r) => r.isActive);
  const showAmount = billType.calcMethod === "FIXED" || billType.calcMethod === "PER_PERSON";

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {billType.name}: which flats pay?
        <Typography variant="body2" color="text.secondary">
          {showAmount
            ? `Leave the amount empty to use the default (${formatBDT(billType.rate)}). Enter an amount to charge this flat differently.`
            : "Tick the flats this bill applies to."}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ py: 6, textAlign: "center" }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox checked={allOn} indeterminate={!allOn && rows.some((r) => r.isActive)}
                      onChange={(e) => setRows((rs) => rs.map((r) => ({ ...r, isActive: e.target.checked })))} />
                  </TableCell>
                  <TableCell>Flat</TableCell>
                  <TableCell>Tenant</TableCell>
                  {showAmount && <TableCell width={200}>Amount for this flat</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.flatId} hover>
                    <TableCell padding="checkbox">
                      <Checkbox checked={r.isActive} onChange={(e) => patch(r.flatId, { isActive: e.target.checked })} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.flatName}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.buildingName}</Typography>
                    </TableCell>
                    <TableCell>{r.tenantName || <Typography variant="caption" color="text.secondary">Vacant</Typography>}</TableCell>
                    {showAmount && (
                      <TableCell>
                        <TextField
                          size="small" type="number" disabled={!r.isActive} placeholder={String(billType.rate ?? "")}
                          value={r.amount ?? ""}
                          onChange={(e) => patch(r.flatId, { amount: e.target.value === "" ? null : Number(e.target.value) })}
                          InputProps={{ startAdornment: <InputAdornment position="start">৳</InputAdornment> }}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <LoadingButton variant="contained" loading={save.isPending} onClick={() => save.mutate()}>Save</LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
