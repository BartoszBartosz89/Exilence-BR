import makeStyles from '@mui/styles/makeStyles';

const sidebarWidth = 220;
const sidebarToggleWidth = 24;

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    width: '100%',
    height: '100%',
    minHeight: 0,
    backgroundColor: theme.palette.background.default,
    overflow: 'hidden',
  },
  sidebarShell: {
    display: 'flex',
    minHeight: 0,
    flexShrink: 0,
  },
  sidebar: {
    width: sidebarWidth,
    minWidth: sidebarWidth,
    borderRight: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
    transition: theme.transitions.create(['width', 'min-width', 'border-color'], {
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  sidebarCollapsed: {
    width: 0,
    minWidth: 0,
    borderRightColor: 'transparent',
  },
  sidebarHeader: {
    padding: theme.spacing(2, 2, 1.5, 2),
    flexShrink: 0,
  },
  analysisSearch: {
    marginTop: theme.spacing(2),
  },
  sidebarList: {
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBottom: theme.spacing(2),
    minHeight: 0,
  },
  analysisButton: {
    alignItems: 'flex-start',
    borderRight: '3px solid transparent',
    padding: theme.spacing(1.5, 2),
  },
  analysisButtonSelected: {
    borderRightColor: theme.palette.primary.light,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  analysisButtonContent: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  },
  analysisMeta: {
    marginTop: theme.spacing(0.5),
  },
  analysisDeleteButton: {
    marginTop: -theme.spacing(0.5),
    marginRight: -theme.spacing(1),
  },
  sidebarToggle: {
    width: sidebarToggleWidth,
    minWidth: sidebarToggleWidth,
    borderRight: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: theme.spacing(1),
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  contentInner: {
    padding: theme.spacing(1, 0, 0, 2),
    minHeight: '100%',
  },
  actionRow: {
    marginBottom: theme.spacing(2),
  },
  analysisHeader: {
    marginBottom: theme.spacing(2),
  },
  chartContainer: {
    minHeight: 420,
    width: '100%',
  },
  chartWidget: {
    marginBottom: theme.spacing(2),
  },
  summaryTable: {
    marginTop: theme.spacing(2),
  },
  strategyCard: {
    padding: theme.spacing(2),
  },
  strategyHeader: {
    display: 'grid',
    gridTemplateColumns: '40px minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr) auto',
    gap: theme.spacing(2),
    alignItems: 'center',
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '40px minmax(0, 1fr)',
      gap: theme.spacing(1.5),
    },
  },
  strategyHeaderBlock: {
    minWidth: 0,
  },
  strategyHeaderLabel: {
    display: 'block',
    marginBottom: theme.spacing(0.5),
  },
  strategyHeaderValue: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  strategyIcons: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    minWidth: 0,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  strategyIconStack: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    overflow: 'hidden',
  },
  strategyIconTiny: {
    width: 20,
    height: 20,
    objectFit: 'contain',
    borderRadius: theme.spacing(0.5),
    flexShrink: 0,
  },
  strategyHeaderActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: theme.spacing(1),
    [theme.breakpoints.down('md')]: {
      gridColumn: '1 / -1',
      justifyContent: 'space-between',
    },
  },
  strategyExpanded: {
    marginTop: theme.spacing(2),
  },
  strategyCardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  addStrategyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    justifyContent: 'flex-start',
    marginBottom: theme.spacing(2),
  },
  currencyToggle: {
    marginLeft: theme.spacing(1),
  },
  costRow: {
    display: 'grid',
    gridTemplateColumns: '32px minmax(0, 1fr) 96px 40px',
    gap: theme.spacing(1.5),
    alignItems: 'center',
    marginTop: theme.spacing(1),
  },
  itemIcon: {
    width: 28,
    height: 28,
    objectFit: 'contain',
  },
  helperText: {
    marginTop: theme.spacing(1),
  },
}));

export default useStyles;
