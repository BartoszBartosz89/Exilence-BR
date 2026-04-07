import {
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { useStores } from '../../../..';
import CheckboxSetting from '../../components/checkbox-setting/CheckboxSetting';
import NumberInputSetting from '../../components/number-input-setting/NumberInputSetting';

const pricingModelOptions = [
  { value: 'traditional', label: 'Traditional prices' },
  { value: 'poedb_open', label: 'PoEDB Open' },
  { value: 'poedb_close', label: 'PoEDB Close' },
  { value: 'poedb_low', label: 'PoEDB Low' },
  { value: 'poedb_high', label: 'PoEDB High' },
];

const NetWorthSettings = () => {
  const { settingStore, poeDbPriceStore } = useStores();

  const poedbDates = poeDbPriceStore.availableDates;
  const poedbModelActive = settingStore.pricingModel !== 'traditional';

  const handlePricingModelChange = (event: SelectChangeEvent<string>) => {
    const model = event.target.value as any;
    settingStore.setPricingModel(model);
    if (model !== 'traditional' && !settingStore.poedbPricingDate && poedbDates.length > 0) {
      settingStore.setPoedbPricingDate(poedbDates[poedbDates.length - 1]);
    }
  };

  const handlePoedbDateChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    settingStore.setPoedbPricingDate(value || undefined);
  };

  return (
    <Grid container spacing={5}>
      <Grid item>
        <CheckboxSetting
          value={settingStore!.lowConfidencePricing}
          handleChange={(value: boolean) => settingStore!.setLowConfidencePricing(value)}
          translationKey="low_confidence_pricing"
          requiresSnapshot
        />
      </Grid>
      <Grid item>
        <NumberInputSetting
          value={settingStore!.priceThreshold}
          handleChange={(value: number) => settingStore!.setPriceThreshold(value)}
          translationKey="price_threshold"
          minimum={0}
          maximum={100}
          suffixKey="unit.chaos"
          requiresSnapshot
        />
      </Grid>
      <Grid item>
        <NumberInputSetting
          value={settingStore!.totalPriceThreshold}
          handleChange={(value: number) => settingStore!.setTotalPriceThreshold(value)}
          translationKey="total_price_threshold"
          minimum={0}
          maximum={5000}
          suffixKey="unit.chaos"
          requiresSnapshot
        />
      </Grid>
      <Grid item>
        <FormControl variant="standard" sx={{ minWidth: 220 }}>
          <InputLabel id="pricing-model-label">Pricing model *</InputLabel>
          <Select
            labelId="pricing-model-label"
            id="pricing-model"
            value={settingStore.pricingModel}
            onChange={handlePricingModelChange}
            label="Pricing model"
          >
            {pricingModelOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            Custom prices always win. PoEDB model falls back to traditional when missing.
          </FormHelperText>
        </FormControl>
      </Grid>
      <Grid item>
        <FormControl variant="standard" sx={{ minWidth: 220 }} disabled={!poedbModelActive}>
          <InputLabel id="pricing-date-label">PoEDB date *</InputLabel>
          <Select
            labelId="pricing-date-label"
            id="pricing-date"
            value={settingStore.poedbPricingDate || ''}
            onChange={handlePoedbDateChange}
            label="PoEDB date"
          >
            <MenuItem value="">
              <em>Latest available</em>
            </MenuItem>
            {poedbDates.map((date) => (
              <MenuItem key={date} value={date}>
                {date}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>Used only when a PoEDB pricing model is selected.</FormHelperText>
        </FormControl>
      </Grid>
    </Grid>
  );
};

export default observer(NetWorthSettings);
