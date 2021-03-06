const fetch = require("isomorphic-unfetch");
const MAX_CHART_VALUES = 48;
const FETCH_INTERVAL = 1000 * 60 * 60; // 60 min

const store = {
  chartData: [],
  price: null
};

async function getPrice(type = "buy", currency = "usd") {
  const res = await fetch(
    `https://localbitcoins.com/${type}-bitcoins-online/${currency}/.json`
  );
  const data = await res.json();

  const prices = data.data.ad_list.map(({ data }) => Number(data.temp_price));
  const filteredPrices = filterOutliers(prices);
  const avg =
    filteredPrices.reduce((avg, price) => price + avg, 0) /
    filteredPrices.length;

  return avg;
}

function filterOutliers(prices) {
  //copy array fast and sort
  const values = [...prices].sort((a, b) => a - b);

  /* Then find a generous IQR. This is generous because if (values.length * 0.25)
  * is not an int, then really you should average the two elements on either
  * side to find q1.
  */
  const q1 = values[Math.floor(values.length * 0.35)];
  // Likewise for q3.
  const q3 = values[Math.ceil(values.length * 0.65)];
  const iqr = q3 - q1;

  // Then find min and max values
  const maxValue = q3 + iqr * 1.0;
  const minValue = q1 - iqr * 1.0;

  // console.log({
  //   q1,
  //   q3,
  //   maxValue,
  //   minValue,
  //   mean: values[Math.floor(values.length / 2)]
  // });
  return values.filter(v => {
    const filter = v >= minValue && v <= maxValue;
    // console.log(v, filter);
    return filter;
  });
}

async function getInitialData() {
  try {
    const res = await fetch(`https://sober-ano.com/api/ves-usd`);
    const { price, chartData } = await res.json();
    store.price = price;
    store.chartData = chartData;
  } catch (error) {
    console.error(error);
  }
}

async function startFetcher() {
  await getInitialData();
  setTimeout(() => startFetcher(), FETCH_INTERVAL);

  const results = await Promise.all([
    getPrice("buy", "ves"),
    getPrice("buy", "usd")
  ]);
  store.price = results[1] > 0 ? results[0] / results[1] : undefined;
  store.chartData.push([new Date().valueOf(), store.price]);

  if (store.chartData.length > MAX_CHART_VALUES) {
    store.chartData = store.chartData.slice(
      store.chartData.length - MAX_CHART_VALUES
    );
  }
}

startFetcher();

module.exports = () => store;
