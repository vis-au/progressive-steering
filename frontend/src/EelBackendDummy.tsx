import { setXName, sendXDomain, sendYDomain, sendDimensionTotalExtent, sendEvaluationMetric, sendCity, sendDataChunk, setMinSelectionSize, setYName } from "./EelBridge";

// interval in which new points are received should stay well above 0.2s, otherwise rendering times
// exceed the time to the next interval.
export const TOTAL_DURATION = 100000;
export const CHUNK_SIZE = 100;
export const DATA_EXTENT = 1.0;
export const DEFAULT_DIMENSIONS = ["a", "b", "c", "d", "e"];

export const DEFAULT_TOTAL_DATA_SIZE = 100000;
export const DEFAULT_EVALUATION_METRICS = ["recall", "precision"];

export const DEFAULT_POIS = [
  {lon: 540, lat: 100, label: "poi 1"},
  {lon: 200, lat: 300, label: "poi 2"},
  {lon: 360, lat: 250, label: "poi 3"},
  {lon: 276, lat: 400, label: "poi 4"},
  {lon: 344, lat: 100, label: "poi 5"}
];

function generateRandomData(chunkSize: number): any[] {
  const randomData: any[] = [];

  for (let i = 0; i < chunkSize; i++) {
    const randomEntry: any = {};

    randomEntry.id = `datum_${Math.floor(Math.random() * 100000000)}`;

    DEFAULT_DIMENSIONS.forEach(dimension => {
      randomEntry[dimension] = Math.random() * DATA_EXTENT;
    });

    randomData.push(randomEntry);
  }

  return randomData;
}

export function runDummyBackend() {
  // DEBUGGING: Generate random data after a fixed interval and send it to frontend
  let x = 0;
  const interval = window.setInterval(() => {
    const newData = generateRandomData(CHUNK_SIZE);
    sendDataChunk(newData);
    x++;
  }, TOTAL_DURATION / (DEFAULT_TOTAL_DATA_SIZE / CHUNK_SIZE));

  window.setTimeout(() => {
    window.clearInterval(interval);
    console.log(`Done rendering. Received ${x} of ${(DEFAULT_TOTAL_DATA_SIZE / CHUNK_SIZE)} chunks`);
  }, TOTAL_DURATION);

  window.setTimeout(() => {}, 0);

  window.setTimeout(() => {
    setXName("a");
    setYName("b");
  }, 0);

  window.setTimeout(() => {
    sendXDomain([0, 1]);
    sendYDomain([0, 1]);
  }, 0);

  window.setTimeout(() => {
    sendDimensionTotalExtent({
      name: "c", min: 0, max: 7.66
    });
  }, 0);

  window.setInterval(() => {
    sendEvaluationMetric({
      name: "precision", value: Math.floor(33 * Math.random()) / 100
    });
  }, 2200);

  window.setInterval(() => {
    sendEvaluationMetric({
      name: "recall", value: Math.floor(76 * Math.random()) / 100
    });
  }, 5403);

  window.setTimeout(() => {
    sendCity("Rome");
  }, 0);

  window.setTimeout(() => {
    setMinSelectionSize(100);
  }, 0);
}
