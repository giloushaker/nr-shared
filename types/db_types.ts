import type { ObjectId } from "bson";

import type {
  SetupCategory,
  IArmyBook,
  IArmyRoster,
  ReportRoster,
} from "../systems/army_interfaces";

import type { PatchIndex } from "../battlescribe/bs_helpers";
import type { BSICost } from "../battlescribe/bs_types";
import type { BooksDate } from "../battlescribe/bs_versioning";

import type { StateOptions } from "./stateOptions";
import type { ScoringSystem } from "../systems/bs_game_system";

export interface GameSystemRow {
  _id: string | ObjectId;
  last_updated?: string;
  id: number;
  bsid?: string;

  name: string;
  short: string;
  version?: number;
  nrversion: number;

  id_unit_stats?: number;
  id_spells?: number;
  id_rules_def?: number;

  books: BookRow[];
  path: string;

  engine?: string;
  meta?: string;
  wiki?: boolean;
  wikiLastUpdated?: string;

  settings?: {
    defaultMaxCosts?: Record<string, number>;
    patch?: PatchIndex;
    profileFilter?: string;
    sizes?: Record<
      string,
      { type: string; size: { w: number; h: number; r: boolean } }
    >;
    major?: Record<string, Array<{ name: string; date: string }>>;
    score?: ScoringSystem[];
    setup_categories?: Record<string, SetupCategory>;
    icons?: {
      army_icons: Icons;
      category_icons: Icons;
    };
    exportFormats?: string[];
    extractModelCountFromName?: boolean;
    characteristicDefinesModel?: string;
  };
}
export interface BookRow {
  _id?: string;
  bsid?: string;
  id: number;
  id_game_system: number;

  name: string;
  short: string;
  filename: string;
  playable: boolean;
  permission?: number;

  nrversion: number;
  last_updated?: string;

  translation?: Record<string, string>;
  meta?: string;
}

interface SavedEntry {
  amount: number;
  option_id: string;
  options: SavedEntry[];
}
interface SavedArmy extends SavedEntry {
  maxCost: number;
  totalCost?: number;
}

export interface ListRow {
  _id: string;
  date_mod: Date | string;
  totalCost?: number | null;
  list_key: string;
  id_system: number;
  name: string;
  version: number;
  nrversion: number;
  id_owner?: string | ObjectId;
  id_report?: string | ObjectId;
  id_tourny?: string | ObjectId;
  original_key?: string;
  original_version?: number;
  client_key?: string;
  synced?: boolean;
  army?: IArmyRoster | null;
  id_book?: number;
  book?: IArmyBook;
  totalCosts?: BSICost[];

  /** Id of books which this needs to load*/
  booksToLoad?: number[];
  /** Index of [`book_id`]: date {@type string} which can be used to overwrite the date a book will be loaded at*/
  booksDate?: BooksDate;
  /** Will use booksDate if this is true */
  isFrozen?: boolean;

  text?: string;
}
export interface LoadedListRow extends ListRow {
  army: IArmyRoster;
  source: ListRow;
}
export interface SubRow {
  type?: number;
  expiration?: Date;
  pending?: boolean;
  cid?: string | null; // Customer ID
  pid?: string | null; // Last used payment method
  renew?: boolean;
}
export interface IndexAndArray<T> {
  index: Record<any, T>;
  array: T[];
}

/**
 * @alias [UserRow]
 * @interface [UserRow]
 */
export interface UserRow {
  user_data_version: number;
  _id: string;
  login: string;
  real_name?: string;
  country?: CountryRow;
  timezone?: TimezoneRow;
  email: string;
  permission: number;
  options: StateOptions;
  sub?: SubRow;
  last_connection?: Date;
  elo?: any;
  discord_username?: string;
  discord_id?: string;
  password?: string;
  client_version?: string;
  news_checked?: Date;
  id_stripe_connect?: string;
  linked_cids?: Record<string, string>;
  warhall_token?: string;
  warhall_salt?: string;
}

export interface TeamRow {
  _id: string | ObjectId;
  name: string;
  password?: string;
  status: number;
  participants: ObjectId[];
  id_captain?: string;
  id_sales?: string;
}

