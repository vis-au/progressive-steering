import { getEelDataManager } from './EelData';

// Point Eel web socket to the instance
export const eel = window.eel
eel.set_host( 'ws://localhost:8080' );

// datamanger is a singleton instance that we reference from different places in the bridge
// functions
const dataManager = getEelDataManager();

/**
 * Send a chunk of data of variable size to the frontend.
 * @param chunk contains arbitrary data
 */
export function sendDataChunk(chunk: any[]) {
  dataManager.addData(chunk);
}

/**
 * Send the extent of the dimension mapped to the horizontal axis to the frontend.
 * @param extent minimum and maximum value for the dimension represented on the x axis.
 */
export function sendXDomain(extent: number[]) {
  const xDomain = dataManager.xDimension;
  dataManager.dimensionExtents.set(xDomain, extent);
}

/**
 * Send the extent of the dimension mapped to the vertical axis to the frontend.
 * @param extent minimum and maximum value for the dimension represented on the y axis.
 */
export function sendYDomain(extent: number[]) {
  const yDomain = dataManager.yDimension;
  dataManager.dimensionExtents.set(yDomain, extent);
}

/**
 * Send the lower and upper value bounds for a particular dimension of the data to the frontend.
 * @param message containing the name and extent of a dimension in the data
 */
export function sendDimensionTotalExtent(message: {name: string, min: number, max: number}) {
  const {name, min, max} = message;
  dataManager.dimensionExtents.set(name, [min, max]);
  return;
}

/**
 * Sends the name of the dimension mapped to the horizontal axis to the frontend.
 * @param xName name of the x dimension
 */
export function setXName(xName: string) {
  dataManager.xDimension = xName;
  return;
}

/**
 * Send the name of the dimension mapped to the vertical axis to the frontend.
 * @param yName name of the y dimension
 */
export function setYName(yName: string) {
  dataManager.yDimension = yName;
}

/**
 * Send the current value of an evaluation metric to the fronted.
 * @param message name and value of an evaluation metric
 */
export function sendEvaluationMetric(message: {name: string, value: number}) {
  return;
}

/**
 * Send the name of the city represented by the data and map to the fronted.
 * @param city name of the city
 */
export function sendCity(city: string) {
  return;
}

/**
 * Send the minimum number of points that must be contained in a selection to the frontend.
 * @param minSelectionSize minimum number of data poits to be contained in a filter selection.
 */
export function setMinSelectionSize(minSelectionSize: number) {
  return;
}


// Make functions acessible to the backend via eel
window.eel.expose(sendDataChunk, 'send_data_chunk');
window.eel.expose(sendXDomain, 'send_x_domain');
window.eel.expose(sendYDomain, 'send_y_domain');
window.eel.expose(setXName, 'set_x_name');
window.eel.expose(setYName, 'set_y_name');
window.eel.expose(setMinSelectionSize, 'set_min_selection_size');
window.eel.expose(sendDimensionTotalExtent, 'send_dimension_total_extent');
window.eel.expose(sendCity, 'send_city');
window.eel.expose(sendEvaluationMetric, 'send_evaluation_metric');


// LEGACY FUNCTIONS FOR DEBUGGING
// Expose the `sayHelloJS` function to Python as `say_hello_js`
export function sayHelloJS( x: any ) {
  console.log( 'Hello from ' + x );
}

export function sendDataToFrontend(data: any) {
  if (!data.length) {
    dataManager.addData(data as any);
  } else {
    (data as any[]).forEach(d => dataManager.addData(d));
  }
}

window.eel.expose(sayHelloJS, 'say_hello_js');
window.eel.expose(sendDataToFrontend, 'send_data_to_frontend');