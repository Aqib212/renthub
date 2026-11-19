import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";

interface FlatDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  flatName: string;
}

export const FlatDeleteDialog = ({ open, onClose, onConfirm, flatName }: FlatDeleteDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Flat</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete <strong>{flatName}</strong>? This will also remove all tenant and invoice data for this flat.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <LoadingButton onClick={onConfirm} variant="contained" color="error">
          Delete
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
