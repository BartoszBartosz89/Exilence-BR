import { AccountStore } from './accountStore';
import { CustomPriceStore } from './customPriceStore';
import { SignalrHub } from './domains/signalr-hub';
import { LeagueStore } from './leagueStore';
import { LogStore } from './logStore';
import { MigrationStore } from './migrationStore';
import { NetWorthArchiveStore } from './netWorthArchiveStore';
import { NotificationStore } from './notificationStore';
import { OverlayStore } from './overlayStore';
import { PriceStore } from './priceStore';
import { PoeDbPriceStore } from './poeDbPriceStore';
import { RateLimitStore } from './rateLimitStore';
import { RouteStore } from './routeStore';
import { SettingStore } from './settingStore';
import { SignalrStore } from './signalrStore';
import { StrategyReviewerStore } from './strategyReviewerStore';
import { UiStateStore } from './uiStateStore';
import { UpdateStore } from './updateStore';

export class RootStore {
  uiStateStore: UiStateStore;
  accountStore: AccountStore;
  signalrHub: SignalrHub;
  settingStore: SettingStore;
  routeStore: RouteStore;
  migrationStore: MigrationStore;
  netWorthArchiveStore: NetWorthArchiveStore;
  updateStore: UpdateStore;
  leagueStore: LeagueStore;
  notificationStore: NotificationStore;
  signalrStore: SignalrStore;
  strategyReviewerStore: StrategyReviewerStore;
  priceStore: PriceStore;
  overlayStore: OverlayStore;
  logStore: LogStore;
  customPriceStore: CustomPriceStore;
  rateLimitStore: RateLimitStore;
  poeDbPriceStore: PoeDbPriceStore;

  constructor() {
    this.uiStateStore = new UiStateStore(this);
    this.accountStore = new AccountStore(this);
    this.signalrHub = new SignalrHub(this);
    this.settingStore = new SettingStore(this);
    this.routeStore = new RouteStore(this);
    this.migrationStore = new MigrationStore(this);
    this.netWorthArchiveStore = new NetWorthArchiveStore(this);
    this.updateStore = new UpdateStore(this);
    this.leagueStore = new LeagueStore(this);
    this.notificationStore = new NotificationStore(this);
    this.signalrStore = new SignalrStore(this);
    this.strategyReviewerStore = new StrategyReviewerStore(this);
    this.priceStore = new PriceStore(this);
    this.overlayStore = new OverlayStore(this);
    this.logStore = new LogStore(this);
    this.customPriceStore = new CustomPriceStore(this);
    this.rateLimitStore = new RateLimitStore(this);
    this.poeDbPriceStore = new PoeDbPriceStore(this);
  }
}
