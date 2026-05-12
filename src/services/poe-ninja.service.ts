import axios, { AxiosResponse } from 'axios';
import { forkJoin, from, of } from 'rxjs';
import RateLimiter from 'rxjs-ratelimiter';
import { catchError, map } from 'rxjs/operators';
import { IExternalPrice } from '../interfaces/external-price.interface';
import { IPoeNinjaItemOverview } from '../interfaces/poe-ninja/poe-ninja-item-overview.interface';
import { IPoeNinjaItemOverviewLine } from '../interfaces/poe-ninja/poe-ninja-item-overview-line.interface';
import {
  getExternalPriceFromNinjaCurrencyItem,
  getExternalPriceFromNinjaItem,
} from '../utils/price.utils';
import { IPoeNinjaCurrencyOverview } from './../interfaces/poe-ninja/poe-ninja-currency-overview.interface';

const rateLimiter = new RateLimiter(1, 1);
const apiUrl = 'https://poe.ninja/poe1/api/economy';
const divinationCardIconUrl =
  'https://web.poecdn.com/image/Art/2DItems/Divination/InventoryIcon.png?scale=1&w=1&h=1';

export const poeninjaService = {
  getCurrencyCategories,
  getItemCategories,
  getItemCategoryOverview,
  getCurrencyCategoryOverview,
  getItemPrices,
  getCurrencyPrices,
};

function getCurrencyCategories() {
  const categories = ['Currency', 'Fragment'];
  return categories;
}

function getItemCategories() {
  // commented categories are mostly in accuracy pricing
  const categories = [
    'Oil',
    'Incubator',
    'Scarab',
    'Fossil',
    'Resonator',
    'Essence',
    'DivinationCard',
    //'Prophecy',
    'SkillGem',
    'Tattoo',
    'Omen',
    'UniqueMap',
    'Map',
    'UniqueJewel',
    'UniqueFlask',
    'UniqueWeapon',
    'UniqueArmour',
    'UniqueRelic',
    //'Watchstone',
    'UniqueAccessory',
    'DeliriumOrb',
    'Beast',
    'Vial',
    'Invitation',
    'Artifact',
    'Memory',
    //'ClusterJewel',
    'BlightedMap',
    'BlightRavagedMap',
    'Coffin',
    'AllflameEmber',
    //'BaseType',
    //'HelmetEnchant',
    'Runegraft',
  ];
  return categories;
}

function getItemCategoryOverview(league: string, type: string) {
  const parameters = `?league=${encodeURIComponent(league)}&type=${type}`;
  const endpoint = getExchangeItemCategories().includes(type)
    ? 'exchange/current/overview'
    : 'stash/current/item/overview';
  return rateLimiter.limit(
    from(axios.get<IPoeNinjaItemOverview>(`${apiUrl}/${endpoint}${parameters}`))
  );
}

function getCurrencyCategoryOverview(league: string, type: string) {
  const parameters = `?league=${encodeURIComponent(league)}&type=${type}`;
  return rateLimiter.limit(
    from(
      axios.get<IPoeNinjaCurrencyOverview>(`${apiUrl}/stash/current/currency/overview${parameters}`)
    )
  );
}

function getItemPrices(league: string) {
  return forkJoin(
    getItemCategories().map((type) => {
      return getItemCategoryOverview(league, type).pipe(
        map((response: AxiosResponse<IPoeNinjaItemOverview | IPoeNinjaExchangeOverview>) => {
          if (response.data) {
            const lines = isExchangeOverview(response.data)
              ? mapExchangeOverviewLines(response.data, type)
              : response.data.lines;
            return lines.map((lines) => {
              return getExternalPriceFromNinjaItem(lines, type, league) as IExternalPrice;
            });
          } else {
            return []; // no prices found on ninja
          }
        }),
        catchError(() => of([] as IExternalPrice[]))
      );
    })
  ).pipe(map((arrays) => arrays.reduce((acc, array) => [...acc, ...array], [])));
}

function getCurrencyPrices(league: string) {
  return forkJoin(
    getCurrencyCategories().map((type) => {
      return getCurrencyCategoryOverview(league, type).pipe(
        map((response: AxiosResponse<IPoeNinjaCurrencyOverview>) => {
          if (response.data) {
            return response.data.lines.map((lines) => {
              const currencyDetail = response.data.currencyDetails.find(
                (detail) => detail.name === lines.currencyTypeName
              );
              return getExternalPriceFromNinjaCurrencyItem(
                lines,
                currencyDetail,
                type,
                league
              ) as IExternalPrice;
            });
          } else {
            return []; // no prices found on ninja
          }
        }),
        catchError(() => of([] as IExternalPrice[]))
      );
    })
  ).pipe(map((arrays) => arrays.reduce((acc, array) => [...acc, ...array], [])));
}

function getExchangeItemCategories() {
  return [
    'AllflameEmber',
    'Artifact',
    'DeliriumOrb',
    'DivinationCard',
    'DjinnCoin',
    'Essence',
    'Fossil',
    'Omen',
    'Oil',
    'Resonator',
    'Runegraft',
    'Scarab',
    'Tattoo',
  ];
}

function isExchangeOverview(
  overview: IPoeNinjaItemOverview | IPoeNinjaExchangeOverview
): overview is IPoeNinjaExchangeOverview {
  return Array.isArray((overview as IPoeNinjaExchangeOverview).items);
}

function mapExchangeOverviewLines(
  overview: IPoeNinjaExchangeOverview,
  type: string
): IPoeNinjaItemOverviewLine[] {
  return overview.lines.reduce((acc: IPoeNinjaItemOverviewLine[], line) => {
    const item = overview.items.find((i) => i.id === line.id);
    if (!item) {
      return acc;
    }
    acc.push({
      id: 0,
      name: item.name,
      icon: getIconUrl(item.image, type),
      mapTier: 0,
      levelRequired: 0,
      stackSize: 0,
      variant: '',
      links: 0,
      itemClass: getItemClass(type),
      sparkline: line.sparkline,
      lowConfidenceSparkline: line.sparkline,
      implicitModifiers: [],
      explicitModifiers: [],
      flavourText: '',
      corrupted: false,
      gemLevel: 0,
      gemQuality: 0,
      itemType: type,
      chaosValue: line.primaryValue,
      exaltedValue: 0,
      count: line.volumePrimaryValue,
      detailsId: item.detailsId,
    });
    return acc;
  }, []);
}

function getIconUrl(icon?: string, type?: string) {
  if (!icon) {
    if (type === 'DivinationCard') {
      return divinationCardIconUrl;
    }
    return '';
  }
  return icon.startsWith('/') ? `https://web.poecdn.com${icon}` : icon;
}

function getItemClass(type: string) {
  if (type === 'DivinationCard') {
    return 6;
  }
  return 5;
}

interface IPoeNinjaExchangeOverview {
  lines: IPoeNinjaExchangeOverviewLine[];
  items: IPoeNinjaExchangeOverviewItem[];
}

interface IPoeNinjaExchangeOverviewLine {
  id: string;
  primaryValue: number;
  volumePrimaryValue: number;
  sparkline: {
    totalChange: number;
    data: number[];
  };
}

interface IPoeNinjaExchangeOverviewItem {
  id: string;
  name: string;
  image?: string;
  detailsId: string;
}
