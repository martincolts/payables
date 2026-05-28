import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { toast } from "react-toastify";
import { useCreateBill } from "../queries/useBills";
import { useVendors } from "../queries/useVendors";
import { formatMoney } from "../lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface LineItemDraft {
  description: string;
  amount: string;
}

const emptyLineItem = (): LineItemDraft => ({ description: "", amount: "" });
const today = () => new Date().toISOString().slice(0, 10);
const isMoney = (s: string) => /^\d+(\.\d{1,2})?$/.test(s);

/** Dialog form for creating a bill with one or more line items (admin-only). */
export function BillFormDialog({ open, onClose }: Props) {
  const { data: vendors } = useVendors(1, 100);
  const createBill = useCreateBill();

  const [vendorId, setVendorId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([emptyLineItem()]);

  function reset() {
    setVendorId("");
    setInvoiceNumber("");
    setIssueDate(today());
    setDueDate(today());
    setMemo("");
    setLineItems([emptyLineItem()]);
  }

  function handleClose() {
    if (createBill.isPending) return;
    reset();
    onClose();
  }

  function updateLineItem(index: number, patch: Partial<LineItemDraft>) {
    setLineItems((items) => items.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  }

  const total = lineItems
    .reduce((sum, li) => sum + (isMoney(li.amount) ? Number(li.amount) : 0), 0)
    .toFixed(2);

  const lineItemsValid = lineItems.every(
    (li) => li.description.trim() !== "" && isMoney(li.amount),
  );
  const canSubmit = vendorId !== "" && lineItemsValid && !createBill.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await createBill.mutateAsync({
        vendorId,
        invoiceNumber: invoiceNumber.trim() || null,
        issueDate,
        dueDate,
        memo: memo.trim() || null,
        lineItems: lineItems.map((li) => ({
          description: li.description.trim(),
          amount: li.amount,
        })),
      });
      toast.success("Bill created");
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create bill");
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <form onSubmit={handleSubmit}>
        <DialogTitle>New bill</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel id="vendor-label">Vendor</InputLabel>
              <Select
                labelId="vendor-label"
                label="Vendor"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
              >
                {vendors?.items.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Invoice number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                fullWidth
              />
              <TextField
                label="Issue date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Due date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>

            <Divider />

            <Typography variant="subtitle2">Line items</Typography>
            {lineItems.map((li, i) => (
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "flex-start" }}
                key={i}
              >
                <TextField
                  label="Description"
                  value={li.description}
                  onChange={(e) => updateLineItem(i, { description: e.target.value })}
                  required
                  sx={{ flexGrow: 1 }}
                  size="small"
                />
                <TextField
                  label="Amount"
                  value={li.amount}
                  onChange={(e) => updateLineItem(i, { amount: e.target.value })}
                  required
                  error={li.amount !== "" && !isMoney(li.amount)}
                  size="small"
                  sx={{ width: 120 }}
                  slotProps={{ htmlInput: { inputMode: "decimal" } }}
                />
                <IconButton
                  aria-label={`Remove line item ${i + 1}`}
                  onClick={() =>
                    setLineItems((items) => items.filter((_, idx) => idx !== i))
                  }
                  disabled={lineItems.length === 1}
                  size="small"
                  sx={{ mt: 0.5 }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}

            <Box>
              <Button
                startIcon={<AddIcon />}
                onClick={() => setLineItems((items) => [...items, emptyLineItem()])}
                size="small"
              >
                Add line item
              </Button>
            </Box>

            <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
              <Typography variant="subtitle1">Total: {formatMoney(total)}</Typography>
            </Stack>

            <TextField
              label="Memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={createBill.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            Create
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
