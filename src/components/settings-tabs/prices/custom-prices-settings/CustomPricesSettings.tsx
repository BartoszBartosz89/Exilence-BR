import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { Box, Button, Grid, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { useStores } from '../../../..';
import ConfirmationDialog from '../../../confirmation-dialog/ConfirmationDialog';
import PriceTableContainer from '../../../price-table/PriceTableContainer';

const CustomPricesSettings = () => {
  const { uiStateStore, customPriceStore, accountStore } = useStores();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const activeLeagueId =
    uiStateStore.selectedPriceTableLeagueId ||
    accountStore.getSelectedAccount.activeProfile?.activePriceLeagueId;

  const activeLeagueCustomCount = activeLeagueId
    ? customPriceStore.customLeaguePrices.find((lp) => lp.leagueId === activeLeagueId)?.prices
        .length || 0
    : 0;

  const clearAllForLeague = () => {
    if (!activeLeagueId) {
      setConfirmOpen(false);
      return;
    }
    customPriceStore.clearCustomPricesForLeague(activeLeagueId);
    setConfirmOpen(false);
  };

  return (
    <>
      {uiStateStore.initiated && uiStateStore.validated ? (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={2}
            >
              <Typography variant="body2" color="textSecondary">
                Active league custom prices: {activeLeagueCustomCount}
              </Typography>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<DeleteSweepIcon />}
                disabled={!activeLeagueId || activeLeagueCustomCount === 0}
                onClick={() => setConfirmOpen(true)}
              >
                Clear all custom prices
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <PriceTableContainer />
          </Grid>

          <ConfirmationDialog
            show={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={clearAllForLeague}
            title="Clear custom prices"
            body="This will remove all custom prices for the active pricing league. Continue?"
            acceptButtonText="Clear"
            cancelButtonText="Cancel"
          />
        </Grid>
      ) : (
        <>Waiting for response from price source...</>
      )}
    </>
  );
};

export default observer(CustomPricesSettings);
