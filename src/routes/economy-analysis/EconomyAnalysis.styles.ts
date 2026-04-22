import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(1, 2, 2, 2),
  },
  header: {
    marginBottom: theme.spacing(2),
  },
  controls: {
    marginBottom: 0,
  },
  intro: {
    maxWidth: 980,
  },
  metricCard: {
    height: '100%',
  },
  tableWidget: {
    marginTop: theme.spacing(2),
  },
  sectionWidget: {
    marginTop: theme.spacing(2),
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  sectionTitleBlock: {
    minWidth: 0,
  },
  sectionActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexShrink: 0,
  },
  collapsibleTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  tableHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexShrink: 0,
  },
  tableContainer: {
    maxHeight: 460,
  },
  filterPopover: {
    width: 280,
    padding: theme.spacing(2),
  },
  filterOptions: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 260,
    overflowY: 'auto',
    paddingTop: theme.spacing(1),
  },
  itemCell: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    minWidth: 0,
  },
  itemIcon: {
    width: 28,
    height: 28,
    objectFit: 'contain',
    flexShrink: 0,
  },
  itemName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  positive: {
    color: '#4caf50',
    fontWeight: 700,
  },
  negative: {
    color: '#f44336',
    fontWeight: 700,
  },
  muted: {
    color: theme.palette.text.secondary,
  },
}));

export default useStyles;
