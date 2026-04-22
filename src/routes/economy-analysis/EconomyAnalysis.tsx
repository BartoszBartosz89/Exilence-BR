import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Link,
  ListItemText,
  MenuItem,
  Popover,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useMemo, useState } from 'react';
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
type InflationMetric = typeof metricOptions[number]['value'];

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
  const [maxVolume, setMaxVolume] = useLocalStorage('economyAnalysis:maxVolume', '');
  const [maxRate, setMaxRate] = useLocalStorage('economyAnalysis:maxRate', '');
  const [minChangePct, setMinChangePct] = useLocalStorage('economyAnalysis:minChangePct', '');
  const [maxChangePct, setMaxChangePct] = useLocalStorage('economyAnalysis:maxChangePct', '');
  const [minSpreadPct, setMinSpreadPct] = useLocalStorage('economyAnalysis:minSpreadPct', '');
  const [maxSpreadPct, setMaxSpreadPct] = useLocalStorage('economyAnalysis:maxSpreadPct', '');
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
    const numericFilters = getGlobalNumericFilters({
      minPrice: minRate,
      maxPrice: maxRate,
      minVolume,
      maxVolume,
      minChangePct,
      maxChangePct,
      minSpreadPct,
      maxSpreadPct,
    });

    return allRows
      .map((row) => enrichEconomyRow(row, Number(minRate), Number(minVolume)))
      .filter((row) => {
        const passesVolume =
          row.startVolume >= numericFilters.minVolume &&
          row.volume >= numericFilters.minVolume &&
          passesOptionalMax(row.volume, numericFilters.maxVolume);
        const passesRate =
          row.startMetric >= numericFilters.minPrice &&
          row.selectedMetric >= numericFilters.minPrice &&
          passesOptionalMax(row.selectedMetric, numericFilters.maxPrice);
        return (
          passesVolume &&
          passesRate &&
          passesRange(row.changePct, numericFilters.minChangePct, numericFilters.maxChangePct) &&
          passesRange(row.spreadPct, numericFilters.minSpreadPct, numericFilters.maxSpreadPct) &&
          !hidden.has(row.group) &&
          passesHealthFilter(row, visibleHealth)
        );
      });
  }, [
    allRows,
    hiddenGroups,
    maxChangePct,
    maxRate,
    maxSpreadPct,
    maxVolume,
    minChangePct,
    minRate,
    minSpreadPct,
    minVolume,
    visibleHealthFlags,
  ]);

  const selectedDayRows = useMemo(() => {
    const hidden = new Set<string>(hiddenGroups as string[]);
    const visibleHealth = new Set(visibleHealthFlags as string[]);
    const numericFilters = getGlobalNumericFilters({
      minPrice: minRate,
      maxPrice: maxRate,
      minVolume,
      maxVolume,
      minChangePct,
      maxChangePct,
      minSpreadPct,
      maxSpreadPct,
    });

    return allRows
      .map((row) => enrichEconomyRow(row, Number(minRate), Number(minVolume)))
      .filter((row) => {
        const passesVolume =
          row.volume >= numericFilters.minVolume &&
          passesOptionalMax(row.volume, numericFilters.maxVolume);
        const passesRate =
          row.selectedMetric >= numericFilters.minPrice &&
          passesOptionalMax(row.selectedMetric, numericFilters.maxPrice);
        return (
          passesVolume &&
          passesRate &&
          passesRange(row.changePct, numericFilters.minChangePct, numericFilters.maxChangePct) &&
          passesRange(row.spreadPct, numericFilters.minSpreadPct, numericFilters.maxSpreadPct) &&
          !hidden.has(row.group) &&
          passesHealthFilter(row, visibleHealth)
        );
      });
  }, [
    allRows,
    hiddenGroups,
    maxChangePct,
    maxRate,
    maxSpreadPct,
    maxVolume,
    minChangePct,
    minRate,
    minSpreadPct,
    minVolume,
    visibleHealthFlags,
  ]);

  const visibleGroups = useMemo(
    () =>
      groupOptions
        .filter((option) => !(hiddenGroups as string[]).includes(option.group))
        .map((option) => option.group),
    [groupOptions, hiddenGroups]
  );
  const [groupFilterOpen, setGroupFilterOpen] = useState(false);
  const [draftVisibleGroups, setDraftVisibleGroups] = useState<string[]>(visibleGroups);
  const [healthFilterOpen, setHealthFilterOpen] = useState(false);
  const [draftVisibleHealthFlags, setDraftVisibleHealthFlags] = useState<string[]>(
    visibleHealthFlags as string[]
  );

  useEffect(() => {
    if (!groupFilterOpen) {
      setDraftVisibleGroups(visibleGroups);
    }
  }, [groupFilterOpen, visibleGroups]);

  useEffect(() => {
    if (!healthFilterOpen) {
      setDraftVisibleHealthFlags(visibleHealthFlags as string[]);
    }
  }, [healthFilterOpen, visibleHealthFlags]);

  const commitVisibleGroups = (selectedGroups: string[]) => {
    const hidden = groupOptions
      .map((option) => option.group)
      .filter((group) => !selectedGroups.includes(group));
    setHiddenGroups(hidden);
  };

  const commitVisibleHealthFlags = (selectedHealthFlags: string[]) => {
    setVisibleHealthFlags(selectedHealthFlags);
  };

  const inflationRows = useMemo(() => trendRows.filter((row) => row.changePct > 0).slice(), [
    trendRows,
  ]);

  const opportunityRows = useMemo(() => trendRows.filter((row) => row.changePct > 0).slice(), [
    trendRows,
  ]);

  const deflationRows = useMemo(() => trendRows.filter((row) => row.changePct < 0).slice(), [
    trendRows,
  ]);

  const spreadRows = useMemo(() => selectedDayRows.filter((row) => row.spreadPct > 0).slice(), [
    selectedDayRows,
  ]);

  const trackedPoedbItems = poeDbPriceStore.urlHistories.filter((entry) => entry.history.length > 0)
    .length;
  const avgInflation =
    trendRows.reduce((sum, row) => sum + row.changePct, 0) / Math.max(1, trendRows.length);
  const bestInflation = inflationRows.slice().sort((a, b) => b.changePct - a.changePct)[0];
  const bestSpread = spreadRows.slice().sort((a, b) => b.spreadPct - a.spreadPct)[0];
  const activeFilterSummary = getActiveFilterSummary({
    visibleGroups,
    totalGroups: groupOptions.length,
    visibleHealthFlags: visibleHealthFlags as string[],
    minVolume,
    maxVolume,
    minRate,
    maxRate,
    minChangePct,
    maxChangePct,
    minSpreadPct,
    maxSpreadPct,
  });

  const resetFilters = () => {
    setMinVolume(1000);
    setMaxVolume('');
    setMinRate(1);
    setMaxRate('');
    setMinChangePct('');
    setMaxChangePct('');
    setMinSpreadPct('');
    setMaxSpreadPct('');
    setHiddenGroups([]);
    setVisibleHealthFlags(healthFilterOptions);
  };

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

      <CollapsibleSection
        title="Filters"
        subtitle="Control the source date, trend window, liquidity guardrails and visible item groups."
        summary={activeFilterSummary}
        storageKey="economyAnalysis:filtersCollapsed"
        classes={classes}
        actions={
          <Button size="small" color="secondary" onClick={resetFilters}>
            Reset filters
          </Button>
        }
      >
        <Grid container spacing={2} className={classes.controls}>
          <Grid item xs={12}>
            <Typography variant="overline" color="text.secondary">
              Time and trend
            </Typography>
          </Grid>
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

          <Grid item xs={12}>
            <Divider />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="overline" color="text.secondary">
              Liquidity and price guardrails
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Min volume"
              value={Number(minVolume)}
              onChange={(event) => setMinVolume(Math.max(0, Number(event.target.value || 0)))}
              helperText="Trend views require start and selected volume"
              inputProps={{ min: 0, step: 100 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Max volume"
              value={maxVolume}
              onChange={(event) => setMaxVolume(event.target.value)}
              helperText="Optional selected-day cap"
              inputProps={{ min: 0, step: 100 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Min price (c)"
              value={Number(minRate)}
              onChange={(event) => setMinRate(Math.max(0, Number(event.target.value || 0)))}
              helperText="Filters very cheap noisy markets"
              inputProps={{ min: 0, step: 0.1 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Max price (c)"
              value={maxRate}
              onChange={(event) => setMaxRate(event.target.value)}
              helperText="Optional selected-day cap"
              inputProps={{ min: 0, step: 0.1 }}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="overline" color="text.secondary">
              Signal boundaries
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Min change %"
              value={minChangePct}
              onChange={(event) => setMinChangePct(event.target.value)}
              helperText="Example: 0 for positive moves"
              inputProps={{ step: 1 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Max change %"
              value={maxChangePct}
              onChange={(event) => setMaxChangePct(event.target.value)}
              helperText="Optional inflation cap"
              inputProps={{ step: 1 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Min spread %"
              value={minSpreadPct}
              onChange={(event) => setMinSpreadPct(event.target.value)}
              helperText="For flipping candidates"
              inputProps={{ min: 0, step: 1 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Max spread %"
              value={maxSpreadPct}
              onChange={(event) => setMaxSpreadPct(event.target.value)}
              helperText="Example: 20 for tighter markets"
              inputProps={{ min: 0, step: 1 }}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="overline" color="text.secondary">
              Dataset filters
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label="Item groups"
              value={groupFilterOpen ? draftVisibleGroups : visibleGroups}
              onChange={(event) => {
                const selectedGroups = normalizeMultiSelectValue(event.target.value);
                if (selectedGroups.includes('__all')) {
                  setDraftVisibleGroups(groupOptions.map((option) => option.group));
                  return;
                }
                if (selectedGroups.includes('__none')) {
                  setDraftVisibleGroups([]);
                  return;
                }
                setDraftVisibleGroups(selectedGroups);
              }}
              helperText="Controls which item families feed all economy tables"
              SelectProps={{
                multiple: true,
                onOpen: () => {
                  setDraftVisibleGroups(visibleGroups);
                  setGroupFilterOpen(true);
                },
                onClose: () => {
                  commitVisibleGroups(draftVisibleGroups);
                  setGroupFilterOpen(false);
                },
                renderValue: (selected) =>
                  formatSelectedFilterSummary(
                    selected as string[],
                    groupOptions.map((option) => option.group),
                    'groups'
                  ),
              }}
            >
              <MenuItem value="__all">Select all groups</MenuItem>
              <MenuItem value="__none">Clear groups</MenuItem>
              <Divider />
              {groupOptions.map((option) => (
                <MenuItem key={option.group} value={option.group}>
                  <Checkbox
                    checked={(groupFilterOpen ? draftVisibleGroups : visibleGroups).includes(
                      option.group
                    )}
                  />
                  <ListItemText primary={`${option.label} (${option.count})`} />
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label="Market health"
              value={healthFilterOpen ? draftVisibleHealthFlags : (visibleHealthFlags as string[])}
              onChange={(event) => {
                const selectedHealthFlags = normalizeMultiSelectValue(event.target.value);
                if (selectedHealthFlags.includes('__all')) {
                  setDraftVisibleHealthFlags(healthFilterOptions);
                  return;
                }
                if (selectedHealthFlags.includes('__none')) {
                  setDraftVisibleHealthFlags([]);
                  return;
                }
                setDraftVisibleHealthFlags(selectedHealthFlags);
              }}
              helperText="Controls which data-quality statuses feed all economy tables"
              SelectProps={{
                multiple: true,
                onOpen: () => {
                  setDraftVisibleHealthFlags(visibleHealthFlags as string[]);
                  setHealthFilterOpen(true);
                },
                onClose: () => {
                  commitVisibleHealthFlags(draftVisibleHealthFlags);
                  setHealthFilterOpen(false);
                },
                renderValue: (selected) =>
                  formatSelectedFilterSummary(
                    selected as string[],
                    healthFilterOptions,
                    'statuses'
                  ),
              }}
            >
              <MenuItem value="__all">Select all statuses</MenuItem>
              <MenuItem value="__none">Clear statuses</MenuItem>
              <Divider />
              {healthFilterOptions.map((flag) => (
                <MenuItem key={flag} value={flag}>
                  <Checkbox
                    checked={(healthFilterOpen
                      ? draftVisibleHealthFlags
                      : (visibleHealthFlags as string[])
                    ).includes(flag)}
                  />
                  <ListItemText primary={flag} />
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </CollapsibleSection>

      <CollapsibleSection
        title="Signals overview"
        subtitle="Quick read on the currently filtered economy dataset."
        summary={`${trendRows.length} trend rows passing filters`}
        storageKey="economyAnalysis:overviewCollapsed"
        classes={classes}
      >
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
      </CollapsibleSection>

      <EconomyTable
        title={`Top 10 opportunity score (${windowDays}d)`}
        subtitle="Conservative watchlist: inflation helps, but liquidity, realistic price level, spread and health flags can change the ranking."
        rows={opportunityRows}
        mode="inflation"
        defaultSortKey="score"
        defaultSortDirection="desc"
        maxRows={10}
        enableColumnFilters={false}
        storageKey="economyAnalysis:opportunityCollapsed"
        classes={classes}
      />

      <EconomyTable
        title={`Top 10 inflation candidates (${windowDays}d)`}
        subtitle={`Best for finding items that may preserve or grow wealth over time, using ${inflationMetric}.`}
        rows={inflationRows}
        mode="inflation"
        defaultSortKey="changePct"
        defaultSortDirection="desc"
        maxRows={10}
        enableColumnFilters={false}
        storageKey="economyAnalysis:inflationCollapsed"
        classes={classes}
      />

      <EconomyTable
        title={`Top 10 deflation / avoid holding (${windowDays}d)`}
        subtitle={`Useful for spotting items that are losing value by ${inflationMetric} and should usually be liquidated faster.`}
        rows={deflationRows}
        mode="inflation"
        defaultSortKey="changePct"
        defaultSortDirection="asc"
        maxRows={10}
        enableColumnFilters={false}
        storageKey="economyAnalysis:deflationCollapsed"
        classes={classes}
      />

      <EconomyTable
        title="Top 10 intraday spread watch"
        subtitle="Potential flipping scouts: high-low gap on the selected day, filtered by volume."
        rows={spreadRows}
        mode="spread"
        defaultSortKey="spread"
        defaultSortDirection="desc"
        maxRows={10}
        enableColumnFilters={false}
        storageKey="economyAnalysis:spreadCollapsed"
        classes={classes}
      />

      <EconomyTable
        title="Market explorer"
        subtitle="Full filtered PoEDB dataset for deeper analysis. Column filters apply here because this table is not pre-cut to a Top 10 list."
        rows={trendRows}
        mode="inflation"
        defaultSortKey="score"
        defaultSortDirection="desc"
        enableColumnFilters
        storageKey="economyAnalysis:explorerCollapsed"
        classes={classes}
      />
    </Box>
  );
};

type CollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  summary?: string;
  storageKey: string;
  actions?: React.ReactNode;
  classes: ReturnType<typeof useStyles>;
  children: React.ReactNode;
};

const CollapsibleSection = ({
  title,
  subtitle,
  summary,
  storageKey,
  actions,
  classes,
  children,
}: CollapsibleSectionProps) => {
  const [collapsed, setCollapsed] = useLocalStorage(storageKey, false);

  return (
    <Box className={classes.sectionWidget}>
      <Widget backgroundColor={secondary.main} height="auto">
        <Box className={classes.sectionHeader}>
          <Box className={classes.sectionTitleBlock}>
            <Box className={classes.collapsibleTitle}>
              <IconButton
                size="small"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
              >
                {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
              </IconButton>
              <Typography variant="overline">{title}</Typography>
            </Box>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            {summary && (
              <Typography variant="caption" color="text.secondary">
                {summary}
              </Typography>
            )}
          </Box>
          {actions && <Box className={classes.sectionActions}>{actions}</Box>}
        </Box>
        <Collapse in={!collapsed}>
          <Box mt={2}>{children}</Box>
        </Collapse>
      </Widget>
    </Box>
  );
};

type EconomyTableProps = {
  title: string;
  subtitle: string;
  rows: EconomyRow[];
  mode: 'inflation' | 'spread';
  defaultSortKey: EconomySortKey;
  defaultSortDirection: EconomySortDirection;
  maxRows?: number;
  enableColumnFilters?: boolean;
  storageKey: string;
  classes: ReturnType<typeof useStyles>;
};

type EconomySortKey =
  | 'name'
  | 'group'
  | 'score'
  | 'health'
  | 'selected'
  | 'changePct'
  | 'changeChaos'
  | 'start'
  | 'startVolume'
  | 'low'
  | 'high'
  | 'spread'
  | 'volume'
  | 'avgVolume';

type EconomySortDirection = 'asc' | 'desc';
type NumericFilterOperator = 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'between';
type EconomyColumnFilter = {
  values?: string[];
  operator?: NumericFilterOperator;
  value?: string;
  valueTo?: string;
};
type GlobalNumericFilterInput = {
  minPrice: string | number;
  maxPrice: string | number;
  minVolume: string | number;
  maxVolume: string | number;
  minChangePct: string | number;
  maxChangePct: string | number;
  minSpreadPct: string | number;
  maxSpreadPct: string | number;
};

const numericFilterOperators: Array<{ value: NumericFilterOperator; label: string }> = [
  { value: 'gte', label: 'Greater or equal' },
  { value: 'gt', label: 'Greater than' },
  { value: 'lte', label: 'Less or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'eq', label: 'Equal' },
  { value: 'between', label: 'Between' },
];

const textFilterKeys = new Set<EconomySortKey>(['name', 'group', 'health']);

const EconomyTable = ({
  title,
  subtitle,
  rows,
  mode,
  defaultSortKey,
  defaultSortDirection,
  maxRows,
  enableColumnFilters = false,
  storageKey,
  classes,
}: EconomyTableProps) => {
  const [sortKey, setSortKey] = useState<EconomySortKey>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<EconomySortDirection>(defaultSortDirection);
  const [filters, setFilters] = useState<Record<string, EconomyColumnFilter>>({});
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [openFilterKey, setOpenFilterKey] = useState<EconomySortKey | null>(null);
  const [collapsed, setCollapsed] = useLocalStorage(storageKey, false);
  const filteredRows = useMemo(
    () =>
      enableColumnFilters ? rows.filter((row) => passesColumnFilters(row, filters, mode)) : rows,
    [enableColumnFilters, filters, mode, rows]
  );
  const sortedRows = useMemo(() => sortEconomyRows(filteredRows, sortKey, sortDirection, mode), [
    filteredRows,
    mode,
    sortDirection,
    sortKey,
  ]);
  const displayedRows = maxRows ? sortedRows.slice(0, maxRows) : sortedRows;
  const openFilter = openFilterKey ? filters[openFilterKey] || {} : {};
  const openFilterOptions = useMemo(
    () =>
      openFilterKey && textFilterKeys.has(openFilterKey)
        ? getDistinctColumnValues(rows, openFilterKey, mode)
        : [],
    [mode, openFilterKey, rows]
  );
  const hasActiveFilters =
    enableColumnFilters && Object.values(filters).some((filter) => isColumnFilterActive(filter));

  const requestSort = (key: EconomySortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDirection(getDefaultSortDirection(key));
  };
  const updateFilter = (key: EconomySortKey, filter: EconomyColumnFilter) => {
    setFilters((current) => {
      const next = { ...current };
      if (isColumnFilterActive(filter)) {
        next[key] = filter;
      } else {
        delete next[key];
      }
      return next;
    });
  };
  const clearFilter = (key: EconomySortKey) => {
    setFilters((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const openColumnFilter = (key: EconomySortKey, element: HTMLElement) => {
    setOpenFilterKey(key);
    setFilterAnchor(element);
  };
  const closeColumnFilter = () => {
    setOpenFilterKey(null);
    setFilterAnchor(null);
  };

  return (
    <Box className={classes.tableWidget}>
      <Widget backgroundColor={secondary.main} height="auto">
        <Box mb={2} className={classes.tableHeader}>
          <Box>
            <Box className={classes.collapsibleTitle}>
              <IconButton
                size="small"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
              >
                {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
              </IconButton>
              <Typography variant="overline">{title}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Showing {displayedRows.length} of {filteredRows.length} filtered rows
            </Typography>
          </Box>
          <Box className={classes.tableHeaderActions}>
            {enableColumnFilters && (
              <Typography variant="caption" color="text.secondary">
                Column filters enabled
              </Typography>
            )}
            {hasActiveFilters && (
              <Button size="small" color="secondary" onClick={() => setFilters({})}>
                Clear column filters
              </Button>
            )}
          </Box>
        </Box>
        <Collapse in={!collapsed}>
          <TableContainer className={classes.tableContainer}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <SortableHeader
                    label="Item"
                    sortKey="name"
                    activeSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={requestSort}
                    filter={filters.name}
                    onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                  />
                  <SortableHeader
                    label="Group"
                    sortKey="group"
                    activeSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={requestSort}
                    filter={filters.group}
                    onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                  />
                  <SortableHeader
                    label="Score"
                    sortKey="score"
                    align="right"
                    activeSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={requestSort}
                    filter={filters.score}
                    onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                  />
                  <SortableHeader
                    label="Health"
                    sortKey="health"
                    activeSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={requestSort}
                    filter={filters.health}
                    onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                  />
                  <SortableHeader
                    label={mode === 'inflation' ? 'Selected (c)' : 'Rate (c)'}
                    sortKey="selected"
                    align="right"
                    activeSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={requestSort}
                    filter={filters.selected}
                    onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                  />
                  {mode === 'inflation' ? (
                    <>
                      <SortableHeader
                        label="Change"
                        sortKey="changePct"
                        align="right"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={requestSort}
                        filter={filters.changePct}
                        onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                      />
                      <SortableHeader
                        label="Change (c)"
                        sortKey="changeChaos"
                        align="right"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={requestSort}
                        filter={filters.changeChaos}
                        onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                      />
                      <SortableHeader
                        label="From"
                        sortKey="start"
                        align="right"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={requestSort}
                        filter={filters.start}
                        onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                      />
                      <SortableHeader
                        label="Start volume"
                        sortKey="startVolume"
                        align="right"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={requestSort}
                        filter={filters.startVolume}
                        onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                      />
                    </>
                  ) : (
                    <>
                      <SortableHeader
                        label="Low (c)"
                        sortKey="low"
                        align="right"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={requestSort}
                        filter={filters.low}
                        onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                      />
                      <SortableHeader
                        label="High (c)"
                        sortKey="high"
                        align="right"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={requestSort}
                        filter={filters.high}
                        onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                      />
                      <SortableHeader
                        label="Spread"
                        sortKey="spread"
                        align="right"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={requestSort}
                        filter={filters.spread}
                        onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                      />
                    </>
                  )}
                  <SortableHeader
                    label="Selected volume"
                    sortKey="volume"
                    align="right"
                    activeSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={requestSort}
                    filter={filters.volume}
                    onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                  />
                  <SortableHeader
                    label="Avg window volume"
                    sortKey="avgVolume"
                    align="right"
                    activeSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={requestSort}
                    filter={filters.avgVolume}
                    onOpenFilter={enableColumnFilters ? openColumnFilter : undefined}
                  />
                </TableRow>
              </TableHead>
              <TableBody>
                {displayedRows.map((row) => (
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
                {displayedRows.length === 0 && (
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
        </Collapse>
        <Popover
          open={enableColumnFilters && !!openFilterKey}
          anchorEl={filterAnchor}
          onClose={closeColumnFilter}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          {openFilterKey && (
            <ColumnFilterPopover
              columnKey={openFilterKey}
              filter={openFilter}
              options={openFilterOptions}
              isTextFilter={textFilterKeys.has(openFilterKey)}
              classes={classes}
              onChange={(filter) => updateFilter(openFilterKey, filter)}
              onClear={() => clearFilter(openFilterKey)}
            />
          )}
        </Popover>
      </Widget>
    </Box>
  );
};

type SortableHeaderProps = {
  label: string;
  sortKey: EconomySortKey;
  activeSortKey: EconomySortKey;
  sortDirection: EconomySortDirection;
  onSort: (key: EconomySortKey) => void;
  filter?: EconomyColumnFilter;
  onOpenFilter?: (key: EconomySortKey, element: HTMLElement) => void;
  align?: 'left' | 'right';
};

const SortableHeader = ({
  label,
  sortKey,
  activeSortKey,
  sortDirection,
  onSort,
  filter,
  onOpenFilter,
  align = 'left',
}: SortableHeaderProps) => (
  <TableCell align={align} sortDirection={activeSortKey === sortKey ? sortDirection : false}>
    <Box
      display="inline-flex"
      alignItems="center"
      justifyContent={align === 'right' ? 'flex-end' : 'flex-start'}
    >
      <TableSortLabel
        active={activeSortKey === sortKey}
        direction={activeSortKey === sortKey ? sortDirection : getDefaultSortDirection(sortKey)}
        onClick={() => onSort(sortKey)}
      >
        {label}
      </TableSortLabel>
      {onOpenFilter && (
        <IconButton
          size="small"
          color={isColumnFilterActive(filter) ? 'secondary' : 'default'}
          onClick={(event) => {
            event.stopPropagation();
            onOpenFilter(sortKey, event.currentTarget);
          }}
        >
          <FilterListIcon fontSize="inherit" />
        </IconButton>
      )}
    </Box>
  </TableCell>
);

type ColumnFilterPopoverProps = {
  columnKey: EconomySortKey;
  filter: EconomyColumnFilter;
  options: string[];
  isTextFilter: boolean;
  classes: ReturnType<typeof useStyles>;
  onChange: (filter: EconomyColumnFilter) => void;
  onClear: () => void;
};

const ColumnFilterPopover = ({
  columnKey,
  filter,
  options,
  isTextFilter,
  classes,
  onChange,
  onClear,
}: ColumnFilterPopoverProps) => {
  const selectedValues = filter.values || options;
  const toggleValue = (value: string) => {
    const selected = new Set(selectedValues);
    if (selected.has(value)) {
      selected.delete(value);
    } else {
      selected.add(value);
    }
    onChange({ values: Array.from(selected) });
  };

  return (
    <Box className={classes.filterPopover}>
      <Typography variant="overline">Filter {columnKey}</Typography>
      {isTextFilter ? (
        <>
          <Stack direction="row" spacing={1} mb={1}>
            <Button size="small" onClick={onClear}>
              Select all
            </Button>
            <Button size="small" onClick={() => onChange({ values: [] })}>
              Unselect all
            </Button>
            <Button size="small" color="secondary" onClick={onClear}>
              Clear
            </Button>
          </Stack>
          <Divider />
          <Box className={classes.filterOptions}>
            {options.map((option) => (
              <FormControlLabel
                key={option}
                control={
                  <Checkbox
                    size="small"
                    checked={selectedValues.includes(option)}
                    onChange={() => toggleValue(option)}
                  />
                }
                label={option}
              />
            ))}
          </Box>
        </>
      ) : (
        <Stack spacing={1.5}>
          <TextField
            select
            size="small"
            label="Condition"
            value={filter.operator || 'gte'}
            onChange={(event) =>
              onChange({
                ...filter,
                operator: event.target.value as NumericFilterOperator,
              })
            }
          >
            {numericFilterOperators.map((operator) => (
              <MenuItem key={operator.value} value={operator.value}>
                {operator.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="number"
            label={(filter.operator || 'gte') === 'between' ? 'From' : 'Value'}
            value={filter.value || ''}
            onChange={(event) => onChange({ ...filter, value: event.target.value })}
          />
          {(filter.operator || 'gte') === 'between' && (
            <TextField
              size="small"
              type="number"
              label="To"
              value={filter.valueTo || ''}
              onChange={(event) => onChange({ ...filter, valueTo: event.target.value })}
            />
          )}
          <Button size="small" color="secondary" onClick={onClear}>
            Clear numeric filter
          </Button>
        </Stack>
      )}
    </Box>
  );
};

const sortEconomyRows = (
  rows: EconomyRow[],
  sortKey: EconomySortKey,
  direction: EconomySortDirection,
  mode: 'inflation' | 'spread'
) => {
  const multiplier = direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = getSortValue(left.row, sortKey, mode);
      const rightValue = getSortValue(right.row, sortKey, mode);
      const result = compareSortValues(leftValue, rightValue);

      return result === 0 ? left.index - right.index : result * multiplier;
    })
    .map((entry) => entry.row);
};

const getSortValue = (row: EconomyRow, sortKey: EconomySortKey, mode: 'inflation' | 'spread') => {
  switch (sortKey) {
    case 'name':
      return row.name;
    case 'group':
      return row.groupLabel;
    case 'score':
      return row.opportunityScore;
    case 'health':
      return row.healthFlags.length === 0
        ? 'OK'
        : row.healthFlags.map((flag) => flag.label).join(', ');
    case 'selected':
      return mode === 'inflation' ? row.selectedMetric : row.selected.rate;
    case 'changePct':
      return row.changePct;
    case 'changeChaos':
      return row.changeChaos;
    case 'start':
      return row.startMetric;
    case 'startVolume':
      return row.startVolume;
    case 'low':
      return row.selected.low;
    case 'high':
      return row.selected.high;
    case 'spread':
      return row.spreadPct;
    case 'volume':
      return row.volume;
    case 'avgVolume':
      return row.avgVolume;
    default:
      return 0;
  }
};

const passesColumnFilters = (
  row: EconomyRow,
  filters: Record<string, EconomyColumnFilter>,
  mode: 'inflation' | 'spread'
) => {
  return Object.entries(filters).every(([key, filter]) => {
    if (!isColumnFilterActive(filter)) {
      return true;
    }

    const columnKey = key as EconomySortKey;
    if (textFilterKeys.has(columnKey)) {
      return (filter.values || []).includes(String(getSortValue(row, columnKey, mode)));
    }

    return passesNumericFilter(Number(getSortValue(row, columnKey, mode)), filter);
  });
};

const passesNumericFilter = (value: number, filter: EconomyColumnFilter) => {
  if (!Number.isFinite(value)) {
    return false;
  }

  const target = Number(filter.value);
  const targetTo = Number(filter.valueTo);
  if (!Number.isFinite(target)) {
    return true;
  }

  switch (filter.operator || 'gte') {
    case 'gt':
      return value > target;
    case 'gte':
      return value >= target;
    case 'lt':
      return value < target;
    case 'lte':
      return value <= target;
    case 'eq':
      return value === target;
    case 'between':
      return Number.isFinite(targetTo) ? value >= target && value <= targetTo : value >= target;
    default:
      return true;
  }
};

const formatSelectedFilterSummary = (selected: string[], allOptions: string[], label: string) => {
  if (selected.length === 0) {
    return `No ${label}`;
  }

  if (selected.length === allOptions.length) {
    return `All ${label}`;
  }

  if (selected.length <= 3) {
    return selected.join(', ');
  }

  return `${selected.length} ${label} selected`;
};

const getActiveFilterSummary = ({
  visibleGroups,
  totalGroups,
  visibleHealthFlags,
  minVolume,
  maxVolume,
  minRate,
  maxRate,
  minChangePct,
  maxChangePct,
  minSpreadPct,
  maxSpreadPct,
}: {
  visibleGroups: string[];
  totalGroups: number;
  visibleHealthFlags: string[];
  minVolume: string | number;
  maxVolume: string | number;
  minRate: string | number;
  maxRate: string | number;
  minChangePct: string | number;
  maxChangePct: string | number;
  minSpreadPct: string | number;
  maxSpreadPct: string | number;
}) => {
  const parts = [
    `${visibleGroups.length}/${totalGroups} groups`,
    `${visibleHealthFlags.length}/${healthFilterOptions.length} health statuses`,
  ];

  if (Number(minVolume) > 0 || hasOptionalNumber(maxVolume)) {
    parts.push(`volume ${formatFilterRange(minVolume, maxVolume)}`);
  }
  if (Number(minRate) > 0 || hasOptionalNumber(maxRate)) {
    parts.push(`price ${formatFilterRange(minRate, maxRate)}c`);
  }
  if (hasOptionalNumber(minChangePct) || hasOptionalNumber(maxChangePct)) {
    parts.push(`change ${formatFilterRange(minChangePct, maxChangePct)}%`);
  }
  if (hasOptionalNumber(minSpreadPct) || hasOptionalNumber(maxSpreadPct)) {
    parts.push(`spread ${formatFilterRange(minSpreadPct, maxSpreadPct)}%`);
  }

  return parts.join(' · ');
};

const formatFilterRange = (min: string | number, max: string | number) => {
  const hasMin = hasOptionalNumber(min);
  const hasMax = hasOptionalNumber(max);

  if (hasMin && hasMax) {
    return `${min}-${max}`;
  }
  if (hasMin) {
    return `>= ${min}`;
  }
  return `<= ${max}`;
};

const hasOptionalNumber = (value: string | number) =>
  value !== '' && Number.isFinite(Number(value));

const normalizeMultiSelectValue = (value: unknown) =>
  (Array.isArray(value) ? value.map(String) : String(value).split(',')).filter(Boolean);

const isColumnFilterActive = (filter?: EconomyColumnFilter) => {
  if (!filter) {
    return false;
  }

  if (filter.values) {
    return true;
  }

  return filter.value !== undefined && filter.value !== '';
};

const getDistinctColumnValues = (
  rows: EconomyRow[],
  columnKey: EconomySortKey,
  mode: 'inflation' | 'spread'
) => {
  return Array.from(new Set(rows.map((row) => String(getSortValue(row, columnKey, mode))))).sort(
    (left, right) =>
      left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
  );
};

const compareSortValues = (left: string | number, right: string | number) => {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

const getDefaultSortDirection = (sortKey: EconomySortKey): EconomySortDirection =>
  sortKey === 'name' || sortKey === 'group' || sortKey === 'health' ? 'asc' : 'desc';

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

const getGlobalNumericFilters = (filters: GlobalNumericFilterInput) => ({
  minPrice: parseOptionalNumber(filters.minPrice) ?? 0,
  maxPrice: parseOptionalNumber(filters.maxPrice),
  minVolume: parseOptionalNumber(filters.minVolume) ?? 0,
  maxVolume: parseOptionalNumber(filters.maxVolume),
  minChangePct: parseOptionalNumber(filters.minChangePct),
  maxChangePct: parseOptionalNumber(filters.maxChangePct),
  minSpreadPct: parseOptionalNumber(filters.minSpreadPct),
  maxSpreadPct: parseOptionalNumber(filters.maxSpreadPct),
});

const parseOptionalNumber = (value: string | number) => {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const passesOptionalMax = (value: number, maxValue?: number) =>
  maxValue === undefined || value <= maxValue;

const passesRange = (value: number, minValue?: number, maxValue?: number) => {
  if (!Number.isFinite(value)) {
    return false;
  }

  if (minValue !== undefined && value < minValue) {
    return false;
  }

  if (maxValue !== undefined && value > maxValue) {
    return false;
  }

  return true;
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
    +(
      inflationComponent +
      volumeComponent +
      priceComponent -
      spreadPenalty -
      healthPenalty
    ).toFixed(2)
  );
};

const getMedian = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  const midpoint = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[midpoint - 1] + values[midpoint]) / 2 : values[midpoint];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const inferEconomyGroupFromPoedbItem = (name: string, url: string, fallbackGroup?: string) => {
  const token = `${name} ${url}`.toLowerCase();

  if (
    /\b(?:amber|azure|black|clear|crimson|golden|indigo|opalescent|prismatic|reflective|sepia|silver|tainted|teal|verdant|violet)[-\s]oil\b/.test(
      token
    )
  ) {
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
