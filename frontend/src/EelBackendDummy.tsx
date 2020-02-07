import { getEelDataAdapter, DEFAULT_TOTAL_DATA_SIZE } from "./DataAdapter"
import { setXName, setYName, sendXDomain, sendYDomain, sendDimensionTotalExtent, sendEvaluationMetric, sendCity, sendDataChunk, setMinSelectionSize } from "./EelBridge";

// interval in which new points are received should stay well above 0.2s, otherwise rendering times
// exceed the time to the next interval.
const TOTAL_DURATION = 1000;
const CHUNK_SIZE = 100;
const DATA_EXTENT = 1.0;

const dataAdapter = getEelDataAdapter();


function generateRandomData(chunkSize: number): any[] {
  const randomData: any[] = [];

  for (let i = 0; i < chunkSize; i++) {
    const randomEntry: any = {};

    randomEntry.id = `datum_${Math.floor(Math.random() * 100000000)}`;

    dataAdapter.dimensions.forEach(dimension => {
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
