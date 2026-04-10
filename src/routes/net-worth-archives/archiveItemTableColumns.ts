import { Column } from 'react-table';
import {
  itemIcon,
  itemName,
  itemQuantity,
  itemTabs,
  itemValue,
} from '../../components/columns/Columns';

const archiveItemTableColumns: Column<object>[] = [
  itemIcon({
    accessor: 'icon',
    header: 'Icon',
  }),
  itemName({
    accessor: 'name',
    header: 'Name',
  }),
  itemTabs({
    accessor: 'tab',
    header: 'Tabs',
  }),
  itemQuantity({
    header: 'Quantity',
    accessor: 'stackSize',
  }),
  itemValue({
    accessor: 'snapshotCalculated',
    header: 'Snapshot price (c)',
    placeholder: 'N/A',
  }),
  itemValue({
    accessor: 'snapshotTotal',
    header: 'Snapshot total (c)',
    placeholder: 'N/A',
  }),
  itemValue({
    accessor: 'liveCalculated',
    header: 'Current app price (c)',
    placeholder: 'N/A',
  }),
  itemValue({
    accessor: 'liveTotal',
    header: 'Current app total (c)',
    placeholder: 'N/A',
  }),
];

export default archiveItemTableColumns;
