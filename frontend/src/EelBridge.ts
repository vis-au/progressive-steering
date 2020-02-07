import { getEelDataAdapter } from './DataAdapter';
import { runDummyBackend } from './EelBackendDummy';

// Point Eel web socket to the instance
export const eel = window.eel
eel.set_host( 'ws://localhost:8080' );

// datamanger is a singleton instance that we reference from different places in the bridge
// functions
const dataAdapter = getEelDataAdapter();

/**
 * Send a chunk of data of variable size to the frontend.
 * @param chunk contains arbitrary data
 */
export function sendDataChunk(chunk: any[]) {
  dataAdapter.addData(chunk);
}

/**
 * Send the extent of the dimension mapped to the horizontal axis to the frontend.
 * @param extent minimum and maximum value for the dimension represented on the x axis.
 */
export function sendXDomain(extent: [number, number]) {
  const xDomain = dataAdapter.xDimension;

  if (xDomain === null) {
    return;
  }

  dataAdapter.setDomain(xDomain, extent);
}

/**
 * Send the extent of the dimension mapped to the vertical axis to the frontend.
 * @param extent minimum and maximum value for the dimension represented on the y axis.
 */
export function sendYDomain(extent: [number, number]) {
  const yDomain = dataAdapter.yDimension;

  if (yDomain === null) {
    return;
  }

  dataAdapter.setDomain(yDomain, extent);
}

/**
 * Send the lower and upper value bounds for a particular dimension of the data to the frontend.
 * @param message containing the name and extent of a dimension in the data
 */
export function sendDimensionTotalExtent(message: {name: string, min: number, max: number}) {
  const {name, min, max} = message;
  dataAdapter.setDomain(name, [min, max]);
  return;
}

/**
 * Sends the name of the dimension mapped to the horizontal axis to the frontend.
 * @param xName name of the x dimension
 */
export function setXName(xName: string) {
  dataAdapter.xDimension = xName;
  return;
}

/**
 * Send the name of the dimension mapped to the vertical axis to the frontend.
 * @param yName name of the y dimension
 */
export function setYName(yName: string) {
  dataAdapter.yDimension = yName;
}

/**
 * Send the current value of an evaluation metric to the fronted.
 * @param message name and value of an evaluation metric
 */
export function sendEvaluationMetric(message: {name: string, value: number}) {
  dataAdapter.setEvaluationMetric(message.name, message.value);
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

export function sendUserSelection(ids: string[]) {
  window.eel.send_user_selection(ids);
}

export function sendUserSelectionBounds(xMin: number, xMax: number, yMin: number, yMax: number) {
  window.eel.send_selection_bounds({xMin, xMax}, {yMin, yMax});
}

export function sendUserParameters(parameters: {name: string, type: string, interval: [number, number] | string}[]) {
  window.eel.send_user_params(parameters);
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


runDummyBackend();

// LEGACY FUNCTIONS FOR DEBUGGING
// Expose the `sayHelloJS` function to Python as `say_hello_js`
export function sayHelloJS( x: any ) {
  console.log( 'Hello from ' + x );
}

export function sendDataToFrontend(data: any) {
  if (!data.length) {
    dataAdapter.addData(data as any);
  } else {
    (data as any[]).forEach(d => dataAdapter.addData(d));
  }
}

window.eel.expose(sayHelloJS, 'say_hello_js');
window.eel.expose(sendDataToFrontend, 'send_data_to_frontend');