export interface TournamentRow {
  _id: string | ObjectId;
  name: string;
  short: string;
  participants: number;
  participants_per_team: number;
  team_proposals: number;
  pairings_type: number;
  team_point_cap: number;
  team_point_min: number;
  start: Date;
  end: Date;
  status: number;
  showlists: boolean;
  full: boolean;
  discord_notify_reports: boolean;
  address: string;
  price: number;
  currency: string;
  description: string;
  rules: string;
  tables: number;
  group_size: number;
  group_winners: number;
  group_win_condition: number;
  group_letters: boolean;
  group_wildcard_players: boolean;
  roundNumber: number;
  confirmed_participants: number;
  type: number;
  currentRound: number;
  id_game_system: number;
  enforce_discord: boolean;
  enforce_real_name: boolean;
  scoring_system?: number;
  hide_incomplete_round_results?: boolean;

  /** Array of ObjectIds corresponding to {@link UserRow}  */
  id_owner: (string | ObjectId)[];
  id_notification_subscribers: (string | ObjectId)[];
  visibility: number;
  version: number;
  participant_list: ParticipantRow[];
  pairing_groups: Array<any>;
  teams?: Array<TeamRow>;
  mod_date: Date;
  groups?: Array<any>;
  matches: Array<TournamentMatchRow>;
  rounds: Array<any>;
  country: CountryRow;

  payment_settings?: TournyPaymentSettings;
  creation_date?: Date;
  defaultBooksDate?: string;
  booksDate?: BooksDate;

  hide_list_from_admins: boolean;
  enforce_online_payment: boolean;
  allow_participant_report_delete: boolean;

  log: TournamentLogRow[];
}

export interface ParticipantListRow {
  list_key: string;
  hidden: boolean;
  validated: boolean | null;
  errors?: string[];
}

export interface ParticipantRow {
  discord?: {
    discord_username: string;
    discord_id: string;
  };
  _id: string | ObjectId;
  status: number;
  lists: Array<ParticipantListRow>;
  name: string;
  real_name?: string;
  list_number: number;
  extra_points: ExtraPoints[];
  locked: boolean;

  email?: string | null;
  loadedLists?: ParticipantList[];
  id_member?: string | ObjectId;
  id_sales?: string;
  country?: CountryRow;
}

export interface PairingGroupRow {
  _id?: string | ObjectId;
  name: string;
  rounds: number[];
  participants: Array<string | ObjectId>;
  weight: number;
}

export interface TournamentMatchRow {
  _id: string | ObjectId;
  participants: Array<string | ObjectId | null>;
  status: number | null;
  round: number;
  id_map?: number;
  id_objective?: number;
  id_deployment?: number;
  setup: Record<string, number>;
  id_report: string | ObjectId | null;
  type: number;
  walkover: number;

  // Fields for team matches
  pairings_type?: number;
  id_parent?: string | ObjectId | null;
  proposed_matches?: string[] | ObjectId[];
  bench?: string[][] | ObjectId[][];
}

export interface TournamentHistoryElement {
  _id: string;
  name: string;
  start: Date;
  type: number;
  rankings?: JsonRanking;
}

export interface WarhallTournamentMatch {
  _id: string;
  participants: Array<{ name: string; _id: string }>;
  round: number;
  id_report: string | null;
}

export interface CountryRow {
  _id: string | ObjectId;
  name: string;
  flag: string;
}

export interface ReportPlayer {
  name?: string;
  alias?: string;
  id_member?: string | null | ObjectId;
  id_list: string | ObjectId | null;
  report_list: ReportRoster | null;
  id_book: number | null;
  id_participant?: string | ObjectId;
  elo?: SimpleEloRecord;
}

export interface ReportRow {
  _id: string | ObjectId;
  submitter_id?: string | ObjectId;
  type: number;
  id_tourny?: string | ObjectId;
  id_match?: string | ObjectId;
  id_game_system: number;
  players: ReportPlayer[];
  score: ReportScore;
  confirmation_id?: string | ObjectId;
  date: Date;
  first_turn?: number;
  confirmed?: boolean | null;
  setup?: Record<string, number>;
  ignore_stats?: boolean;
  handshake?: boolean;
}

