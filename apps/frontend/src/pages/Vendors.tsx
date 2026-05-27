import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { toast } from "react-toastify";
import type { PaymentMethod, Vendor } from "@payables/shared";
import { useDeactivateVendor, useVendors } from "../queries/useVendors";
import { useAuth } from "../auth/AuthContext";
import { VendorFormDialog } from "../components/VendorFormDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ach: "ACH",
  wire: "Wire transfer",
  check: "Check",
};

export function Vendors() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading, isError } = useVendors();
  const deactivate = useDeactivateVendor();

  const [formOpen, setFormOpen] = useState(false);
  const [toRemove, setToRemove] = useState<Vendor | null>(null);

  useEffect(() => {
    if (isError) toast.error("Couldn't load vendors");
  }, [isError]);

  async function handleRemove() {
    if (!toRemove) return;
    try {
      await deactivate.mutateAsync(toRemove.id);
      toast.success(`${toRemove.name} removed`);
      setToRemove(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove vendor");
    }
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ mb: 2, justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h5" component="h1">
          Vendors
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
          >
            New vendor
          </Button>
        )}
      </Stack>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Loading vendors" />
        </Box>
      ) : data && data.items.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Payment method</TableCell>
                {isAdmin && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((v) => (
                <TableRow key={v.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {v.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{v.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={PAYMENT_METHOD_LABELS[v.paymentMethod]}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      <Tooltip title="Remove vendor">
                        <IconButton
                          aria-label={`Remove ${v.name}`}
                          size="small"
                          onClick={() => setToRemove(v)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography color="text.secondary">No vendors yet.</Typography>
      )}

      <VendorFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={toRemove !== null}
        title="Remove vendor"
        message={
          toRemove
            ? `Remove ${toRemove.name}? They'll be hidden from new bills, but existing bills keep their history.`
            : ""
        }
        confirmLabel="Remove"
        confirmColor="error"
        busy={deactivate.isPending}
        onConfirm={handleRemove}
        onClose={() => !deactivate.isPending && setToRemove(null)}
      />
    </Box>
  );
}
