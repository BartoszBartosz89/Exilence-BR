import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import {
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Grid,
  Link,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useMemo } from 'react';
import { appName, useStores, visitor } from '../..';
import { rarityColors, secondary } from '../../assets/themes/exilence-theme';
import OverviewWidgetContent from '../../components/overview-widget-content/OverviewWidgetContent';
import Widget from '../../components/widget/Widget';
import { useLocalStorage } from '../../hooks/use-local-storage';
import { IPoeDbPriceHistoryRow } from '../../interfaces/poedb-price-history.interface';
import { formatItemGroupLabel } from '../../utils/item.utils';
import useStyles from './EconomyAnalysis.styles';

type EconomyRow = {
  name: string;
  icon?: string;
  url: string;
  group: string;
  groupLabel: string;
  selected: IPoeDbPriceHistoryRow;
  start: IPoeDbPriceHistoryRow;
  windowRows: IPoeDbPriceHistoryRow[];
  changePct: number;
  changeChaos: number;
  metric: InflationMetric;
  startMetric: number;
  selectedMetric: number;
  spreadPct: number;
  spreadChaos: number;
  avgVolume: number;
  volume: number;
  startVolume: number;
  healthFlags: MarketHealthFlag[];
  opportunityScore: number;
};

type MarketHealthFlag = {
  label: string;
  reason: string;
};

const dayOptions = [3, 7, 14, 30];
const metricOptions = [
  { value: 'rate', label: 'Rate' },
  { value: 'open', label: 'Open' },
  { value: 'close', label: 'Close' },
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
] as const;
type InflationMetric = (typeof metricOptions)[number]['value'];

const healthFilterOptions = [
  'OK',
  'Short history',
  'Thin market',
  'Tiny base',
  'Wide spread',
  'Suspicious spike',
  'Possibly noisy',
];

