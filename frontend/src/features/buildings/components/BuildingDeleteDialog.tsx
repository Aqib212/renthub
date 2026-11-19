import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";

interface BuildingDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  buildingName: string;
}

export const BuildingDeleteDialog = ({ open, onClose, onConfirm, buildingName }: BuildingDeleteDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Building</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete <strong>{buildingName}</strong>? This action cannot be undone and will also remove all floors, flats, and associated data.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <LoadingButton
          onClick={onConfirm}
          variant="contained"
          color="error"
          loading={false}
        >
          Delete
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