export interface OldReportPlayer {
  id: string | ObjectId | null;
  id_book?: number | null;
  list?: ReportRoster;
  elo?: EloRecord;
  won_objective?: boolean;
  first_turn?: boolean;
  started_north?: boolean;
  id_participant?: string | ObjectId;
}

export interface OldReportRow {
  _id: string | ObjectId;
  submitter_id?: string | ObjectId;
  type?: number;
  id_map?: number;
  id_objective?: number;
  id_deployment?: number;
  draw?: boolean;
  id_tourny?: string | ObjectId;
  id_match?: string | ObjectId;
  id_game_system: number;

  loser: OldReportPlayer;
  winner: OldReportPlayer;
  confirmation_id?: string | ObjectId;
  date: Date;
  battle_points: { win?: number; lose?: number; abandon?: boolean };
  vp?: number[];
}

export interface ProductRow {
  _id: string | ObjectId;
  name: string;
  price?: number;
  duration?: number;
  type?: number;
  donation?: boolean;
  ticket?: boolean;
  id_tourny?: string | ObjectId;
}

export interface SalesRow {
  _id: string | ObjectId;
  id_intent: string;
  account_id?: string;
  product: ProductRow;
  id_owner: string | ObjectId;
  status: number;
  renew: boolean;
  date: Date;
}

export interface CardInformation {
  id: string;
  last4: string;
  expiry: string;
}

export interface SepaInformation {
  id: string;
  last4: string | null;
  bank_code: string | null;
}
export interface SaleInformation {
  secret: string | null;
  product: ProductRow;
}

export type WithId<T> = {
  _id: ObjectId;
} & Omit<T, "_id">;

export type StringId<T> = {
  _id: ObjectId;
} & Omit<T, "_id">;

export type StringOrObjectId<T> = {
  _id: ObjectId | string;
} & Omit<T, "_id">;

export type OptionalId<T> = {
  _id?: ObjectId | string;
} & Omit<T, "_id">;

export interface LeagueRow {
  _id: string | null;
  name: string;
  id_owner: string | ObjectId;
  tournies: string[];
  id_system: number;
}

export type ReportScore = Record<string, number | null>[];

export enum TournamentLogTypes {
  PAIRINGS_GENERATED = 0,
  PAIRINGS_CLEARED = 1,
  PAIRING_SET = 2,
  PAIRING_UNSET = 3,
  MATCH_DELETED = 4,
  MATCH_CREATED = 5,
}
export interface TournamentLogRowMatch {
  _id: string | ObjectId;
  round: number;
  participants: (string | ObjectId | null)[];
}

export interface TournamentLogRow {
  type: number;
  date: Date;
  matches?: TournamentLogRowMatch[];
  pairing_log?: string[];
}

export interface TimezoneRow {
  value: string;
  abbr: string;
  offset: number;
  iddst: false;
  text: string;
  utc: string[];
}

export interface Icons {
  field: string;
  icons: Record<string, string>;
}

export interface EloDetails {
  elo: number;
  rank: number;
  deviation: number;
  wins: number;
  losses: number;
  draws: number;
  score: number;
  books: Record<number, number>;
}

export interface EloRecord extends Record<string, EloDetails> {
  friendly: EloDetails;
  tourny: EloDetails;
}

export interface SimpleEloRecord extends Record<string, number> {
  friendly: number;
  tourny: number;
}

export type PlayerElo = Record<number, EloRecord>;

export interface JsonRanking {
  id_member: string | ObjectId;
  id_participant: string | ObjectId;
  wins: number;
  losses: number;
  score: number;
  uncapped: number;
  extra: number;
  rank: number;
  total: number;
  secondary: Record<string, number>;
}

export interface TournyPaymentSettings {
  fee: number;
  percentFee: number;
  extraFree: number;
  enabled: boolean;
  users_pay: boolean;
  account_id?: string;
  individual_teams_payment?: boolean;
}

export interface ParticipantList {
  list: ListRow;
  validated: boolean | null;
  hidden: boolean;
  errors?: string[];
}

export interface ExtraPoints {
  reason: string;
  amount: number;
  stage: number | undefined;
  pairings: boolean | undefined;
}
