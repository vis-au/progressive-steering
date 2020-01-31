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

// WARN: must use window.eel to keep parse-able eel.expose{...}
window.eel.expose(sayHelloJS, 'say_hello_js');
window.eel.expose(sendDataToFrontend, 'send_data_to_frontend');