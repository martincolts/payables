import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import { toast } from "react-toastify";
import { paymentMethods, type PaymentMethod } from "@payables/shared";
import { useCreateVendor } from "../queries/useVendors";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ach: "ACH",
  wire: "Wire transfer",
  check: "Check",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Dialog form for creating a vendor (admin-only entry point). */
export function VendorFormDialog({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ach");
  const [bankLast4, setBankLast4] = useState("");
  const createVendor = useCreateVendor();

  function reset() {
    setName("");
    setEmail("");
    setPaymentMethod("ach");
    setBankLast4("");
  }

  function handleClose() {
    if (createVendor.isPending) return;
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createVendor.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        paymentMethod,
        bankLast4: bankLast4 ? bankLast4 : null,
      });
      toast.success("Vendor created");
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create vendor");
    }
  }

  const bankLast4Invalid = bankLast4 !== "" && !/^\d{4}$/.test(bankLast4);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit}>
        <DialogTitle>New vendor</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="payment-method-label">Payment method</InputLabel>
              <Select
                labelId="payment-method-label"
                label="Payment method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {paymentMethods.map((m) => (
                  <MenuItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Bank account (last 4)"
              value={bankLast4}
              onChange={(e) => setBankLast4(e.target.value)}
              error={bankLast4Invalid}
              helperText={bankLast4Invalid ? "Must be exactly 4 digits" : "Optional"}
              slotProps={{ htmlInput: { maxLength: 4, inputMode: "numeric" } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={createVendor.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={createVendor.isPending || bankLast4Invalid}
          >
            Create
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
