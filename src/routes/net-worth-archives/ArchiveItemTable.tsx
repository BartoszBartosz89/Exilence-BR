import FilterListIcon from '@mui/icons-material/FilterList';
import GetAppIcon from '@mui/icons-material/GetApp';
import ViewColumnsIcon from '@mui/icons-material/ViewColumn';
import { Box, Button, Grid, Stack, Theme } from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import React, { ChangeEvent, useCallback, useMemo, useState } from 'react';
import {
  TableInstance,
  useColumnOrder,
  useFilters,
  useFlexLayout,
  usePagination,
  useResizeColumns,
  useSortBy,
  useTable,
} from 'react-table';
import ColumnHidePage from '../../components/column-hide-page/ColumnHidePage';
import ItemTableFilter from '../../components/item-table/item-table-filter/ItemTableFilter';
import { defaultColumn } from '../../components/table-wrapper/DefaultColumn';
import TableWrapper from '../../components/table-wrapper/TableWrapper';
import { useLocalStorage } from '../../hooks/use-local-storage';
import { INetWorthArchiveItem } from '../../interfaces/net-worth-archive-item.interface';
import { exportData } from '../../utils/export.utils';
import archiveItemTableColumns from './archiveItemTableColumns';

const useStyles = makeStyles((theme: Theme) => ({
  actionArea: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  tableButton: {
    marginLeft: theme.spacing(1.5),
  },
}));

type ArchiveItemTableProps = {
  items: INetWorthArchiveItem[];
};

const ArchiveItemTable = ({ items }: ArchiveItemTableProps) => {
  const classes = useStyles();
  const [searchText, setSearchText] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const filteredItems = useMemo(() => {
    if (!searchText) {
      return items;
    }

    return items.filter((item) => {
      const tabNames =
        item.tab
          ?.map((tab) => tab.name)
          .join(', ')
          .toLowerCase() || '';
      return (
        item.name.toLowerCase().includes(searchText) ||
        item.typeLine.toLowerCase().includes(searchText) ||
        tabNames.includes(searchText)
      );
    });
  }, [items, searchText]);

  const [initialState, setInitialState] = useLocalStorage(`tableState:net-worth-archive-table`, {
    pageSize: 25,
    hiddenColumns: [],
    sortBy: [{ id: 'snapshotTotal', desc: true }],
  });

  const columns = useMemo(() => archiveItemTableColumns, []);
  const data = useMemo(() => filteredItems, [filteredItems]);

  const instance = useTable(
    {
      columns,
      defaultColumn,
      data,
      initialState,
    },
    useColumnOrder,
    useFilters,
    useSortBy,
    useFlexLayout,
    usePagination,
    useResizeColumns
  ) as TableInstance<object>;

  const handleFilter = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setSearchText(event.target.value.toLowerCase());
  };

  const clearFilter = () => {
    setSearchText('');
  };

  const [anchorEl, setAnchorEl] = useState<Element | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const hideableColumns = columns.filter((column) => !(column.id === '_selector'));

  const handleColumnsClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setColumnsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setColumnsOpen(false);
    setAnchorEl(null);
  }, []);

  return (
    <>
      <Box mb={2}>
        <Grid container direction="row" justifyContent="space-between" alignItems="center">
          <Grid item md={7}>
            <Stack spacing={2} display="flex" alignItems="center" direction="row">
              <ItemTableFilter
                array={data as any}
                handleFilter={handleFilter}
                clearFilter={clearFilter}
                searchText={searchText}
              />
            </Stack>
          </Grid>
          <Grid item className={classes.actionArea} md={5}>
            {columnsOpen && (
              <ColumnHidePage
                instance={instance}
                onClose={handleClose}
                show={columnsOpen}
                anchorEl={anchorEl}
              />
            )}
            {hideableColumns.length > 1 && (
              <Button
                size="small"
                className={classes.tableButton}
                variant="contained"
                onClick={handleColumnsClick}
                startIcon={<ViewColumnsIcon />}
              >
                Edit columns
              </Button>
            )}
            <Button
              size="small"
              className={classes.tableButton}
              variant="contained"
              onClick={() => setShowFilter((current) => !current)}
              startIcon={<FilterListIcon />}
            >
              {!showFilter ? 'Create filter' : 'Disable filter'}
            </Button>
            <Button
              size="small"
              className={classes.tableButton}
              variant="contained"
              disabled={data.length === 0}
              onClick={() => exportData(data)}
              startIcon={<GetAppIcon />}
            >
              Export data
            </Button>
          </Grid>
        </Grid>
      </Box>
      <TableWrapper instance={instance} setInitialState={setInitialState} />
    </>
  );
};

export default ArchiveItemTable;
