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

export interface PredictionResult {
  predictedPrice: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  contributions: ModelContribution[];
  features: FeatureImportance[];
}
