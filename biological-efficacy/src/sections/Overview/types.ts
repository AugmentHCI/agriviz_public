export interface Correlation {
  prop: string;
  agg_time: string;
  agg_value: string;
  source: string;
  value: number;
}

export interface CorrResult {
  lab_prop: string;
  lab_prop_abr: string;
  correlations: Correlation[];
}

export interface Query {
  lab_prop_type: string;
  top_k: number;
}

export interface CorrResultData {
  query: Query;
  results: CorrResult[];
}

export interface PropResult {
  property: string;
  value: string;
}

export interface LabResult {
  year: string;
  lab_prop_type: string;
  results: PropResult[];
}

export interface BasicField {
  sample_id: string;
  Vineyard: string;
  Variety: string;
  Region: string;
  City: string;
  "geocledian_Parcel ID": string;
  lat: number;
  lon: number;
  lab_results: LabResult[];
}

export interface Aggregation {
  prop: string;
  agg_time: string;
  agg_value: string;
  source: string;
  value: number;
  parcel_id?: number;
  year?: number;
}

type Year = string;

export interface FieldResult {
  "geocledian_Parcel ID": number;
  results: Record<Year, Aggregation[]>;
}

export interface Field extends BasicField {
  results: Record<Year, Aggregation[]>;
}
