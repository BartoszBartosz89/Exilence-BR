import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import SaveIcon from '@mui/icons-material/Save';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import moment from 'moment';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { appName, useStores, visitor } from '../..';
import { rarityColors, secondary } from '../../assets/themes/exilence-theme';
import OverviewWidgetContent from '../../components/overview-widget-content/OverviewWidgetContent';
import Widget from '../../components/widget/Widget';
import { useLocalStorage } from '../../hooks/use-local-storage';
import ArchiveItemTable from './ArchiveItemTable';
import useStyles from './NetWorthArchives.styles';

type FileActionMode = 'create' | 'add';

const NetWorthArchives = () => {
  const { netWorthArchiveStore, settingStore, accountStore, signalrStore } = useStores();
  const classes = useStyles();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeArchive = netWorthArchiveStore!.activeArchive;
  const activeItems = netWorthArchiveStore!.activeArchiveItems;
  const totals = netWorthArchiveStore!.activeArchiveTotals;
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteArchiveId, setDeleteArchiveId] = useState<string | undefined>(undefined);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [fileActionMode, setFileActionMode] = useState<FileActionMode>('create');
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage(
    'netWorthArchive:sidebarCollapsed',
    false
  );
  const currentSourceLabel = signalrStore!.activeGroup
    ? signalrStore!.activeGroup.name || 'Group net worth'
    : accountStore!.getSelectedAccount.activeProfile?.name || 'Net worth';

  useEffect(() => {
    visitor!.pageview('/net-worth-archives', appName).send();
  }, []);

  useEffect(() => {
    setRenameValue(activeArchive?.name || '');
  }, [activeArchive?.uuid, activeArchive?.name]);

  const handleImportClick = () => {
    setFileActionMode('create');
    fileInputRef.current?.click();
  };

  const handleAddFileClick = () => {
    if (!activeArchive) {
      return;
    }
    setFileActionMode('add');
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    const loadedFiles = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        text: await file.text(),
        lastModified: file.lastModified,
      }))
    );

    if (fileActionMode === 'add' && activeArchive) {
      netWorthArchiveStore!.addArchiveFilesToArchive(activeArchive.uuid, loadedFiles);
    } else {
      netWorthArchiveStore!.importArchiveFiles(loadedFiles);
    }
    event.target.value = '';
  };

  const handleRenameArchive = () => {
    if (!activeArchive) {
      return;
    }
    setRenameValue(activeArchive.name);
    setRenameOpen(true);
  };

  const handleRenameConfirm = () => {
    if (activeArchive) {
      netWorthArchiveStore!.renameArchive(activeArchive.uuid, renameValue);
    }
    setRenameOpen(false);
  };

  const handleDeleteArchive = (archiveId?: string) => {
    if (!archiveId) {
      return;
    }
    netWorthArchiveStore!.deleteArchive(archiveId);
    setDeleteArchiveId(undefined);
  };

  const filteredArchives = useMemo(() => {
    const query = archiveSearch.trim().toLowerCase();
    if (!query) {
      return netWorthArchiveStore!.archives.slice();
    }

    return netWorthArchiveStore!.archives
      .slice()
      .filter((archive) => archive.name.toLowerCase().includes(query));
  }, [archiveSearch, netWorthArchiveStore!.archives.length, activeArchive?.uuid]);

  const activeArchiveItemCount = activeArchive
    ? netWorthArchiveStore!.getMergedArchiveItems(activeArchive).length
    : 0;
  const getArchiveItemCount = (archive: any) =>
    netWorthArchiveStore!.getMergedArchiveItems(archive).length;
  const getArchiveSourceCount = (archive: any) => archive.sources?.length || 0;
  const latestSource = activeArchive?.sources?.[activeArchive.sources?.length - 1];

  return (
    <>
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename archive</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label="Archive name"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRenameConfirm}
            variant="contained"
            disabled={renameValue.trim() === ''}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!deleteArchiveId}
        onClose={() => setDeleteArchiveId(undefined)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete archive</DialogTitle>
        <DialogContent>
          <Typography>Delete this archive? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteArchiveId(undefined)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => handleDeleteArchive(deleteArchiveId)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Box className={classes.root}>
        <Box className={classes.sidebarShell}>
          <Box
            className={clsx(classes.sidebar, {
              [classes.sidebarCollapsed]: sidebarCollapsed,
            })}
          >
            {!sidebarCollapsed && (
              <>
                <Box className={classes.sidebarHeader}>
                  <Typography variant="h6">Archives</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Save the current {currentSourceLabel} view or import one or more CSV exports
                    into a merged archive.
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search archives"
                    className={classes.archiveSearch}
                    value={archiveSearch}
                    onChange={(event) => setArchiveSearch(event.target.value)}
                  />
                </Box>
                <List dense disablePadding className={classes.sidebarList}>
                  {filteredArchives.map((archive) => (
                    <ListItemButton
                      key={archive.uuid}
                      selected={archive.uuid === activeArchive?.uuid}
                      onClick={() => netWorthArchiveStore!.setActiveArchive(archive.uuid)}
                      className={clsx(classes.archiveButton, {
                        [classes.archiveButtonSelected]: archive.uuid === activeArchive?.uuid,
                      })}
                    >
                      <Box className={classes.archiveButtonContent}>
                        <ListItemText
                          primary={archive.name}
                          secondary={
                            <Box className={classes.archiveMeta}>
                              <Typography variant="body2" color="text.secondary">
                                {getArchiveItemCount(archive)} items
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {moment(archive.createdAt).format('YYYY-MM-DD')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {moment(archive.createdAt).format('HH:mm')}
                              </Typography>
                            </Box>
                          }
                        />
                        <IconButton
                          size="small"
                          color="error"
                          className={classes.archiveDeleteButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteArchiveId(archive.uuid);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItemButton>
                  ))}
                  {filteredArchives.length === 0 && (
                    <Box px={2} py={1.5}>
                      <Typography variant="body2" color="text.secondary">
                        No archives match that search.
                      </Typography>
                    </Box>
                  )}
                </List>
              </>
            )}
          </Box>
          <Box className={classes.sidebarToggle}>
            <IconButton onClick={() => setSidebarCollapsed(!sidebarCollapsed)} size="large">
              {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Box>
        </Box>

        <Box className={classes.content}>
          <Box className={classes.contentInner}>
            <Stack direction="row" spacing={2} className={classes.actionRow}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => netWorthArchiveStore!.saveCurrentNetWorthArchive()}
              >
                New archive from snapshot
              </Button>
              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={handleImportClick}
              >
                New archive from file
              </Button>
              {!!activeArchive && (
                <>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={() =>
                      netWorthArchiveStore!.addCurrentSnapshotToArchive(activeArchive.uuid)
                    }
                  >
                    Add snapshot to archive
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<UploadFileIcon />}
                    onClick={handleAddFileClick}
                  >
                    Add file to archive
                  </Button>
                </>
              )}
              <input
                ref={fileInputRef}
                hidden
                multiple
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
              />
            </Stack>

            {!activeArchive ? (
              <Widget backgroundColor={secondary.main}>
                <Typography color="text.secondary">
                  No archive selected yet. Save the current net worth or import CSV files to start.
                </Typography>
              </Widget>
            ) : (
              <>
                <Box className={classes.archiveHeader}>
                  <Widget backgroundColor={secondary.main}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="h6">{activeArchive.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {getArchiveSourceCount(activeArchive)} sources • {activeArchiveItemCount}{' '}
                          merged items
                          {latestSource?.pricingModel
                            ? ` • Latest pricing: ${latestSource.pricingModel}`
                            : ''}
                          {latestSource?.poedbPricingDate
                            ? ` • PoEDB date ${latestSource.poedbPricingDate}`
                            : ''}
                          {latestSource?.sourceDate
                            ? ` • Latest source date ${latestSource.sourceDate}`
                            : ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Snapshot price is the saved or imported file price. Current app price is
                          what the app resolves now from your current pricing settings.
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button startIcon={<EditIcon />} onClick={handleRenameArchive}>
                          Rename
                        </Button>
                        <Button
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => setDeleteArchiveId(activeArchive.uuid)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Box>
                  </Widget>
                </Box>

                <Grid container spacing={2} className={classes.totalsRow}>
                  <Grid item xs={12} md={6}>
                    <Widget backgroundColor={secondary.main}>
                      <OverviewWidgetContent
                        value={totals?.snapshotTotal || 0}
                        title="Snapshot total"
                        valueColor={rarityColors.currency}
                        currency
                        currencyShort={settingStore!.activeCurrency.short}
                        icon={<MonetizationOnIcon fontSize="medium" />}
                        secondaryValue="Saved/imported prices"
                      />
                    </Widget>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Widget backgroundColor={secondary.main}>
                      <OverviewWidgetContent
                        value={totals?.liveTotal || 0}
                        title="Current app total"
                        valueColor={rarityColors.currency}
                        currency
                        currencyShort={settingStore!.activeCurrency.short}
                        icon={<MonetizationOnIcon fontSize="medium" />}
                        secondaryValue="Current pricing settings"
                      />
                    </Widget>
                  </Grid>
                </Grid>

                <ArchiveItemTable items={activeItems as any} />
              </>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default observer(NetWorthArchives);
