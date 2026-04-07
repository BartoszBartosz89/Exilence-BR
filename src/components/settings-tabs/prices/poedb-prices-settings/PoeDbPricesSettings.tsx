import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import SyncIcon from '@mui/icons-material/Sync';
import {
  Alert,
  Box,
  Button,
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
  const [search, setSearch] = React.useState('');
  const [showUnmapped, setShowUnmapped] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(50);

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

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="h6">PoEDB historical prices (compact mode)</Typography>
        <Typography variant="body2" color="textSecondary">
          Uses the same item universe as the normal Prices tab and keeps PoEDB data separate.
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            onClick={() => {
              poeDbPriceStore.syncMappingsFromPrices();
              setPage(0);
            }}
          >
            Sync items from Prices tab
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<LinkIcon />}
            disabled={poeDbPriceStore.resolving}
            onClick={() => {
              poeDbPriceStore.resolveLinksForAllItems();
              setPage(0);
            }}
          >
            Apply hardcoded links
          </Button>

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
              onChange={(e) => poeDbPriceStore.setSelectedDate((e.target.value as string) || undefined)}
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

      {poeDbPriceStore.resolving && (
        <Grid item xs={12}>
          <Typography variant="body2" gutterBottom>
            Applying links: {poeDbPriceStore.resolveProgress.done}/{poeDbPriceStore.resolveProgress.total}
            {' '}| matched {poeDbPriceStore.resolveProgress.resolved} | hardcoded entries {poeDbPriceStore.hardcodedLinksCount}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={
              poeDbPriceStore.resolveProgress.total > 0
                ? (poeDbPriceStore.resolveProgress.done / poeDbPriceStore.resolveProgress.total) * 100
                : 0
            }
          />
        </Grid>
      )}

      {poeDbPriceStore.pulling && (
        <Grid item xs={12}>
          <Typography variant="body2" gutterBottom>
            Pulling URLs: {poeDbPriceStore.pullProgress.done}/{poeDbPriceStore.pullProgress.total}
            {' '}| success {poeDbPriceStore.pullProgress.success}
            {' '}| skipped up-to-date {poeDbPriceStore.pullProgress.skipped}
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
            Showing {filteredRows.length} rows | Total rows {allRows.length} | Resolved rows {poeDbPriceStore.resolvedRowsCount} | Resolved URLs {poeDbPriceStore.resolvedUniqueUrlCount} | Dates {poeDbPriceStore.availableDates.length}
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
                  <TableCell align="right">{row.point?.open ?? '-'}</TableCell>
                  <TableCell align="right">{row.point?.close ?? '-'}</TableCell>
                  <TableCell align="right">{row.point?.low ?? '-'}</TableCell>
                  <TableCell align="right">{row.point?.high ?? '-'}</TableCell>
                  <TableCell align="right">{row.point?.rate ?? '-'}</TableCell>
                  <TableCell align="right">
                    {typeof row.point?.volume === 'number' ? row.point.volume.toLocaleString() : '-'}
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
  );
};

export default observer(PoeDbPricesSettings);

