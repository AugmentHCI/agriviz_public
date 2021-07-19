import React, { useState, useEffect } from "react";
import {
  Drawer,
  Layout,
  Row,
  Col,
  Radio,
  Select,
  List,
  Empty,
  Button,
  Space,
} from "antd";
import { Vega } from "react-vega";

import { DrawerContent } from "./components";

import { server } from "../../lib/api";
import { Field, CorrResult, Correlation } from "./types";
import { RadioChangeEvent } from "antd/lib/radio";
const { Header, Content } = Layout;
const { Option } = Select;

const spec = {
  $schema: "https://vega.github.io/schema/vega/v5.json",
  autosize: { type: "fit-x", contains: "padding" },
  background: "transparent",
  padding: 5,
  height: 350,
  style: "cell",
  data: [
    {
      name: "correlations",
      transform: [
        {
          type: "formula",
          expr: "datum.prop + datum.agg_value + datum.agg_time",
          as: "key",
        },
        {
          type: "formula",
          expr: "datum.prop + ' (' + datum.agg_value + ')'",
          as: "label",
        },
        { type: "formula", expr: "abs(datum.value)", as: "abs_value" },
      ],
    },
  ],
  signals: [
    {
      name: "click",
      value: null,
      on: [{ events: "*:click", update: "datum" }],
    },
    {
      name: "width",
      init: "isFinite(containerSize()[0]) ? containerSize()[0] : 200",
      on: [
        {
          update: "isFinite(containerSize()[0]) ? containerSize()[0] : 200",
          events: "window:resize",
        },
      ],
    },
  ],
  marks: [
    {
      name: "bar",
      type: "rect",
      from: { data: "correlations" },
      encode: {
        enter: {
          x: { scale: "xscale", value: 0 },
          x2: { scale: "xscale", field: "abs_value" },
          y: { scale: "yscale", field: "key" },
          height: { scale: "yscale", band: 1 },
          fill: { scale: "cscale", field: "agg_time" },
        },
        update: {
          opacity: [
            { test: "!click || datum.key == click.key", value: 1 },
            { value: 0.33 },
          ],
        },
      },
    },
    {
      name: "label_text",
      type: "text",
      from: { data: "correlations" },
      encode: {
        enter: {
          align: { value: "left" },
          fill: { value: "white" },
          x: { value: 5 },
          y: { scale: "yscale", field: "key", band: 0.5 },
          text: { field: "label" },
          baseline: { value: "middle" },
        },
      },
    },
    {
      name: "value_text",
      type: "text",
      from: { data: "correlations" },
      encode: {
        enter: {
          align: { value: "left" },
          fill: { value: "black" },
          x: { scale: "xscale", field: "abs_value" },
          dx: { value: 5 },
          y: { scale: "yscale", field: "key", band: 0.5 },
          text: { signal: "format(datum.value, '.2f')" },
          baseline: { value: "middle" },
        },
        update: {
          opacity: [
            { test: "!click || datum.key == click.key", value: 1 },
            { value: 0.33 },
          ],
        },
      },
    },
  ],
  scales: [
    {
      name: "yscale",
      type: "band",
      domain: { data: "correlations", field: "key" },
      range: "height",
      padding: 0.2,
      round: true,
    },
    { name: "xscale", domain: [0, 1], range: "width" },
    {
      name: "cscale",
      type: "ordinal",
      domain: ["March", "April", "May", "June"],
      range: "category",
    },
  ],
  legends: [
    { fill: "cscale", symbolType: "square", title: "From January until..." },
  ],
};

