import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
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
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { toast } from "react-toastify";
import type { ExtractedInvoice } from "@payables/shared";
import { useCreateBill, useExtractInvoice } from "../queries/useBills";
import { useVendors } from "../queries/useVendors";
import { formatMoney } from "../lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface LineItemDraft {
  description: string;
  amount: string;
  /** Set when pre-filled from a low-confidence extraction; cleared on edit. */
  lowConfidence?: boolean;
}

/** Which top-level fields the mock extractor returned with low confidence. */
interface LowConfidence {
  vendor?: boolean;
  invoiceNumber?: boolean;
  issueDate?: boolean;
  dueDate?: boolean;
}

/** Below this, an extracted field is flagged for the user to verify. */
const CONFIDENCE_THRESHOLD = 0.85;
const VERIFY_HELP = "Low confidence — please verify";

const emptyLineItem = (): LineItemDraft => ({ description: "", amount: "" });
const today = () => new Date().toISOString().slice(0, 10);
const isMoney = (s: string) => /^\d+(\.\d{1,2})?$/.test(s);

/**
 * Soft amber treatment for a low-confidence extracted field. This is an advisory
 * ("please verify"), not a validation error — so it uses a light warning border
 * and amber label/helper text rather than the bold error/focused red look.
 */
const warnSx = {
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "warning.light" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "warning.main" },
  "& .MuiInputLabel-root": { color: "warning.main" },
  "& .MuiFormHelperText-root": { color: "warning.main" },
} as const;

/** Dialog form for creating a bill with one or more line items (admin-only). */
export function BillFormDialog({ open, onClose }: Props) {
  const { data: vendors } = useVendors(1, 100);
  const createBill = useCreateBill();
  const extractInvoice = useExtractInvoice();

  const [vendorId, setVendorId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [lowConf, setLowConf] = useState<LowConfidence>({});

  function reset() {
    setVendorId("");
    setInvoiceNumber("");
    setIssueDate(today());
    setDueDate(today());
    setMemo("");
    setLineItems([emptyLineItem()]);
    setLowConf({});
  }

  function handleClose() {
    if (createBill.isPending || extractInvoice.isPending) return;
    reset();
    onClose();
  }

  function updateLineItem(index: number, patch: Partial<LineItemDraft>) {
    setLineItems((items) =>
      // Editing an item resolves any extraction warning on it.
      items.map((li, i) => (i === index ? { ...li, ...patch, lowConfidence: false } : li)),
    );
  }

  /** Pre-fills the form from a (mocked) extraction, flagging low-confidence fields. */
  function applyExtraction(r: ExtractedInvoice) {
    const low = (c: number) => c < CONFIDENCE_THRESHOLD;
    setInvoiceNumber(r.invoiceNumber.value);
    setIssueDate(r.issueDate.value);
    setDueDate(r.dueDate.value);
    setLineItems(
      r.lineItems.map((li) => ({
        description: li.description,
        amount: li.amount,
        lowConfidence: low(li.confidence),
      })),
    );

    // Resolve the extracted vendor name against the existing vendor list.
    const wanted = r.vendorName.value.trim().toLowerCase();
    const match = vendors?.items.find((v) => v.name.trim().toLowerCase() === wanted);
    if (match) {
      setVendorId(match.id);
      setLowConf({
        vendor: low(r.vendorName.confidence),
        invoiceNumber: low(r.invoiceNumber.confidence),
        issueDate: low(r.issueDate.confidence),
        dueDate: low(r.dueDate.confidence),
      });
    } else {
      setVendorId("");
      setLowConf({
        vendor: true,
        invoiceNumber: low(r.invoiceNumber.confidence),
        issueDate: low(r.issueDate.confidence),
        dueDate: low(r.dueDate.confidence),
      });
      toast.warning(`Couldn't match vendor "${r.vendorName.value}" — please select it`);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    try {
      const result = await extractInvoice.mutateAsync(file);
      applyExtraction(result);
      toast.success("Invoice fields extracted — review and submit");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read the invoice");
    }
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
            <Box>
              <Button
                component="label"
                variant="outlined"
                startIcon={
                  extractInvoice.isPending ? (
                    <CircularProgress size={16} />
                  ) : (
                    <UploadFileIcon />
                  )
                }
                disabled={extractInvoice.isPending || createBill.isPending}
              >
                {extractInvoice.isPending ? "Extracting…" : "Upload invoice (mocked)"}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  hidden
                  onChange={handleFileSelected}
                />
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Extraction is simulated — fields are pre-filled for you to review and edit.
              </Typography>
            </Box>

            <Divider />

            <FormControl fullWidth required sx={lowConf.vendor ? warnSx : undefined}>
              <InputLabel id="vendor-label">Vendor</InputLabel>
              <Select
                labelId="vendor-label"
                label="Vendor"
                value={vendorId}
                onChange={(e) => {
                  setVendorId(e.target.value);
                  setLowConf((f) => ({ ...f, vendor: false }));
                }}
              >
                {vendors?.items.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.name}
                  </MenuItem>
                ))}
              </Select>
              {lowConf.vendor && <FormHelperText>{VERIFY_HELP}</FormHelperText>}
            </FormControl>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Invoice number"
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setLowConf((f) => ({ ...f, invoiceNumber: false }));
                }}
                fullWidth
                sx={lowConf.invoiceNumber ? warnSx : undefined}
                helperText={lowConf.invoiceNumber ? VERIFY_HELP : undefined}
              />
              <TextField
                label="Issue date"
                type="date"
                value={issueDate}
                onChange={(e) => {
                  setIssueDate(e.target.value);
                  setLowConf((f) => ({ ...f, issueDate: false }));
                }}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                sx={lowConf.issueDate ? warnSx : undefined}
                helperText={lowConf.issueDate ? VERIFY_HELP : undefined}
              />
              <TextField
                label="Due date"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setLowConf((f) => ({ ...f, dueDate: false }));
                }}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                sx={lowConf.dueDate ? warnSx : undefined}
                helperText={lowConf.dueDate ? VERIFY_HELP : undefined}
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
                  sx={{ flexGrow: 1, ...(li.lowConfidence ? warnSx : {}) }}
                  size="small"
                  helperText={li.lowConfidence ? VERIFY_HELP : undefined}
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
