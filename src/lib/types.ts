export type ThemeMode = "dark" | "light";

export type PageId = "predictor" | "pipeline" | "metrics" | "image-valuation" | "used-homes";

export type PropertyType = "condo" | "house" | "townhome" | "land";

/** Exactly the columns the trained model has — see ml/prepare_data.py FEATURES. */
export interface PredictionInput {
  propertyType: PropertyType;
  area: number;
  nUnits: number;
  year: number;
  subdistrictId: string;
}

export interface ModelContribution {
  name: string;
  weight: number;
  color: string;
  prediction: number;
}

export interface FeatureImportance {
  label: string;
  value: number;
  icon: string;
}

export interface MarketEstimate {
  price: number;
  ratio: number;
  listings: number;
  scope: string;
  basis: string;
}

export interface PredictionResult {
  predictedPrice: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  contributions: ModelContribution[];
  features: FeatureImportance[];
  // null until Data/build_market_ratio.py has enough listings to back a figure.
  market: MarketEstimate | null;
}

export type PipelineStatus = "building" | "validating" | "review" | "ready";

export interface PipelineStage {
  id: PipelineStatus;
  title: string;
  subtitle: string;
  state: "done" | "active" | "queued";
  progress: number;
  tasks: string[];
  badge: { label: string; tone: "green" | "yellow" | "blue" | "gray" };
}

export interface ModelMetric {
  name: string;
  shortName: string;
  color: string;
  rmse: number;
  mae: number;
  r2: number;
  mape: number;
  inferenceMs: number;
  weight: number;
  strengths: string[];
}