const EconomyAnalysis = () => {
  const { poeDbPriceStore, priceStore } = useStores();
  const classes = useStyles();
  const dates = poeDbPriceStore.availableDates;
  const latestDate = dates[dates.length - 1] || '';
  const [selectedDate, setSelectedDate] = useLocalStorage(
    'economyAnalysis:selectedDate',
    latestDate
  );
  const [windowDays, setWindowDays] = useLocalStorage('economyAnalysis:windowDays', 7);
  const [inflationMetric, setInflationMetric] = useLocalStorage(
    'economyAnalysis:inflationMetric',
    'rate'
  );
  const [minVolume, setMinVolume] = useLocalStorage('economyAnalysis:minVolume', 1000);
  const [minRate, setMinRate] = useLocalStorage('economyAnalysis:minRate', 1);
  const [hiddenGroups, setHiddenGroups] = useLocalStorage('economyAnalysis:hiddenGroups', []);
  const [visibleHealthFlags, setVisibleHealthFlags] = useLocalStorage(
    'economyAnalysis:visibleHealthFlags',
    healthFilterOptions
  );
  const effectiveSelectedDate = dates.includes(selectedDate) ? selectedDate : latestDate;

  useEffect(() => {
    visitor!.pageview('/economy-analysis', appName).send();
  }, []);

  const allRows = useMemo(() => {
    if (!effectiveSelectedDate) {
      return [];
    }

    const fallbackGroupByUrl = new Map<string, string>();
    poeDbPriceStore.sourceItems.forEach((item) => {
      const url = poeDbPriceStore.getMappedUrlForExternalPrice(item);
      if (!url || fallbackGroupByUrl.has(url)) {
        return;
      }
      fallbackGroupByUrl.set(
        url,
        priceStore.getResolvedGroupForItem({
          name: item.name,
          icon: item.icon,
          group: item.group,
          quality: item.quality ?? 0,
          links: item.links ?? 0,
          level: item.level ?? 0,
          corrupted: item.corrupted || false,
          frameType: item.frameType ?? 0,
          variant: item.variant || '',
          elder: item.elder || false,
          shaper: item.shaper || false,
          ilvl: item.ilvl ?? 0,
          tier: item.tier ?? 0,
        })
      );
    });

    const mappingByUrl = new Map<string, { name: string; icon?: string; url: string }>();
    poeDbPriceStore.mappings.forEach((mapping) => {
      if (!mapping.url || mapping.status !== 'resolved') {
        return;
      }
      if (!mappingByUrl.has(mapping.url)) {
        mappingByUrl.set(mapping.url, {
          name: mapping.name,
          icon: mapping.icon,
          url: mapping.url,
        });
      }
    });

    return Array.from(mappingByUrl.values())
      .map((mapping): EconomyRow | undefined => {
        const history = poeDbPriceStore.historyByUrlMap.get(mapping.url)?.history || [];
        const selected = findClosestPoint(history, effectiveSelectedDate);
        if (!selected || selected.date !== effectiveSelectedDate) {
          return undefined;
        }

        const selectedIndex = history.findIndex((point) => point.date === selected.date);
        const startIndex = Math.max(0, selectedIndex - Number(windowDays));
        const start = history[startIndex];
        const windowRows = history.slice(startIndex, selectedIndex + 1);

        const metric = inflationMetric as InflationMetric;
        const startMetric = getMetricValue(start, metric);
        const selectedMetric = getMetricValue(selected, metric);

        if (!start || start.date === selected.date || startMetric <= 0 || selectedMetric <= 0) {
          return undefined;
        }

        const avgVolume =
          windowRows.reduce((sum, point) => sum + safeNumber(point.volume), 0) /
          Math.max(1, windowRows.length);
        const spreadChaos = Math.max(0, selected.high - selected.low);
        const spreadPct = selected.low > 0 ? (spreadChaos / selected.low) * 100 : 0;

        const fallbackGroup = fallbackGroupByUrl.get(mapping.url);
        const group =
          inferEconomyGroupFromPoedbItem(mapping.name, mapping.url, fallbackGroup) ||
          fallbackGroup ||
          'Unknown';

        return {
          ...mapping,
          group,
          groupLabel: formatItemGroupLabel(group),
          selected,
          start,
          windowRows,
          changePct: ((selectedMetric - startMetric) / startMetric) * 100,
          changeChaos: selectedMetric - startMetric,
          metric,
          startMetric,
          selectedMetric,
          spreadPct,
          spreadChaos,
          avgVolume,
          volume: safeNumber(selected.volume),
          startVolume: safeNumber(start.volume),
          healthFlags: [],
          opportunityScore: 0,
        };
      })
      .filter((row): row is EconomyRow => !!row);
  }, [
    effectiveSelectedDate,
    poeDbPriceStore.mappings.length,
    poeDbPriceStore.urlHistories.length,
    poeDbPriceStore.sourceItems.length,
    priceStore.activePricesWithCustomValues?.length,
    inflationMetric,
    windowDays,
  ]);

  const groupOptions = useMemo(() => {
    const byGroup = new Map<string, { group: string; label: string; count: number }>();
    allRows.forEach((row) => {
      const existing = byGroup.get(row.group) || {
        group: row.group,
        label: row.groupLabel,
        count: 0,
      };
      existing.count += 1;
      byGroup.set(row.group, existing);
    });

    return Array.from(byGroup.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows]);

  const trendRows = useMemo(() => {
    const hidden = new Set<string>(hiddenGroups as string[]);
    const visibleHealth = new Set(visibleHealthFlags as string[]);

    return allRows.map((row) => enrichEconomyRow(row, Number(minRate), Number(minVolume))).filter((row) => {
      const passesVolume = row.startVolume >= Number(minVolume) && row.volume >= Number(minVolume);
      const passesRate =
        row.startMetric >= Number(minRate) && row.selectedMetric >= Number(minRate);
      return (
        passesVolume &&
        passesRate &&
        !hidden.has(row.group) &&
        passesHealthFilter(row, visibleHealth)
      );
    });
  }, [allRows, hiddenGroups, minRate, minVolume, visibleHealthFlags]);

  const selectedDayRows = useMemo(() => {
    const hidden = new Set<string>(hiddenGroups as string[]);
    const visibleHealth = new Set(visibleHealthFlags as string[]);

    return allRows.map((row) => enrichEconomyRow(row, Number(minRate), Number(minVolume))).filter((row) => {
      const passesVolume = row.volume >= Number(minVolume);
      const passesRate = row.selectedMetric >= Number(minRate);
      return (
        passesVolume &&
        passesRate &&
        !hidden.has(row.group) &&
        passesHealthFilter(row, visibleHealth)
      );
    });
  }, [allRows, hiddenGroups, minRate, minVolume, visibleHealthFlags]);

  const toggleGroup = (group: string) => {
    const current = new Set(hiddenGroups as string[]);
    if (current.has(group)) {
      current.delete(group);
    } else {
      current.add(group);
    }
    setHiddenGroups(Array.from(current));
  };

  const toggleHealthFlag = (flag: string) => {
    const current = new Set(visibleHealthFlags as string[]);
    if (current.has(flag)) {
      current.delete(flag);
    } else {
      current.add(flag);
    }
    setVisibleHealthFlags(Array.from(current));
  };

  const inflationRows = useMemo(
    () =>
      trendRows
        .filter((row) => row.changePct > 0)
        .slice()
        .sort((a, b) => b.changePct - a.changePct)
        .slice(0, 10),
    [trendRows]
  );

  const opportunityRows = useMemo(
    () =>
      trendRows
        .filter((row) => row.changePct > 0)
        .slice()
        .sort((a, b) => b.opportunityScore - a.opportunityScore)
        .slice(0, 10),
    [trendRows]
  );

  const deflationRows = useMemo(
    () =>
      trendRows
        .filter((row) => row.changePct < 0)
        .slice()
        .sort((a, b) => a.changePct - b.changePct)
        .slice(0, 10),
    [trendRows]
  );

  const spreadRows = useMemo(
    () =>
      selectedDayRows
        .filter((row) => row.spreadPct > 0)
        .slice()
        .sort((a, b) => b.spreadPct - a.spreadPct)
        .slice(0, 10),
    [selectedDayRows]
  );

  const trackedPoedbItems = poeDbPriceStore.urlHistories.filter(
    (entry) => entry.history.length > 0
  ).length;
  const avgInflation =
    trendRows.reduce((sum, row) => sum + row.changePct, 0) / Math.max(1, trendRows.length);
  const bestInflation = inflationRows[0];
  const bestSpread = spreadRows[0];

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Typography variant="h5">Economy analysis</Typography>
        <Typography variant="body2" color="text.secondary" className={classes.intro}>
          Uses only items with pulled PoEDB history. Volume filtering is intentionally visible:
          noisy low-volume items can show huge moves, but they are usually bad flipping or investing
          signals.
        </Typography>
      </Box>

      <Grid container spacing={2} className={classes.controls}>
        <Grid item xs={12} md={3}>
          <TextField
            select
            fullWidth
            label="Selected day"
            value={effectiveSelectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          >
            {dates.map((date) => (
              <MenuItem key={date} value={date}>
                {date}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            select
            fullWidth
            label="Inflation window"
            value={Number(windowDays)}
            onChange={(event) => setWindowDays(Number(event.target.value))}
          >
            {dayOptions.map((days) => (
              <MenuItem key={days} value={days}>
                {days} days
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            select
            fullWidth
            label="Inflation metric"
            value={inflationMetric}
            onChange={(event) => setInflationMetric(event.target.value)}
            helperText="Used for inflation and deflation rankings"
          >
            {metricOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            type="number"
            label="Minimum volume"
            value={Number(minVolume)}
            onChange={(event) => setMinVolume(Math.max(0, Number(event.target.value || 0)))}
            helperText="Filters thin markets from rankings"
            inputProps={{ min: 0, step: 100 }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            type="number"
            label="Minimum rate"
            value={Number(minRate)}
            onChange={(event) => setMinRate(Math.max(0, Number(event.target.value || 0)))}
            helperText="Filters very cheap noisy markets"
            inputProps={{ min: 0, step: 0.1 }}
          />
        </Grid>
        <Grid item xs={12}>
          <Widget backgroundColor={secondary.main} height="auto">
            <Box mb={1}>
              <Typography variant="overline">Item groups</Typography>
              <Typography variant="body2" color="text.secondary">
                Hide groups that are noisy for the current analysis, for example divination cards.
              </Typography>
            </Box>
            <FormGroup row>
              {groupOptions.map((option) => (
                <FormControlLabel
                  key={option.group}
                  control={
                    <Checkbox
                      checked={!(hiddenGroups as string[]).includes(option.group)}
                      onChange={() => toggleGroup(option.group)}
                    />
                  }
                  label={`${option.label} (${option.count})`}
                />
              ))}
            </FormGroup>
          </Widget>
        </Grid>
        <Grid item xs={12}>
          <Widget backgroundColor={secondary.main} height="auto">
            <Box mb={1}>
              <Typography variant="overline">Market health</Typography>
              <Typography variant="body2" color="text.secondary">
                Select which data-quality statuses should appear in the rankings.
              </Typography>
            </Box>
            <FormGroup row>
              {healthFilterOptions.map((flag) => (
                <FormControlLabel
                  key={flag}
                  control={
                    <Checkbox
                      checked={(visibleHealthFlags as string[]).includes(flag)}
                      onChange={() => toggleHealthFlag(flag)}
                    />
                  }
                  label={flag}
                />
              ))}
            </FormGroup>
          </Widget>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Widget backgroundColor={secondary.main}>
            <OverviewWidgetContent
              value={trackedPoedbItems}
              title="PoEDB histories"
              valueColor={rarityColors.currency}
              icon={<SwapVertIcon fontSize="medium" />}
              secondaryValue={`${trendRows.length} trend rows pass filters`}
            />
          </Widget>
        </Grid>
        <Grid item xs={12} md={3}>
          <Widget backgroundColor={secondary.main}>
            <OverviewWidgetContent
              value={formatPercent(avgInflation)}
              title="Average inflation"
              valueColor={avgInflation >= 0 ? '#4caf50' : '#f44336'}
              icon={<TrendingUpIcon fontSize="medium" />}
              secondaryValue={`${windowDays} day window`}
            />
          </Widget>
        </Grid>
        <Grid item xs={12} md={3}>
          <Widget backgroundColor={secondary.main}>
            <OverviewWidgetContent
              value={formatPercent(bestInflation?.changePct || 0)}
              title="Top inflation"
              valueColor="#4caf50"
              icon={<TrendingUpIcon fontSize="medium" />}
              secondaryValue={bestInflation?.name || 'No signal'}
            />
          </Widget>
        </Grid>
        <Grid item xs={12} md={3}>
          <Widget backgroundColor={secondary.main}>
            <OverviewWidgetContent
              value={formatPercent(bestSpread?.spreadPct || 0)}
              title="Best intraday spread"
              valueColor={rarityColors.currency}
              icon={<SwapVertIcon fontSize="medium" />}
              secondaryValue={bestSpread?.name || 'No signal'}
            />
          </Widget>
        </Grid>
      </Grid>

      <EconomyTable
        title={`Top 10 opportunity score (${windowDays}d)`}
        subtitle="Conservative watchlist: inflation helps, but liquidity, realistic price level, spread and health flags can change the ranking."
        rows={opportunityRows}
        mode="inflation"
        classes={classes}
      />

      <EconomyTable
        title={`Top 10 inflation candidates (${windowDays}d)`}
        subtitle={`Best for finding items that may preserve or grow wealth over time, using ${inflationMetric}.`}
        rows={inflationRows}
        mode="inflation"
        classes={classes}
      />

      <EconomyTable
        title={`Top 10 deflation / avoid holding (${windowDays}d)`}
        subtitle={`Useful for spotting items that are losing value by ${inflationMetric} and should usually be liquidated faster.`}
        rows={deflationRows}
        mode="inflation"
        classes={classes}
      />

      <EconomyTable
        title="Top 10 intraday spread watch"
        subtitle="Potential flipping scouts: high-low gap on the selected day, filtered by volume."
        rows={spreadRows}
        mode="spread"
        classes={classes}
      />
    </Box>
  );
};

type EconomyTableProps = {
  title: string;
  subtitle: string;
  rows: EconomyRow[];
  mode: 'inflation' | 'spread';
  classes: ReturnType<typeof useStyles>;
};

const EconomyTable = ({ title, subtitle, rows, mode, classes }: EconomyTableProps) => (
  <Box className={classes.tableWidget}>
    <Widget backgroundColor={secondary.main} height="auto">
      <Box mb={2}>
        <Typography variant="overline">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
      <TableContainer className={classes.tableContainer}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell>Group</TableCell>
              <TableCell align="right">Score</TableCell>
              <TableCell>Health</TableCell>
              <TableCell align="right">{mode === 'inflation' ? 'Selected (c)' : 'Rate (c)'}</TableCell>
              {mode === 'inflation' ? (
                <>
                  <TableCell align="right">Change</TableCell>
                  <TableCell align="right">Change (c)</TableCell>
                  <TableCell align="right">From</TableCell>
                  <TableCell align="right">Start volume</TableCell>
                </>
              ) : (
                <>
                  <TableCell align="right">Low (c)</TableCell>
                  <TableCell align="right">High (c)</TableCell>
                  <TableCell align="right">Spread</TableCell>
                </>
              )}
              <TableCell align="right">Selected volume</TableCell>
              <TableCell align="right">Avg window volume</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.url}-${mode}`}>
                <TableCell>
                  <Box className={classes.itemCell}>
                    {row.icon && <img src={row.icon} alt="" className={classes.itemIcon} />}
                    <Box minWidth={0}>
                      {row.url ? (
                        <Link
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          color="inherit"
                          underline="hover"
                        >
                          <Typography className={classes.itemName}>{row.name}</Typography>
                        </Link>
                      ) : (
                        <Typography className={classes.itemName}>{row.name}</Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {row.selected.date}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{row.groupLabel}</TableCell>
                <TableCell align="right">{formatNumber(row.opportunityScore)}</TableCell>
                <TableCell>
                  {row.healthFlags.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      OK
                    </Typography>
                  ) : (
                    row.healthFlags.map((flag) => (
                      <Typography
                        key={`${row.url}-${flag.label}`}
                        variant="caption"
                        display="block"
                        title={flag.reason}
                      >
                        {flag.label}
                      </Typography>
                    ))
                  )}
                </TableCell>
                <TableCell align="right">
                  {formatNumber(mode === 'inflation' ? row.selectedMetric : row.selected.rate)}
                </TableCell>
                {mode === 'inflation' ? (
                  <>
                    <TableCell
                      align="right"
                      className={row.changePct >= 0 ? classes.positive : classes.negative}
                    >
                      {formatPercent(row.changePct)}
                    </TableCell>
                    <TableCell align="right">{formatSignedNumber(row.changeChaos)}</TableCell>
                    <TableCell align="right">
                      {formatNumber(row.startMetric)} c
                      <Typography variant="caption" display="block" color="text.secondary">
                        {row.start.date}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{formatInteger(row.startVolume)}</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell align="right">{formatNumber(row.selected.low)}</TableCell>
                    <TableCell align="right">{formatNumber(row.selected.high)}</TableCell>
                    <TableCell align="right" className={classes.positive}>
                      {formatPercent(row.spreadPct)}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {formatNumber(row.spreadChaos)} c
                      </Typography>
                    </TableCell>
                  </>
                )}
                <TableCell align="right">{formatInteger(row.volume)}</TableCell>
                <TableCell align="right">{formatInteger(row.avgVolume)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={mode === 'inflation' ? 11 : 10}>
                  <Typography color="text.secondary">
                    No items match the selected date, window and volume filter.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Widget>
  </Box>
);

const findClosestPoint = (history: IPoeDbPriceHistoryRow[], date: string) => {
  return history.find((point) => point.date === date);
};

const getMetricValue = (row: IPoeDbPriceHistoryRow, metric: InflationMetric) => row[metric];

const enrichEconomyRow = (row: EconomyRow, minRate: number, minVolume: number): EconomyRow => {
  const healthFlags = getMarketHealthFlags(row, minRate, minVolume);
  return {
    ...row,
    healthFlags,
    opportunityScore: getOpportunityScore(row, healthFlags),
  };
};

const passesHealthFilter = (row: EconomyRow, visibleHealthFlags: Set<string>) => {
  if (visibleHealthFlags.size === 0) {
    return false;
  }
  if (row.healthFlags.length === 0) {
    return visibleHealthFlags.has('OK');
  }
  return row.healthFlags.some((flag) => visibleHealthFlags.has(flag.label));
};

const getMarketHealthFlags = (
  row: EconomyRow,
  minRate: number,
  minVolume: number
): MarketHealthFlag[] => {
  const flags: MarketHealthFlag[] = [];
  const previousMetrics = row.windowRows
    .filter((point) => point.date !== row.selected.date)
    .map((point) => getMetricValue(point, row.metric))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const medianPrevious = getMedian(previousMetrics);

  if (row.windowRows.length < 4) {
    flags.push({
      label: 'Short history',
      reason: `Only ${row.windowRows.length} history points are available in this window.`,
    });
  }

  if (row.startVolume < minVolume * 2 || row.volume < minVolume * 2) {
    flags.push({
      label: 'Thin market',
      reason: `Start or selected-day volume is close to the configured minimum volume.`,
    });
  }

  if (row.startMetric < minRate * 2) {
    flags.push({
      label: 'Tiny base',
      reason: `The starting price is close to the configured minimum rate, so percentage moves may be exaggerated.`,
    });
  }

  if (row.spreadPct >= 50) {
    flags.push({
      label: 'Wide spread',
      reason: `Selected-day high/low spread is ${formatPercent(row.spreadPct)}.`,
    });
  }

  if (medianPrevious > 0 && row.selectedMetric >= medianPrevious * 3) {
    flags.push({
      label: 'Suspicious spike',
      reason: `Selected value is at least 3x the previous-window median.`,
    });
  }

  if (row.changePct >= 200 && (row.startVolume < minVolume * 3 || row.startMetric < minRate * 3)) {
    flags.push({
      label: 'Possibly noisy',
      reason: `Large move combined with low-ish source liquidity or a small starting price.`,
    });
  }

  return flags;
};

const getOpportunityScore = (row: EconomyRow, healthFlags: MarketHealthFlag[]) => {
  const inflationComponent = clamp(row.changePct / 4, 0, 35);
  const volumeComponent = clamp(Math.log10(Math.max(row.avgVolume, 1)) * 5, 0, 20);
  const priceComponent = clamp(Math.log10(Math.max(row.selectedMetric, 1)) * 4, 0, 15);
  const spreadPenalty = clamp(row.spreadPct / 2, 0, 25);
  const healthPenalty = healthFlags.length * 8;

  return Math.max(
    0,
    +(inflationComponent + volumeComponent + priceComponent - spreadPenalty - healthPenalty).toFixed(
      2
    )
  );
};

const getMedian = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  const midpoint = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[midpoint - 1] + values[midpoint]) / 2
    : values[midpoint];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const inferEconomyGroupFromPoedbItem = (name: string, url: string, fallbackGroup?: string) => {
  const token = `${name} ${url}`.toLowerCase();

  if (/\b(?:amber|azure|black|clear|crimson|golden|indigo|opalescent|prismatic|reflective|sepia|silver|tainted|teal|verdant|violet)[-\s]oil\b/.test(token)) {
    return 'Oil';
  }
  if (token.includes('scarab')) {
    return 'Scarab';
  }
  if (token.includes('essence')) {
    return 'Essence';
  }
  if (token.includes('fossil') || token.includes('resonator')) {
    return 'Fossil';
  }
  if (token.includes('delirium-orb') || token.includes('delirium orb')) {
    return 'DeliriumOrb';
  }
  if (token.includes('incubator')) {
    return 'Incubator';
  }
  if (token.includes('tattoo')) {
    return 'Tattoo';
  }
  if (token.includes('allflame')) {
    return 'AllflameEmber';
  }
  if (token.includes('rune')) {
    return 'KalguuranRune';
  }
  if (token.includes('beast')) {
    return 'Beast';
  }
  if (token.includes('map-fragment') || token.includes('sacrifice') || token.includes('mortal-')) {
    return 'Fragment';
  }
  if (token.includes('blight-ravaged')) {
    return 'BlightRavagedMap';
  }
  if (token.includes('blighted-map') || token.includes('blighted map')) {
    return 'BlightedMap';
  }
  if (
    fallbackGroup === 'DivinationCard' ||
    token.includes('divination') ||
    token.includes('/divination/')
  ) {
    return 'DivinationCard';
  }
  if (token.includes('support') || token.includes('skill-gem')) {
    return 'SkillGem';
  }
  if (
    token.includes('orb') ||
    token.includes('scroll') ||
    token.includes('shard') ||
    token.includes('splinter') ||
    token.includes('catalyst') ||
    token.includes('stacked-deck')
  ) {
    return 'Currency';
  }

  return undefined;
};

const safeNumber = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const formatNumber = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatSignedNumber = (value: number) => `${value >= 0 ? '+' : ''}${formatNumber(value)}`;

const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${formatNumber(value)}%`;

const formatInteger = (value: number) =>
  Math.round(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

export default observer(EconomyAnalysis);
