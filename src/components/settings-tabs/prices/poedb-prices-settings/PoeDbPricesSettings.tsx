import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import GetAppIcon from '@mui/icons-material/GetApp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { useStores } from '../../../..';

const PoeDbPricesSettings = () => {
  const { uiStateStore, poeDbPriceStore } = useStores();
  const importInputRef = React.useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = React.useState('');
  const [showUnmapped, setShowUnmapped] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(50);
  const [setDialogOpen, setSetDialogOpen] = React.useState(false);
  const [setDialogMode, setSetDialogMode] = React.useState<
    'create-copy' | 'create-empty' | 'rename'
  >('create-copy');
  const [priceSetName, setPriceSetName] = React.useState('');
  const [deleteSetOpen, setDeleteSetOpen] = React.useState(false);

  if (!(uiStateStore.initiated && uiStateStore.validated)) {
    return <>Waiting for response from price source...</>;
  }

  const selectedDate = poeDbPriceStore.selectedDate || '';

  const allRows = poeDbPriceStore.compactRows;
  const filteredRows = allRows.filter((row) => {
    if (!showUnmapped && (!row.url || row.status !== 'resolved')) {
      return false;
    }

    if (!search.trim()) {
      return true;
    }

    return row.name.toLowerCase().includes(search.toLowerCase());
  });

  const pagedRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const openCreateSetDialog = () => {
    setPriceSetName(`${poeDbPriceStore.activePriceSetName} copy`);
    setSetDialogMode('create-copy');
    setSetDialogOpen(true);
  };

  const openCreateEmptySetDialog = () => {
    setPriceSetName(`PoEDB prices ${poeDbPriceStore.priceSets.length + 1}`);
    setSetDialogMode('create-empty');
    setSetDialogOpen(true);
  };

  const openRenameSetDialog = () => {
    setPriceSetName(poeDbPriceStore.activePriceSetName);
    setSetDialogMode('rename');
    setSetDialogOpen(true);
  };

  const handleSetDialogConfirm = () => {
    if (setDialogMode === 'create-copy') {
      poeDbPriceStore.createPriceSet(priceSetName, true);
    } else if (setDialogMode === 'create-empty') {
      poeDbPriceStore.createPriceSet(priceSetName, false);
    } else if (poeDbPriceStore.activePriceSetId) {
      poeDbPriceStore.renamePriceSet(poeDbPriceStore.activePriceSetId, priceSetName);
    }
    setSetDialogOpen(false);
  };

  const handleExportPriceSet = () => {
    const exported = poeDbPriceStore.buildActivePriceSetExport();
    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeName = exported.priceSet.name
      .trim()
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    anchor.href = url;
    anchor.download = `${safeName || 'poedb-price-set'}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportPriceSet = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    poeDbPriceStore.importPriceSetFromJson(await file.text());
    event.target.value = '';
    setPage(0);
  };

  return (
    <>
      <Dialog open={setDialogOpen} onClose={() => setSetDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {setDialogMode === 'rename' ? 'Rename price set' : 'Create price set'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label="Price set name"
            value={priceSetName}
            onChange={(event) => setPriceSetName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={priceSetName.trim() === ''}
            onClick={handleSetDialogConfirm}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteSetOpen} onClose={() => setDeleteSetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete price set</DialogTitle>
        <DialogContent>
          <Typography>
            Delete {poeDbPriceStore.activePriceSetName}? Imported/exported files will not be
            touched, but this local set will be removed from the app.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteSetOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={poeDbPriceStore.priceSets.length <= 1}
            onClick={() => {
              if (poeDbPriceStore.activePriceSetId) {
                poeDbPriceStore.deletePriceSet(poeDbPriceStore.activePriceSetId);
              }
              setDeleteSetOpen(false);
              setPage(0);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Typography variant="h6">PoEDB historical prices (compact mode)</Typography>
          <Typography variant="body2" color="textSecondary">
            Uses the same item universe as the normal Prices tab, ships with bundled PoEDB links,
            and keeps PoEDB data separate. Price sets let you export, import, and switch saved PoEDB
            history between installs or computers.
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
            <Box minWidth={260}>
              <Typography variant="caption" color="textSecondary">
                Active price set
              </Typography>
              <Select
                size="small"
                fullWidth
                value={poeDbPriceStore.activePriceSetId || ''}
                onChange={(event) => {
                  poeDbPriceStore.activatePriceSet(event.target.value as string);
                  setPage(0);
                }}
              >
                {poeDbPriceStore.priceSets.map((set) => (
                  <MenuItem key={set.uuid} value={set.uuid}>
                    {set.name}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Button variant="outlined" onClick={openCreateSetDialog}>
              New copy
            </Button>
            <Button variant="outlined" onClick={openCreateEmptySetDialog}>
              New empty
            </Button>
            <Button variant="outlined" onClick={openRenameSetDialog}>
              Rename
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<GetAppIcon />}
              onClick={handleExportPriceSet}
            >
              Export set
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<UploadFileIcon />}
              onClick={() => importInputRef.current?.click()}
            >
              Import set
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              disabled={poeDbPriceStore.priceSets.length <= 1}
              onClick={() => setDeleteSetOpen(true)}
            >
              Delete set
            </Button>
            <input
              ref={importInputRef}
              hidden
              type="file"
              accept=".json,application/json"
              onChange={handleImportPriceSet}
            />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
            <Button
              variant="contained"
              color="primary"
              startIcon={<CloudDownloadIcon />}
              disabled={poeDbPriceStore.pulling}
              onClick={() => poeDbPriceStore.pullHistoryForResolvedItems(false)}
            >
              Pull missing dates
            </Button>

            <Button
              variant="outlined"
              color="primary"
              disabled={poeDbPriceStore.pulling}
              onClick={() => poeDbPriceStore.pullHistoryForResolvedItems(true)}
            >
              Full refresh
            </Button>

            <Button
              variant="outlined"
              color="secondary"
              startIcon={<DeleteSweepIcon />}
              disabled={poeDbPriceStore.pulling}
              onClick={() => {
                poeDbPriceStore.clearStoredSnapshots();
                setPage(0);
              }}
            >
              Clear stored snapshots
            </Button>

            {(poeDbPriceStore.resolving || poeDbPriceStore.pulling) && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<StopCircleIcon />}
                onClick={() => {
                  poeDbPriceStore.stopResolve();
                  poeDbPriceStore.stopPull();
                }}
              >
                Stop
              </Button>
            )}

            <Box minWidth={220} ml="auto">
              <Typography variant="caption" color="textSecondary">
                Selected date
              </Typography>
              <Select
                size="small"
                fullWidth
                displayEmpty
                value={selectedDate}
                onChange={(e) =>
                  poeDbPriceStore.setSelectedDate((e.target.value as string) || undefined)
                }
              >
                <MenuItem value="">Latest available</MenuItem>
                {poeDbPriceStore.availableDates.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          </Box>
        </Grid>

        {poeDbPriceStore.pulling && (
          <Grid item xs={12}>
            <Typography variant="body2" gutterBottom>
              Pulling URLs: {poeDbPriceStore.pullProgress.done}/{poeDbPriceStore.pullProgress.total}{' '}
              | success {poeDbPriceStore.pullProgress.success} | skipped up-to-date{' '}
              {poeDbPriceStore.pullProgress.skipped}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={
                poeDbPriceStore.pullProgress.total > 0
                  ? (poeDbPriceStore.pullProgress.done / poeDbPriceStore.pullProgress.total) * 100
                  : 0
              }
            />
          </Grid>
        )}

        {!!poeDbPriceStore.error && (
          <Grid item xs={12}>
            <Alert severity="error">{poeDbPriceStore.error}</Alert>
          </Grid>
        )}

        {!!poeDbPriceStore.importExportMessage && (
          <Grid item xs={12}>
            <Alert severity="success">{poeDbPriceStore.importExportMessage}</Alert>
          </Grid>
        )}

        <Grid item xs={12}>
          <Box display="flex" flexWrap="wrap" gap={2} alignItems="center" mb={1}>
            <TextField
              size="small"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search items..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={showUnmapped}
                  onChange={(e) => {
                    setShowUnmapped(e.target.checked);
                    setPage(0);
                  }}
                  color="primary"
                />
              }
              label="Show unmapped"
            />

            <Typography variant="body2" color="textSecondary">
              Showing {filteredRows.length} rows | Total rows {allRows.length} | Resolved rows{' '}
              {poeDbPriceStore.resolvedRowsCount} | Resolved URLs{' '}
              {poeDbPriceStore.resolvedUniqueUrlCount} | Dates{' '}
              {poeDbPriceStore.availableDates.length}
            </Typography>
          </Box>

          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Icon</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>PoEDB</TableCell>
                  <TableCell>Actions</TableCell>
                  <TableCell align="right">Open</TableCell>
                  <TableCell align="right">Close</TableCell>
                  <TableCell align="right">Low</TableCell>
                  <TableCell align="right">High</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Volume</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedRows.map((row) => (
                  <TableRow key={row.itemKey}>
                    <TableCell>
                      {row.icon ? (
                        <img src={row.icon} alt={row.name} style={{ width: 24, height: 24 }} />
                      ) : null}
                    </TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>
                      {row.url ? (
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<OpenInNewIcon />}
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </Button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {row.url ? (
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<RefreshIcon />}
                          disabled={poeDbPriceStore.pulling}
                          onClick={() => poeDbPriceStore.pullHistoryForUrl(row.url as string, true)}
                        >
                          Refresh
                        </Button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right">{row.point?.open ?? '-'}</TableCell>
                    <TableCell align="right">{row.point?.close ?? '-'}</TableCell>
                    <TableCell align="right">{row.point?.low ?? '-'}</TableCell>
                    <TableCell align="right">{row.point?.high ?? '-'}</TableCell>
                    <TableCell align="right">{row.point?.rate ?? '-'}</TableCell>
                    <TableCell align="right">
                      {typeof row.point?.volume === 'number'
                        ? row.point.volume.toLocaleString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          <TablePagination
            component="div"
            count={filteredRows.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </Grid>
      </Grid>
    </>
  );
};

export default observer(PoeDbPricesSettings);
