import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles((theme) => ({
  Wrapper: {
    display: 'flex',
    margin: theme.spacing(1),
    width: '100%',
    height: '100%',
    minHeight: 0,
  },
}));

export default useStyles;
