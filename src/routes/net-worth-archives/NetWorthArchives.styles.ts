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
  archiveSearch: {
    marginTop: theme.spacing(2),
  },
  sidebarList: {
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBottom: theme.spacing(2),
    minHeight: 0,
    direction: 'ltr',
  },
  archiveButton: {
    alignItems: 'flex-start',
    borderRight: '3px solid transparent',
    padding: theme.spacing(1.5, 2),
  },
  archiveButtonContent: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  },
  archiveMeta: {
    marginTop: theme.spacing(0.5),
  },
  archiveDeleteButton: {
    marginTop: -theme.spacing(0.5),
    marginRight: -theme.spacing(1),
  },
  archiveButtonSelected: {
    borderRightColor: theme.palette.primary.light,
    backgroundColor: 'rgba(255,255,255,0.02)',
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
    direction: 'ltr',
  },
  contentInner: {
    direction: 'ltr',
    padding: theme.spacing(1, 0, 0, 2),
    minHeight: '100%',
  },
  actionRow: {
    marginBottom: theme.spacing(2),
  },
  archiveHeader: {
    marginBottom: theme.spacing(2),
  },
  infoCard: {
    marginBottom: theme.spacing(2),
  },
  totalsRow: {
    marginBottom: theme.spacing(2),
  },
}));

export default useStyles;
