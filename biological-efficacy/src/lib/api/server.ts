import {
  CorrResultData,
  FieldResult,
  BasicField,
} from "../../sections/Overview/types";

interface Query {
  lab_prop_type: string;
  top_k: number;
}

export const server = {
  fetchCorrelations: async (query: Query): Promise<CorrResultData> => {
    // http://barbera4.isti.cnr.it:8080/api/v2/correlation/all/maceration?topk=10
    // http://barbera4.isti.cnr.it:8080/api/v2/correlation/all/ultrasound?topk=10
    const res = await fetch(`../../../data/${query.lab_prop_type}.json`);

    return res.json() as Promise<CorrResultData>;
  },
  fetchFields: async (): Promise<BasicField[]> => {
    const res = await fetch("../../../data/parcels.json");
    return res.json() as Promise<BasicField[]>;
  },
  fetchResults: async (): Promise<FieldResult[]> => {
    // http://barbera4.isti.cnr.it:8080/api/v2/agg_values
    const res = await fetch("../../../data/agg_values.json");

    return res.json() as Promise<FieldResult[]>;
  },
};
