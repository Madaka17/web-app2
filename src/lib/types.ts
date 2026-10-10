export type ThemeMode = "dark" | "light";

export type PageId = "predictor" | "map" | "pipeline" | "metrics" | "image-valuation" | "used-homes";

export type PropertyType = "condo" | "house" | "townhome" | "land";

/** Exactly the columns the trained model has — see ml/prepare_data.py FEATURES. */
export interface PredictionInput {
  propertyType: PropertyType;
  area: number;
  nUnits: number;
  year: number;
  subdistrictId: string;
  /** A map click; when set the API locates the property from it, not subdistrictId. */
  lat?: number;
  lng?: number;
  bedrooms?: number;
  bathrooms?: number;
  /** Years since completion; drives the ค่าเสื่อม (depreciation) adjustment. */
  buildingAge?: number;
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
