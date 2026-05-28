import { useEffect, useState, type FormEvent } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import { useOrganization, useUpdateOrganization } from "../queries/useOrganization";

export function Settings() {
  const organization = useOrganization();
  const update = useUpdateOrganization();
  const [name, setName] = useState("");
  const [requiredApprovals, setRequiredApprovals] = useState("1");

  // Seed the form once the org loads.
  useEffect(() => {
    if (organization.data) {
      setName(organization.data.name);
      setRequiredApprovals(String(organization.data.requiredApprovals));
    }
  }, [organization.data]);

  useEffect(() => {
    if (organization.isError) toast.error("Couldn't load organization settings");
  }, [organization.isError]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Number(requiredApprovals);
    if (!Number.isInteger(n) || n < 1) {
      toast.error("Required approvals must be a whole number of at least 1");
      return;
    }
    try {
      await update.mutateAsync({ name: name.trim(), requiredApprovals: n });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save settings");
    }
  }

  return (
    <Box>
      <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
        Organization settings
      </Typography>

      {organization.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Loading settings" />
        </Box>
      ) : (
        <Card variant="outlined" sx={{ maxWidth: 480 }}>
          <CardContent>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Organization name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="Approvals required per bill"
                  type="number"
                  value={requiredApprovals}
                  onChange={(e) => setRequiredApprovals(e.target.value)}
                  required
                  fullWidth
                  slotProps={{ htmlInput: { min: 1, max: 10, step: 1 } }}
                  helperText="How many distinct approvers must approve a bill before it's approved"
                />
                <Box>
                  <Button type="submit" variant="contained" disabled={update.isPending}>
                    {update.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </Box>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
