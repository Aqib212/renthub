import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box,
  Table, TableBody, TableCell, TableContainer, TableRow, Paper, Chip, CircularProgress,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { paymentApi } from "@/api/payment";
import { METHOD_LABELS, METHOD_COLORS } from "@/types/payment";
import { MONTH_NAMES } from "@/types/invoice";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#ff9800",
  PAID: "#4caf50",
  PARTIALLY_PAID: "#2196f3",
  OVERDUE: "#f44336",
};

interface Props {
  open: boolean;
  paymentId: number;
  onClose: () => void;
}

export function PaymentDetailDialog({ open, paymentId, onClose }: Props) {
  const { data: payment, isLoading } = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => paymentApi.getById(paymentId),
    enabled: open && !!paymentId,
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Payment Details</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : payment ? (
          <Box>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: 150 }}>Amount</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{payment.amount.toLocaleString()} BDT</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Method</TableCell>
                    <TableCell>
                      <Chip
                        label={METHOD_LABELS[payment.method]}
                        size="small"
                        sx={{ backgroundColor: METHOD_COLORS[payment.method], color: "#fff" }}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Transaction ID</TableCell>
                    <TableCell>{payment.transactionId || "—"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Collected By</TableCell>
                    <TableCell>{payment.collector || "—"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Remarks</TableCell>
                    <TableCell>{payment.remarks || "—"}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="subtitle2" gutterBottom>Linked Invoice</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: 150 }}>Period</TableCell>
                    <TableCell>{MONTH_NAMES[payment.invoice.month - 1]} {payment.invoice.year}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Flat</TableCell>
                    <TableCell>{payment.invoice.flat.name} ({payment.invoice.flat.flatNumber})</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Tenant</TableCell>
                    <TableCell>
                      {payment.invoice.tenant
                        ? `${payment.invoice.tenant.firstName} ${payment.invoice.tenant.lastName}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                    <TableCell>{payment.invoice.totalAmount.toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Paid</TableCell>
                    <TableCell>{payment.invoice.paidAmount.toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Due</TableCell>
                    <TableCell>{payment.invoice.dueAmount.toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell>
                      <Chip
                        label={payment.invoice.status.replace(/_/g, " ")}
                        size="small"
                        sx={{ backgroundColor: STATUS_COLORS[payment.invoice.status] || "#999", color: "#fff" }}
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
