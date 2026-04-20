import AddIcon from '@mui/icons-material/Add';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import Autocomplete from '@mui/material/Autocomplete';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import moment from 'moment';
import React, { useEffect, useMemo, useState } from 'react';
import { appName, useStores, visitor } from '../..';
import { secondary } from '../../assets/themes/exilence-theme';
import SnapshotHistoryChart from '../../components/snapshot-history-chart/SnapshotHistoryChart';
import Widget from '../../components/widget/Widget';
import { useLocalStorage } from '../../hooks/use-local-storage';
import { IExternalPrice } from '../../interfaces/external-price.interface';
import useStyles from './StrategyReviewer.styles';

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const buildCostSearchLabel = (option: IExternalPrice, label: string) =>
  normalizeSearchText(
    [
      label,
      option.name,
      option.variant || '',
      option.level ? `level ${option.level}` : '',
      option.quality ? `quality ${option.quality}` : '',
      option.links ? `${option.links} links` : '',
      option.tier ? `tier ${option.tier}` : '',
      option.corrupted ? 'corrupted' : '',
    ].join(' ')
  );

const StrategyReviewer = () => {
  const {
    strategyReviewerStore,
    netWorthArchiveStore,
    settingStore,
    poeDbPriceStore,
  } = useStores();
  const classes = useStyles();
  const theme = useTheme();
  const [pendingCosts, setPendingCosts] = useState<Record<string, IExternalPrice | null>>({});
  const [costSearchValues, setCostSearchValues] = useState<Record<string, string>>({});
  const [selectedPresetIds, setSelectedPresetIds] = useState<Record<string, string>>({});
  const [presetNames, setPresetNames] = useState<Record<string, string>>({});
  const [analysisSearch, setAnalysisSearch] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteAnalysisId, setDeleteAnalysisId] = useState<string | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage(
    'strategyReviewer:sidebarCollapsed',
    false
  );
  const [profitPerMapChartCollapsed, setProfitPerMapChartCollapsed] = useLocalStorage(
    'strategyReviewer:profitPerMapChartCollapsed',
    false
  );
  const [profitPerHourChartCollapsed, setProfitPerHourChartCollapsed] = useLocalStorage(
    'strategyReviewer:profitPerHourChartCollapsed',
    false
  );
  const [displayCurrency, setDisplayCurrency] = useLocalStorage(
    'strategyReviewer:displayCurrency',
    'chaos'
  ) as ['chaos' | 'divine', (value: 'chaos' | 'divine') => void];

  useEffect(() => {
    visitor!.pageview('/strategy-reviewer', appName).send();
  }, []);

  useEffect(() => {
    setRenameValue(strategyReviewerStore.activeAnalysis?.name || '');
  }, [strategyReviewerStore.activeAnalysis?.uuid, strategyReviewerStore.activeAnalysis?.name]);

  const refreshSignature = useMemo(() => {
    return JSON.stringify({
      pricingModel: settingStore.pricingModel,
      priceCount: strategyReviewerStore.availableCostItems.length,
      dates: poeDbPriceStore.availableDates,
      archives: netWorthArchiveStore.archives.map((archive) => ({
        uuid: archive.uuid,
        sources: (archive.sources || []).map((source) => source.uuid),
      })),
      analysisIds: strategyReviewerStore.analyses.map((analysis) => analysis.uuid),
    });
  }, [
    settingStore.pricingModel,
    strategyReviewerStore.availableCostItems.length,
    poeDbPriceStore.availableDates.join('|'),
    netWorthArchiveStore.archives.length,
    netWorthArchiveStore.archives.map((archive) => archive.uuid).join('|'),
    strategyReviewerStore.analyses.map((analysis) => analysis.uuid).join('|'),
  ]);

  useEffect(() => {
    void strategyReviewerStore.refreshAllStrategies();
  }, [refreshSignature]);

  const currencyShort = displayCurrency === 'divine' ? 'div' : 'c';

  const buildChartSeries = (valueSelector: (point: any) => number) =>
    strategyReviewerStore.filteredStrategies
      .filter((strategy) => strategy.filteredPoints.length > 0)
      .map((strategy) => ({
        seriesName: strategy.name,
        series: strategy.filteredPoints.map((point) => [
          new Date(point.date).getTime(),
          +convertStrategyValue(valueSelector(point), displayCurrency, point.divinePrice).toFixed(2),
        ]),
      }));

  const profitPerMapChartSeries = buildChartSeries((point) =>
    typeof point.profitPerMap === 'number'
      ? point.profitPerMap
      : point.profitValue / Math.max(1, point.mapCount || 1)
  );

  const profitPerHourChartSeries = buildChartSeries((point) =>
    typeof point.profitPerHour === 'number'
      ? point.profitPerHour
      : ((typeof point.profitPerMap === 'number'
          ? point.profitPerMap
          : point.profitValue / Math.max(1, point.mapCount || 1)) *
          60) /
        Math.max(0.1, point.clearTimeMinutes || 3)
  );

  const filteredCostOptionsByStrategy = useMemo(() => {
    return (strategyReviewerStore.activeAnalysis?.strategies || []).reduce<
      Record<string, IExternalPrice[]>
    >((result, strategy) => {
      const query = normalizeSearchText(costSearchValues[strategy.uuid] || '');
      const queryTokens = query ? query.split(' ').filter(Boolean) : [];

      if (queryTokens.length === 0) {
        result[strategy.uuid] = strategyReviewerStore.availableCostItems.slice(0, 100);
        return result;
      }

      const matches = strategyReviewerStore.availableCostItems
        .map((option) => {
          const label = strategyReviewerStore.getCostItemLabel(option);
          const haystack = buildCostSearchLabel(option, label);
          const matchedAllTokens = queryTokens.every((token) => haystack.includes(token));

          if (!matchedAllTokens) {
            return undefined;
          }

          const startsWithWholeQuery = haystack.startsWith(query);
          const startsWithFirstToken = haystack.startsWith(queryTokens[0]);

          return {
            option,
            rank: startsWithWholeQuery ? 0 : startsWithFirstToken ? 1 : 2,
            label,
          };
        })
        .filter(
          (
            entry
          ): entry is { option: IExternalPrice; rank: number; label: string } => !!entry
        )
        .sort((a, b) => {
          if (a.rank !== b.rank) {
            return a.rank - b.rank;
          }

          return a.label.localeCompare(b.label);
        })
        .slice(0, 100)
        .map((entry) => entry.option);

      result[strategy.uuid] = matches;
      return result;
    }, {});
  }, [
    costSearchValues,
    strategyReviewerStore.activeAnalysis?.strategies,
    strategyReviewerStore.availableCostItems,
  ]);

  const filteredAnalyses = useMemo(() => {
    const query = analysisSearch.trim().toLowerCase();
    if (!query) {
      return strategyReviewerStore.analyses.slice();
    }

    return strategyReviewerStore.analyses
      .slice()
      .filter((analysis) => analysis.name.toLowerCase().includes(query));
  }, [analysisSearch, strategyReviewerStore.analyses]);

  const activeAnalysis = strategyReviewerStore.activeAnalysis;
  const summaryRowsById = useMemo(
    () =>
      strategyReviewerStore.summaryRows.reduce<Record<string, (typeof strategyReviewerStore.summaryRows)[number]>>(
        (result, row) => {
          result[row.uuid] = row;
          return result;
        },
        {}
      ),
    [strategyReviewerStore.summaryRows]
  );

  const handleRenameAnalysis = () => {
    if (!activeAnalysis) {
      return;
    }
    setRenameValue(activeAnalysis.name);
    setRenameOpen(true);
  };

  const handleRenameConfirm = () => {
    if (activeAnalysis) {
      strategyReviewerStore.renameAnalysis(activeAnalysis.uuid, renameValue);
    }
    setRenameOpen(false);
  };

  const handleDeleteAnalysis = (analysisId?: string) => {
    if (!analysisId) {
      return;
    }
    strategyReviewerStore.deleteAnalysis(analysisId);
    setDeleteAnalysisId(undefined);
  };

  return (
    <>
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename analysis</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label="Analysis name"
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
        open={!!deleteAnalysisId}
        onClose={() => setDeleteAnalysisId(undefined)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete analysis</DialogTitle>
        <DialogContent>
          <Typography>Delete this analysis? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAnalysisId(undefined)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => handleDeleteAnalysis(deleteAnalysisId)}
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
                  <Typography variant="h6">Analyses</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Build separate strategy analyses, compare multiple strategy lines inside each
                    one, and keep the workflow isolated just like archives.
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search analyses"
                    className={classes.analysisSearch}
                    value={analysisSearch}
                    onChange={(event) => setAnalysisSearch(event.target.value)}
                  />
                </Box>
                <List dense disablePadding className={classes.sidebarList}>
                  {filteredAnalyses.map((analysis) => (
                    <ListItemButton
                      key={analysis.uuid}
                      selected={analysis.uuid === activeAnalysis?.uuid}
                      onClick={() => strategyReviewerStore.setActiveAnalysis(analysis.uuid)}
                      className={clsx(classes.analysisButton, {
                        [classes.analysisButtonSelected]: analysis.uuid === activeAnalysis?.uuid,
                      })}
                    >
                      <Box className={classes.analysisButtonContent}>
                        <ListItemText
                          primary={analysis.name}
                          secondary={
                            <Box className={classes.analysisMeta}>
                              <Typography variant="body2" color="text.secondary">
                                {analysis.strategies.length} strategies
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {moment(analysis.createdAt).format('YYYY-MM-DD')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {moment(analysis.createdAt).format('HH:mm')}
                              </Typography>
                            </Box>
                          }
                        />
                        <IconButton
                          size="small"
                          color="error"
                          className={classes.analysisDeleteButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteAnalysisId(analysis.uuid);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItemButton>
                  ))}
                  {filteredAnalyses.length === 0 && (
                    <Box px={2} py={1.5}>
                      <Typography variant="body2" color="text.secondary">
                        No analyses match that search.
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
                startIcon={<AddIcon />}
                onClick={() => strategyReviewerStore.addAnalysis()}
              >
                New analysis
              </Button>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={() => strategyReviewerStore.refreshAllStrategies()}
                disabled={strategyReviewerStore.recalculating}
              >
                Refresh calculations
              </Button>
            </Stack>

            {!activeAnalysis ? (
              <Widget backgroundColor={secondary.main}>
                <Typography color="text.secondary">
                  No analysis selected yet. Create one to start comparing strategies.
                </Typography>
              </Widget>
            ) : (
              <>
                <Box className={classes.analysisHeader}>
                  <Widget backgroundColor={secondary.main}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="h6">{activeAnalysis.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {activeAnalysis.strategies.length} strategies
                          {strategyReviewerStore.effectiveRangeStartDate
                            ? ` • From ${strategyReviewerStore.effectiveRangeStartDate}`
                            : ''}
                          {strategyReviewerStore.effectiveRangeEndDate
                            ? ` • To ${strategyReviewerStore.effectiveRangeEndDate}`
                            : ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Strategy reviewer uses your current pricing model. Historical series are
                          built from PoEDB dates when available and fall back to the normal live
                          price path when a PoEDB price is missing.
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button startIcon={<EditIcon />} onClick={handleRenameAnalysis}>
                          Rename
                        </Button>
                        <Button
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => setDeleteAnalysisId(activeAnalysis.uuid)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Box>
                  </Widget>
                </Box>

                <Grid container spacing={2} className={classes.actionRow}>
                  <Grid item xs={12} md={6}>
                    <Widget backgroundColor={secondary.main}>
                      <Typography variant="body2" color="text.secondary">
                        Compare multiple archive-plus-cost setups on one chart. Each strategy keeps
                        its own archive, costs, and cached historical profit series.
                      </Typography>
                    </Widget>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      select
                      fullWidth
                      label="From"
                      value={strategyReviewerStore.effectiveRangeStartDate || ''}
                      onChange={(event) =>
                        strategyReviewerStore.setRangeStartDate(event.target.value || undefined)
                      }
                      disabled={strategyReviewerStore.availableRangeDates.length === 0}
                    >
                      {strategyReviewerStore.availableRangeDates.map((date) => (
                        <MenuItem key={date} value={date}>
                          {date}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      select
                      fullWidth
                      label="To"
                      value={strategyReviewerStore.effectiveRangeEndDate || ''}
                      onChange={(event) =>
                        strategyReviewerStore.setRangeEndDate(event.target.value || undefined)
                      }
                      disabled={strategyReviewerStore.availableRangeDates.length === 0}
                    >
                      {strategyReviewerStore.availableRangeDates.map((date) => (
                        <MenuItem key={date} value={date}>
                          {date}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => strategyReviewerStore.resetRangeDates()}
                      disabled={strategyReviewerStore.availableRangeDates.length === 0}
                    >
                      Full range
                    </Button>
                  </Grid>
                </Grid>

                <Box className={classes.addStrategyRow}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => strategyReviewerStore.addStrategy()}
                  >
                    Add strategy
                  </Button>
                  <FormControlLabel
                    className={classes.currencyToggle}
                    control={
                      <Switch
                        checked={displayCurrency === 'divine'}
                        onChange={(event) =>
                          setDisplayCurrency(event.target.checked ? 'divine' : 'chaos')
                        }
                      />
                    }
                    label={`Display ${displayCurrency === 'divine' ? 'divine' : 'chaos'}`}
                  />
                </Box>

                <Widget
                  backgroundColor={theme.palette.secondary.main}
                  height={profitPerMapChartCollapsed ? 72 : 560}
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={profitPerMapChartCollapsed ? 0 : 2}
                  >
                    <Box display="flex" alignItems="center">
                      <AutoGraphIcon fontSize="small" />
                      <Box ml={1}>
                        <Typography variant="overline">
                          Strategy profit / map chart ({currencyShort})
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton
                      onClick={() => setProfitPerMapChartCollapsed(!profitPerMapChartCollapsed)}
                      size="large"
                    >
                      {profitPerMapChartCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                    </IconButton>
                  </Box>
                  {!profitPerMapChartCollapsed && (
                    <>
                      {profitPerMapChartSeries.length > 0 ? (
                        <Box className={classes.chartContainer}>
                          <SnapshotHistoryChart
                            width={0}
                            height={0}
                            playerData={profitPerMapChartSeries}
                            showSeriesLegend
                            twoColumnLegend
                          />
                        </Box>
                      ) : (
                        <Typography color="text.secondary">
                          Add a strategy and choose an archive to start plotting profit over time.
                        </Typography>
                      )}
                    </>
                  )}
                </Widget>

                <Widget
                  backgroundColor={theme.palette.secondary.main}
                  height={profitPerHourChartCollapsed ? 72 : 460}
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={profitPerHourChartCollapsed ? 0 : 2}
                  >
                    <Box display="flex" alignItems="center">
                      <AutoGraphIcon fontSize="small" />
                      <Box ml={1}>
                        <Typography variant="overline">
                          Strategy profit / hour chart ({currencyShort})
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton
                      onClick={() =>
                        setProfitPerHourChartCollapsed(!profitPerHourChartCollapsed)
                      }
                      size="large"
                    >
                      {profitPerHourChartCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                    </IconButton>
                  </Box>
                  {!profitPerHourChartCollapsed && (
                    <>
                      {profitPerHourChartSeries.length > 0 ? (
                        <Box className={classes.chartContainer}>
                          <SnapshotHistoryChart
                            width={0}
                            height={0}
                            playerData={profitPerHourChartSeries}
                            showSeriesLegend
                            twoColumnLegend
                          />
                        </Box>
                      ) : (
                        <Typography color="text.secondary">
                          Add clear time to strategies to compare profit per hour.
                        </Typography>
                      )}
                    </>
                  )}
                </Widget>

                {strategyReviewerStore.summaryRows.length > 0 && (
                  <Widget backgroundColor={theme.palette.secondary.main} height="auto">
                    <TableContainer className={classes.summaryTable}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Strategy</TableCell>
                            <TableCell>Archive</TableCell>
                            <TableCell align="right">
                              Gross / map ({currencyShort})
                            </TableCell>
                            <TableCell align="right">
                              Costs / map ({currencyShort})
                            </TableCell>
                            <TableCell align="right">
                              Profit / map ({currencyShort})
                            </TableCell>
                            <TableCell align="right">
                              Profit / h ({currencyShort})
                            </TableCell>
                            <TableCell align="right">Maps</TableCell>
                            <TableCell align="right">Min / map</TableCell>
                            <TableCell align="right">Points</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {strategyReviewerStore.summaryRows.map((row) => (
                            <TableRow key={row.uuid}>
                              <TableCell>{row.name}</TableCell>
                              <TableCell>{row.archiveName}</TableCell>
                              <TableCell align="right">
                                {formatNumberForDisplay(
                                  convertToSelectedCurrency(
                                    row.grossPerMap,
                                    displayCurrency,
                                    row.averageDivinePrice
                                  )
                                )}
                              </TableCell>
                              <TableCell align="right">
                                {formatNumberForDisplay(
                                  convertToSelectedCurrency(
                                    row.costPerMap,
                                    displayCurrency,
                                    row.averageDivinePrice
                                  )
                                )}
                              </TableCell>
                              <TableCell align="right">
                                {formatNumberForDisplay(
                                  convertToSelectedCurrency(
                                    row.profitPerMap,
                                    displayCurrency,
                                    row.averageDivinePrice
                                  )
                                )}
                              </TableCell>
                              <TableCell align="right">
                                {formatNumberForDisplay(
                                  convertToSelectedCurrency(
                                    row.profitPerHour,
                                    displayCurrency,
                                    row.averageDivinePrice
                                  )
                                )}
                              </TableCell>
                              <TableCell align="right">{row.mapCount}</TableCell>
                              <TableCell align="right">
                                {formatNumberForDisplay(row.clearTimeMinutes)}
                              </TableCell>
                              <TableCell align="right">{row.pointCount}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Widget>
                )}

                <Box className={classes.strategyCardList}>
                  {activeAnalysis.strategies.map((strategy) => (
                    <Widget
                      key={strategy.uuid}
                      backgroundColor={theme.palette.secondary.main}
                      height="auto"
                    >
                      <Box className={classes.strategyCard}>
                        <Box className={classes.strategyHeader}>
                          <IconButton
                            onClick={() =>
                              strategyReviewerStore.toggleStrategyCollapsed(strategy.uuid)
                            }
                            size="large"
                          >
                            {strategy.collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                          </IconButton>

                          <Box className={classes.strategyHeaderBlock}>
                            <Typography
                              variant="overline"
                              color="text.secondary"
                              className={classes.strategyHeaderLabel}
                            >
                              Strategy
                            </Typography>
                            <Typography
                              variant="h6"
                              className={classes.strategyHeaderValue}
                            >
                              {strategy.name}
                            </Typography>
                          </Box>

                          <Box className={classes.strategyHeaderBlock}>
                            <Typography
                              variant="overline"
                              color="text.secondary"
                              className={classes.strategyHeaderLabel}
                            >
                              Archive
                            </Typography>
                            <Typography
                              variant="body1"
                              className={classes.strategyHeaderValue}
                            >
                              {netWorthArchiveStore.archives.find(
                                (archive) => archive.uuid === strategy.archiveId
                              )?.name || 'No archive'}
                            </Typography>
                          </Box>

                          <Box className={classes.strategyHeaderBlock}>
                            <Typography
                              variant="overline"
                              color="text.secondary"
                              className={classes.strategyHeaderLabel}
                            >
                              Costs
                            </Typography>
                            <Box className={classes.strategyIcons}>
                              <Box className={classes.strategyIconStack}>
                                {strategy.costItems.slice(0, 5).map((cost) => (
                                  <img
                                    key={cost.uuid}
                                    src={cost.icon}
                                    alt={cost.name}
                                    className={classes.strategyIconTiny}
                                  />
                                ))}
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                {strategy.costItems.length === 0
                                  ? 'No costs'
                                  : `${strategy.costItems.length} item${
                                      strategy.costItems.length === 1 ? '' : 's'
                                    }`}
                              </Typography>
                            </Box>
                          </Box>

                          <Box className={classes.strategyHeaderActions}>
                            <Box>
                              <Typography variant="overline" color="text.secondary">
                                Profit / map
                              </Typography>
                              <Typography variant="body1">
                                {formatNumberForDisplay(
                                  convertToSelectedCurrency(
                                    summaryRowsById[strategy.uuid]?.profitPerMap || 0,
                                    displayCurrency,
                                    summaryRowsById[strategy.uuid]?.averageDivinePrice
                                  )
                                )}{' '}
                                {currencyShort}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="overline" color="text.secondary">
                                Profit / h
                              </Typography>
                              <Typography variant="body1">
                                {formatNumberForDisplay(
                                  convertToSelectedCurrency(
                                    summaryRowsById[strategy.uuid]?.profitPerHour || 0,
                                    displayCurrency,
                                    summaryRowsById[strategy.uuid]?.averageDivinePrice
                                  )
                                )}{' '}
                                {currencyShort}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="overline" color="text.secondary">
                                Maps
                              </Typography>
                              <Typography variant="body1">
                                {strategyReviewerStore.getEffectiveMapCount(strategy)}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="overline" color="text.secondary">
                                Min / map
                              </Typography>
                              <Typography variant="body1">
                                {formatNumberForDisplay(
                                  strategyReviewerStore.getEffectiveClearTimeMinutes(strategy)
                                )}
                              </Typography>
                            </Box>
                            <Button
                              color="error"
                              variant="contained"
                              startIcon={<DeleteIcon />}
                              onClick={() => strategyReviewerStore.removeStrategy(strategy.uuid)}
                            >
                              Remove
                            </Button>
                          </Box>
                        </Box>

                        {!strategy.collapsed && (
                          <Box className={classes.strategyExpanded}>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={4}>
                                <TextField
                                  fullWidth
                                  label="Strategy name"
                                  value={strategy.name}
                                  onChange={(event) =>
                                    strategyReviewerStore.renameStrategy(
                                      strategy.uuid,
                                      event.target.value
                                    )
                                  }
                                />
                              </Grid>
                              <Grid item xs={12} md={2}>
                                <TextField
                                  select
                                  fullWidth
                                  label="Archive"
                                  value={strategy.archiveId || ''}
                                  onChange={(event) =>
                                    strategyReviewerStore.setArchiveForStrategy(
                                      strategy.uuid,
                                      event.target.value || undefined
                                    )
                                  }
                                >
                                  {netWorthArchiveStore.archives.map((archive) => (
                                    <MenuItem key={archive.uuid} value={archive.uuid}>
                                      {archive.name}
                                    </MenuItem>
                                  ))}
                                </TextField>
                              </Grid>
                              <Grid item xs={12} md={2}>
                                <TextField
                                  fullWidth
                                  type="number"
                                  label="Maps"
                                  value={strategy.mapCountOverride || ''}
                                  onChange={(event) =>
                                    strategyReviewerStore.setStrategyMapCountOverride(
                                      strategy.uuid,
                                      event.target.value === ''
                                        ? undefined
                                        : Number(event.target.value)
                                    )
                                  }
                                  inputProps={{ min: 1, step: 1 }}
                                  helperText={`Archive: ${
                                    netWorthArchiveStore.archives.find(
                                      (archive) => archive.uuid === strategy.archiveId
                                    )?.mapCount || 1
                                  }`}
                                />
                              </Grid>
                              <Grid item xs={12} md={2}>
                                <TextField
                                  fullWidth
                                  type="number"
                                  label="Min / map"
                                  value={strategy.clearTimeMinutes || 3}
                                  onChange={(event) =>
                                    strategyReviewerStore.setStrategyClearTimeMinutes(
                                      strategy.uuid,
                                      Number(event.target.value || 0)
                                    )
                                  }
                                  inputProps={{ min: 0.1, step: 0.1 }}
                                  helperText="Clear time"
                                />
                              </Grid>
                              <Grid item xs={12} md={2}>
                                <Button
                                  color="error"
                                  variant="contained"
                                  startIcon={<DeleteIcon />}
                                  fullWidth
                                  onClick={() => strategyReviewerStore.removeStrategy(strategy.uuid)}
                                >
                                  Remove strategy
                                </Button>
                              </Grid>

                              <Grid item xs={12} md={9}>
                                <Autocomplete
                                  value={pendingCosts[strategy.uuid] || null}
                                  inputValue={costSearchValues[strategy.uuid] || ''}
                                  options={filteredCostOptionsByStrategy[strategy.uuid] || []}
                                  filterOptions={(options) => options}
                                  getOptionLabel={(option) =>
                                    strategyReviewerStore.getCostItemLabel(option)
                                  }
                                  isOptionEqualToValue={(option, value) =>
                                    strategyReviewerStore.getCostItemLabel(option) ===
                                    strategyReviewerStore.getCostItemLabel(value)
                                  }
                                  onInputChange={(_, value) =>
                                    setCostSearchValues((current) => ({
                                      ...current,
                                      [strategy.uuid]: value,
                                    }))
                                  }
                                  onChange={(_, value) =>
                                    setPendingCosts((current) => ({
                                      ...current,
                                      [strategy.uuid]: value,
                                    }))
                                  }
                                  renderOption={(props, option) => (
                                    <li {...props}>
                                      <Box display="flex" alignItems="center">
                                        <img
                                          src={option.icon}
                                          alt={option.name}
                                          className={classes.itemIcon}
                                        />
                                        <Box ml={1}>
                                          {strategyReviewerStore.getCostItemLabel(option)}
                                        </Box>
                                      </Box>
                                    </li>
                                  )}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label="Add cost item"
                                      placeholder="Type to search item name"
                                    />
                                  )}
                                />
                              </Grid>
                              <Grid item xs={12} md={3}>
                                <Button
                                  variant="contained"
                                  startIcon={<AddIcon />}
                                  fullWidth
                                  disabled={
                                    !pendingCosts[strategy.uuid] ||
                                    strategy.costItems.length >= 20
                                  }
                                  onClick={() => {
                                    const next = pendingCosts[strategy.uuid];
                                    if (next) {
                                      strategyReviewerStore.addCostItem(strategy.uuid, next);
                                      setPendingCosts((current) => ({
                                        ...current,
                                        [strategy.uuid]: null,
                                      }));
                                      setCostSearchValues((current) => ({
                                        ...current,
                                        [strategy.uuid]: '',
                                      }));
                                    }
                                  }}
                                >
                                  Add cost
                                </Button>
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <TextField
                                  select
                                  fullWidth
                                  label="Apply cost preset"
                                  value={selectedPresetIds[strategy.uuid] || ''}
                                  onChange={(event) =>
                                    setSelectedPresetIds((current) => ({
                                      ...current,
                                      [strategy.uuid]: event.target.value,
                                    }))
                                  }
                                  helperText="Reusable cost setups"
                                >
                                  <MenuItem value="">No preset selected</MenuItem>
                                  {strategyReviewerStore.presets.map((preset) => (
                                    <MenuItem key={preset.uuid} value={preset.uuid}>
                                      {preset.name} ({preset.costItems.length})
                                    </MenuItem>
                                  ))}
                                </TextField>
                              </Grid>
                              <Grid item xs={12} md={2}>
                                <Button
                                  variant="contained"
                                  fullWidth
                                  disabled={!selectedPresetIds[strategy.uuid]}
                                  onClick={() =>
                                    strategyReviewerStore.applyPresetToStrategy(
                                      strategy.uuid,
                                      selectedPresetIds[strategy.uuid]
                                    )
                                  }
                                >
                                  Apply preset
                                </Button>
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <TextField
                                  fullWidth
                                  label="Preset name"
                                  value={presetNames[strategy.uuid] || `${strategy.name} costs`}
                                  onChange={(event) =>
                                    setPresetNames((current) => ({
                                      ...current,
                                      [strategy.uuid]: event.target.value,
                                    }))
                                  }
                                  helperText="Saved from current costs"
                                />
                              </Grid>
                              <Grid item xs={12} md={2}>
                                <Button
                                  variant="outlined"
                                  fullWidth
                                  disabled={strategy.costItems.length === 0}
                                  onClick={() =>
                                    strategyReviewerStore.savePresetFromStrategy(
                                      strategy.uuid,
                                      presetNames[strategy.uuid] || `${strategy.name} costs`
                                    )
                                  }
                                >
                                  Save preset
                                </Button>
                              </Grid>
                              {strategyReviewerStore.presets.length > 0 && (
                                <Grid item xs={12}>
                                  <Stack direction="row" spacing={1} flexWrap="wrap">
                                    {strategyReviewerStore.presets.map((preset) => (
                                      <Button
                                        key={preset.uuid}
                                        size="small"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => strategyReviewerStore.deletePreset(preset.uuid)}
                                      >
                                        {preset.name}
                                      </Button>
                                    ))}
                                  </Stack>
                                </Grid>
                              )}
                            </Grid>

                            <Typography
                              variant="body2"
                              color="text.secondary"
                              className={classes.helperText}
                            >
                              Up to 20 cost items per strategy. Costs are repriced for each
                              historical date, multiplied by the map count, and deducted from
                              archive value to produce profit per map and profit per hour.
                            </Typography>

                            {strategy.costItems.map((cost) => (
                              <Box key={cost.uuid} className={classes.costRow}>
                                <img src={cost.icon} alt={cost.name} className={classes.itemIcon} />
                                <Typography>{cost.name}</Typography>
                                <TextField
                                  type="number"
                                  size="small"
                                  label="Qty"
                                  value={cost.quantity}
                                  onChange={(event) =>
                                    strategyReviewerStore.updateCostQuantity(
                                      strategy.uuid,
                                      cost.uuid,
                                      Number(event.target.value || 0)
                                    )
                                  }
                                  inputProps={{ min: 0, step: 1 }}
                                />
                                <IconButton
                                  color="error"
                                  onClick={() =>
                                    strategyReviewerStore.removeCostItem(strategy.uuid, cost.uuid)
                                  }
                                  size="large"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Widget>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
};

const convertToSelectedCurrency = (
  value: number,
  currency: 'chaos' | 'divine',
  divinePrice?: number
) => {
  if (currency === 'divine' && divinePrice) {
    return value / divinePrice;
  }
  return value;
};

const convertStrategyValue = (
  value: number,
  currency: 'chaos' | 'divine',
  divinePrice?: number
) => convertToSelectedCurrency(value, currency, divinePrice);

const formatNumberForDisplay = (value: number) => {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default observer(StrategyReviewer);
