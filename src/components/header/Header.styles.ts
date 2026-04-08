import createStyles from '@mui/styles/createStyles';
import makeStyles from '@mui/styles/makeStyles';

import { primaryLighter } from '../../assets/themes/exilence-theme';
import { resizeHandleContainerHeight, toolbarHeight } from './Header';

const useStyles = makeStyles((theme) =>
  createStyles({
    header: {
      zIndex: 1290,
      backgroundColor: theme.palette.secondary.dark,
      backgroundImage: 'none',
    },
    titleRow: {
      display: 'flex',
      alignItems: 'baseline',
      gap: theme.spacing(0.75),
      minWidth: 0,
    },
    title: {
      flexShrink: 0,
      fontSize: '0.85rem',
      textTransform: 'uppercase',
      letterSpacing: '4px',
      color: theme.palette.primary.light,
      fontWeight: 700,
    },
    titleSuffix: {
      minWidth: 0,
      fontSize: '0.68rem',
      textTransform: 'uppercase',
      letterSpacing: '1.1px',
      color: '#d4af37',
      fontWeight: 700,
      lineHeight: 1.1,
      textShadow: '0 0 10px rgba(212, 175, 55, 0.18)',
    },
    version: {
      flexGrow: 1,
      color: theme.palette.text.disabled,
    },
    updateAvailable: {
      flexGrow: 1,
      color: '#20cc76',
    },
    toolbar: {
      minHeight: toolbarHeight,
      maxHeight: toolbarHeight,
      '-webkit-app-region': 'drag',
      paddingBottom: resizeHandleContainerHeight,
    },
    hide: {
      display: 'none',
    },
    resizeHandleContainer: {
      height: resizeHandleContainerHeight,
    },
    updateLink: {
      color: primaryLighter,
    },
    noDrag: {
      '-webkit-app-region': 'no-drag',
      cursor: 'pointer',
    },
    isActive: {
      backgroundColor: theme.palette.background.paper,
    },
    windowHandlerButton: {
      display: 'flex',
      alignItems: 'center',
      width: 40,
      justifyContent: 'center',
      height: resizeHandleContainerHeight + toolbarHeight,
      '&:hover': {
        backgroundColor: theme.palette.background.paper,
      },
    },
    exit: {
      '&:hover': {
        backgroundColor: theme.palette.error.dark,
      },
    },
    windowHandlers: {
      display: 'flex',
      alignItems: 'center',
    },
    windowIcon: {
      fontSize: 14,
      marginRight: theme.spacing(1),
      marginLeft: theme.spacing(1),
      cursor: 'pointer',
    },
    support: {
      fontSize: 18,
    },
  })
);

export default useStyles;
