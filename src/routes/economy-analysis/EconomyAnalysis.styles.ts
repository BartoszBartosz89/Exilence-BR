import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(1, 2, 2, 2),
  },
  header: {
    marginBottom: theme.spacing(2),
  },
  controls: {
    marginBottom: theme.spacing(2),
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
  tableContainer: {
    maxHeight: 460,
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
