import { getEelDataManager } from './EelData';

// Point Eel web socket to the instance
export const eel = window.eel

eel.set_host( 'ws://localhost:8080' );

const dataManager = getEelDataManager();


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

export function sendDataChunk(chunk: any[]) {
  return;
}

export function sendXDomain(extent: number[]) {
  const [xMin, xMax] = extent;
  return;
}

export function sendYDomain(extent: number[]) {
  const [yMin, yMax] = extent;
  return;
}


export function setXName(xName: string) {
  return;
}

export function setYName(yName: string) {
  return;
}

export function setMinSelectionSize(minSelectionSize: number) {
  return;
}

export function sendDimensionTotalExtent(message: {name: string, min: number, max: number}) {
  const {name, min, max} = message;
  return;
}

export function sendCity(city: string) {
  return;
}

export function sendEvaluationMetric(message: {name: string, value: number}) {
  return;
}


window.eel.expose(sayHelloJS, 'say_hello_js');
window.eel.expose(sendDataToFrontend, 'send_data_to_frontend');

window.eel.expose(sendDataChunk, 'send_data_chunk');
window.eel.expose(sendXDomain, 'send_x_domain');
window.eel.expose(sendYDomain, 'send_y_domain');
window.eel.expose(setXName, 'set_x_name');
window.eel.expose(setYName, 'set_y_name');
window.eel.expose(setMinSelectionSize, 'set_min_selection_size');
window.eel.expose(sendDimensionTotalExtent, 'send_dimension_total_extent');
window.eel.expose(sendCity, 'send_city');
window.eel.expose(sendEvaluationMetric, 'send_evaluation_metric');
