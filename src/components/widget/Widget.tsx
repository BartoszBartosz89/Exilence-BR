import { Paper, Skeleton } from '@mui/material';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import React, { ReactNode } from 'react';
import { cardHeight } from '../../routes/net-worth/NetWorth';
import useStyles from './Widget.styles';

type WidgetProps = {
  backgroundColor?: string;
  textColor?: string;
  height?: number | string;
  compact?: boolean;
  center?: boolean;
  loading?: boolean;
  children: ReactNode;
};

const Widget = ({
  children,
  backgroundColor,
  textColor,
  height = cardHeight,
  compact,
  loading,
  center,
}: WidgetProps) => {
  const classes = useStyles();
  const widgetHeight = typeof height === 'undefined' ? cardHeight : height;

  return (
    <>
      {loading ? (
        <Skeleton variant="rectangular" height={widgetHeight} />
      ) : (
        <Paper
          className={clsx(classes.paper, {
            [classes.noPadding]: compact,
            [classes.centered]: center,
          })}
          style={{ background: backgroundColor, color: textColor, height: widgetHeight }}
        >
          {children}
        </Paper>
      )}
    </>
  );
};

export default observer(Widget);
