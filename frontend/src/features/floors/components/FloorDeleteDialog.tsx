import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";

interface FloorDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  floorName: string;
}

export const FloorDeleteDialog = ({ open, onClose, onConfirm, floorName }: FloorDeleteDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Floor</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete <strong>{floorName}</strong>? This will also remove all flats in this floor.
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