export const Overview = () => {
  //
  const [fields, setFields] = useState<Field[]>([]);
  const [orderedFields, setOrderedFields] = useState<Field[]>([]);

  // Origin
  const [labOrigin, setLabOrigin] = useState<string>("maceration");
  const [fetchedLabOrigin, setFetchedLabOrigin] = useState<string>("");
  // Properties
  const [labProperties, setLabProperties] = useState<CorrResult[]>([]);
  const [labProperty, setLabProperty] = useState<string | null>(null);
  const [labPropertyFull, setLabPropertyFull] = useState<string | null>(null);
  // Correlations
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [correlation, setCorrelation] = useState<Correlation | null>(null);
  // Drawer
  const [drawerVisibility, setDrawerVisibility] = useState<boolean>(false);
  const [drawerField, setDrawerField] = useState<Field | null>(null);

  // Fetch field
  useEffect(() => {
    const fetchFields = async () => {
      let fields = await server.fetchFields();
      let results = await server.fetchResults();

      let data: Field[] = fields.map(function (field) {
        var result = results.filter(function (values) {
          return (
            values["geocledian_Parcel ID"] ===
            parseInt(field["geocledian_Parcel ID"].split(" - ")[0])
          );
        });
        return {
          ...field,
          results: result[0] !== undefined ? result[0].results : {},
        };
      });
      setFields(data);
    };

    fetchFields();
  }, []);

  // Fetch correlations & setLabProperties
  useEffect(() => {
    const fetchCorrelations = async () => {
      const data = await server.fetchCorrelations({
        lab_prop_type: labOrigin,
        top_k: 10,
      });
      setLabProperties(data.results);
      setFetchedLabOrigin(labOrigin);
    };

    fetchCorrelations();
  }, [labOrigin]);

  // setCorrelations
  useEffect(() => {
    const result = labProperties?.find((d) => d.lab_prop_abr === labProperty);
    if (result) {
      setLabPropertyFull(result.lab_prop);
      const correlations = result.correlations.map((d) => ({ ...d }));
      correlations.forEach((d) => {
        const month = d.agg_time.split(
          "interval_from_the_begging_of_the_year_until_"
        )[1];
        d.agg_time = month.charAt(0).toUpperCase() + month.slice(1);
      });
      setCorrelation(null);
      setCorrelations(correlations);
    }
  }, [labProperties, labProperty]);

  // Order Fields
  useEffect(() => {
    if (correlation) {
      const sortFun = (a: Field, b: Field) => {
        const last_year = Math.max(
          ...Object.keys(a.results).map((y) => parseInt(y))
        );

        let a_value = a.results[last_year]?.find(
          (r) =>
            r.prop === correlation?.prop &&
            r.agg_time === correlation?.agg_time &&
            r.agg_value === correlation?.agg_value &&
            r.source === correlation?.source
        )?.value;
        let b_value = b.results[last_year]?.find(
          (r) =>
            r.prop === correlation?.prop &&
            r.agg_time === correlation?.agg_time &&
            r.agg_value === correlation?.agg_value &&
            r.source === correlation?.source
        )?.value;
        if (!a_value) return 1;
        if (!b_value) return -1;
        return Math.sign(correlation.value) * (b_value - a_value);
      };
      setOrderedFields([...fields].sort(sortFun));
    } else {
      setOrderedFields(fields);
    }
  }, [correlation, fields]);

  const handleOriginChange = (event: RadioChangeEvent) => {
    setLabOrigin(event.target.value);
  };

  const handlePropertyChange = (value: string) => {
    setLabProperty(value);
  };

  const handleChartClick = (name: string, corr: Correlation | null) => {
    setCorrelation(corr);
  };

  const overviewSelect = labProperties ? (
    <Select
      style={{ width: "100%" }}
      key="select"
      onChange={handlePropertyChange}
    >
      {labProperties.map((property) => {
        return (
          <Option key={property.lab_prop_abr} value={property.lab_prop_abr}>
            {property.lab_prop}
          </Option>
        );
      })}
    </Select>
  ) : (
    <Select style={{ width: "100%" }} defaultValue={""} key="no-select" />
  );

  const signalListeners = { click: handleChartClick };
  const overviewChart = correlations ? (
    <Vega
      style={{ width: "100%" }}
      spec={spec}
      data={{ correlations }}
      actions={false}
      signalListeners={signalListeners}
      key={labProperty + fetchedLabOrigin}
    />
  ) : (
    <Empty description="Select a Laboratory Property" />
  );

  const overviewFieldOrder = correlation ? (
    <h4>
      {`Ordered by their ${correlation.prop} (${correlation.agg_value}) until ${
        correlation.agg_time
      } (${correlation.value < 0 ? "ascending" : "descending"})`}
    </h4>
  ) : (
    <h4 style={{ opacity: 0.45 }}>
      Select a bar from the Correlation Results to order the fields.
    </h4>
  );

  const onClose = () => {
    setDrawerVisibility(false);
  };
  const showDrawer = (event: any) => {
    const id = event.target.getAttribute("data-field");
    const field = fields.find((d) => d["geocledian_Parcel ID"] === id);
    if (field) setDrawerField(field);
    setDrawerVisibility(true);
  };

  const renderListField = (field: Field) => {
    const origin_lab_results = field.lab_results.filter(
      (r) => r.lab_prop_type === labOrigin
    );
    const last_lab_year = Math.max(
      ...origin_lab_results.map((r) => Number(r.year))
    );
    let value = origin_lab_results
      .find((r) => Number(r.year) === last_lab_year)
      ?.results.find((r) => r.property === labPropertyFull)?.value;
    if (Number(value)) value = Number(value).toFixed(3);

    const description = labProperty
      ? `${labProperty} (${labOrigin}, ${last_lab_year}): ${value}`
      : "‎‎‏‏‎ ‎";

    const last_year = Math.max(
      ...Object.keys(field.results).map((y) => parseInt(y))
    );

    let agg_value = field.results[last_year]?.find(
      (r) =>
        r.prop === correlation?.prop &&
        r.agg_time === correlation?.agg_time &&
        r.agg_value === correlation?.agg_value &&
        r.source === correlation?.source
    )?.value;

    return (
      <List.Item
        key={field.Vineyard}
        actions={[
          <Button
            type="link"
            onClick={showDrawer}
            key={`a-${field.Vineyard}`}
            data-field={field["geocledian_Parcel ID"]}
          >
            View Details
          </Button>,
        ]}
      >
        <List.Item.Meta
          title={`${field.Vineyard} (${field.Variety})`}
          description={description}
        />
        {correlation ? (
          <div>{`${correlation.prop}: ${
            agg_value ? agg_value.toFixed(3) : "NA"
          }`}</div>
        ) : null}
      </List.Item>
    );
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header>
        <div className="logo"></div>
        <h1 style={{ color: "white" }}>
          Grapevine By-Products Biological Efficacy Predictor
        </h1>
      </Header>
      <Content
        style={{
          margin: "16px 16px",
          padding: 16,
          background: "#ececec",
        }}
      >
        <Row gutter={[48, 48]}>
          <Col span={8}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <h3>By-Product Process</h3>
              <Radio.Group
                defaultValue={labOrigin}
                onChange={handleOriginChange}
              >
                <Radio.Button value="maceration">Maceration</Radio.Button>
                <Radio.Button value="ultrasound">Ultrasound</Radio.Button>
              </Radio.Group>
              <h3>Laboratory Property</h3>
              {overviewSelect}
              <h3>Correlation Results</h3>
              {overviewChart}
            </Space>
          </Col>
          <Col span={14}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <h2>Fields</h2>
              {overviewFieldOrder}
              <List
                pagination={{
                  pageSize: 5,
                }}
                dataSource={orderedFields}
                bordered
                renderItem={renderListField}
              />
            </Space>
          </Col>
        </Row>
      </Content>
      <Drawer
        width={640}
        placement="right"
        closable={true}
        onClose={onClose}
        visible={drawerVisibility}
      >
        {drawerField ? (
          <DrawerContent
            field={drawerField}
            correlation={correlation}
            labProperty={labProperty}
            labPropertyFull={labPropertyFull}
            labOrigin={labOrigin}
          />
        ) : (
          <Empty />
        )}
      </Drawer>
    </Layout>
  );
};
