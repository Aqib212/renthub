import { useState } from "react";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Chip, IconButton, TablePagination, TextField, MenuItem, Button,
  Stack, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import { Add, Edit, Delete } from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expenseApi } from "@/api/expense";
import { ExpenseFormDialog } from "./components/ExpenseFormDialog";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types/expense";
import type { Expense, ExpenseCategory, ExpenseQueryParams } from "@/types/expense";

import { PageHeader } from "@/components/ui/PageHeader";
export default function ExpenseListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [filters, setFilters] = useState<ExpenseQueryParams>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const queryParams: ExpenseQueryParams = {
    page: page + 1,
    limit: rowsPerPage,
    ...filters,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", queryParams],
    queryFn: () => expenseApi.list(queryParams),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => expenseApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteTarget(null);
    },
  });

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingExpense(null);
    setFormOpen(true);
  };

  return (
    <Box>
      <PageHeader
        title="Expenses"
        subtitle="Costs you pay for the building: lift, security, cleaning, repairs."
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={handleCreate}>
          Add Expense
          </Button>
        }
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TextField
            select label="Category" size="small" sx={{ minWidth: 170 }}
            value={filters.category ?? ""}
            onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value as ExpenseCategory || undefined }))}
          >
            <MenuItem value="">All</MenuItem>
            {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
              <MenuItem key={c} value={c}>{CATEGORY_LABELS[c]}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Date From" type="date" size="small" sx={{ minWidth: 160 }}
            InputLabelProps={{ shrink: true }}
            value={filters.dateFrom ?? ""}
            onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value || undefined }))}
          />
          <TextField
            label="Date To" type="date" size="small" sx={{ minWidth: 160 }}
            InputLabelProps={{ shrink: true }}
            value={filters.dateTo ?? ""}
            onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value || undefined }))}
          />
          <TextField
            label="Search" size="small" sx={{ minWidth: 200 }}
            value={filters.search ?? ""}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value || undefined }))}
            placeholder="Description..."
          />
          {(filters.category || filters.dateFrom || filters.dateTo || filters.search) && (
            <Button size="small" onClick={() => { setFilters({}); setPage(0); }}>Clear</Button>
          )}
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Building</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} align="center">Loading...</TableCell></TableRow>
            ) : !data?.data.length ? (
              <TableRow><TableCell colSpan={6} align="center">No expenses found</TableCell></TableRow>
            ) : data.data.map((expense) => (
              <TableRow key={expense.id} hover>
                <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Chip
                    label={CATEGORY_LABELS[expense.category]}
                    size="small"
                    sx={{ backgroundColor: CATEGORY_COLORS[expense.category], color: "#fff" }}
                  />
                </TableCell>
                <TableCell>{expense.description || "—"}</TableCell>
                <TableCell>{expense.buildingName || "—"}</TableCell>
                <TableCell align="right">{expense.amount.toLocaleString()}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleEdit(expense)}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(expense)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data?.meta?.total ?? 0}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </TableContainer>

      <ExpenseFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingExpense(null); }}
        expense={editingExpense}
      />

      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Delete {CATEGORY_LABELS[deleteTarget.category]} expense of {deleteTarget.amount.toLocaleString()} BDT?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => deleteMutation.mutate(deleteTarget.id)}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
