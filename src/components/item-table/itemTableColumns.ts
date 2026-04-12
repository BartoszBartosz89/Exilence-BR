import { Column } from 'react-table';
import {
  itemCorrupted,
  itemGroup,
  itemIcon,
  itemIlvlTier,
  itemLinks,
  itemName,
  itemQuantity,
  itemTabs,
  itemValue,
  sparkLine,
} from '../columns/Columns';

const itemTableColumns: Column<object>[] = [
  itemIcon({
    accessor: 'icon',
    header: 'Icon',
  }),
  itemName({
    accessor: 'name',
    header: 'Name',
  }),
  itemIlvlTier({
    accessor: (row: any) => (row.tier > 0 ? row.tier : row.ilvl),
    header: 'Ilvl / Tier',
  }),
  itemTabs({
    accessor: 'tab',
    header: 'Tabs',
  }),
  itemGroup({
    accessor: 'group',
    header: 'Group',
  }),
  itemCorrupted({
    accessor: 'corrupted',
    header: 'Corrupted',
  }),
  itemLinks({
    accessor: 'links',
    header: 'Links',
  }),
  {
    Header: 'Quality',
    accessor: 'quality',
    align: 'right',
    maxWidth: 60,
  },
  {
    Header: 'Level',
    accessor: 'level',
    align: 'right',
    maxWidth: 60,
  },
  itemQuantity({
    header: 'Quantity',
    accessor: 'stackSize',
  }),
  sparkLine({
    accessor: 'sparkLine.totalChange',
    header: 'Price trend (7d)',
  }),
  itemValue({
    accessor: 'calculated',
    header: 'Price (c)',
    editable: true,
  }),
  itemValue({
    accessor: 'total',
    header: 'Total value (c)',
  }),
  itemValue({
    header: 'Cumulative (c)',
    cumulative: true,
  }),
];

export default itemTableColumns;
