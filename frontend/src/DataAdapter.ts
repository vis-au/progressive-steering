import { sendUserSelectionBounds, sendUserSelection } from "./EelBridge";

const ALL_DIMENSIONS = ["a", "b", "c", "d", "e"];
const X_DIMENSION = "a";
const Y_DIMENSION = "b";
const DATA_EXTENT = 1.0;

const TOTAL_DATA_SIZE = 1000;
const TOTAL_DURATION = 10000;
const CHUNK_SIZE = 10;

const DEFAULT_POIS = [
  {lon: 600, lat: 100, label: "poi 1"},
  {lon: 700, lat: 400, label: "poi 2"},
  {lon: 660, lat: 450, label: "poi 3"},
  {lon: 576, lat: 900, label: "poi 4"},
  {lon: 544, lat: 500, label: "poi 5"}
];

function generateRandomData(chunkSize: number): any[] {
  const randomData: any[] = [];

  for (let i = 0; i < chunkSize; i++) {
    const randomEntry: any = {};

    randomEntry.id = `datum_${Math.floor(Math.random() * 100000000)}`;

    ALL_DIMENSIONS.forEach(dimension => {
      randomEntry[dimension] = Math.random() * DATA_EXTENT;
    });

    randomData.push(randomEntry);
  }

  return randomData;
}

class DataAdapter {
  private _data: any[] = [];
  private _xDimension: string = "";
  private _yDimension: string = "";
  private _onDataChangedCallbacks: any[] = [];
  private _onFilterChangedCallbacks: any[] = [];

  private dimensionFilters: Map<string, number[]> = new Map();
  private dimensionExtents: Map<string, number[]> = new Map();

  constructor() {
    this._xDimension = X_DIMENSION;
    this._yDimension = Y_DIMENSION;
  }

  public addData(data: any[]) {
    this._data.push(...data);

    this._onDataChangedCallbacks.forEach(callback => {
      if (typeof callback !== "function") {
        return;
      }

      callback();
    });
  }

  public registerOnDataChanged(callback: any) {
    this._onDataChangedCallbacks.push(callback);
  }

  public registerOnFilterChanged(callback: any) {
    this._onFilterChangedCallbacks.push(callback);
  }

  /**
   * Set a filter for a numerical dimension of the data.
   * @param dimension dimension of the data
   * @param filter numerical extent to be included
   */
  public filterNumericalDimension(dimension: string, filter: number[]) {
    // TODO: send filters to backend

    this.dimensionFilters.set(dimension, filter);

    this._onFilterChangedCallbacks.forEach(callback => {
      if (typeof callback !== "function") {
        return;
      }

      callback({ dimension, filter });
    });
  }

  /**
   * Filter a categorical dimension by an element of its domain.
   * @param dimension categorical dimension of the data
   * @param filter element of that dimension
   */
  public filterCategoricalDimension(dimension: string, filter: string) {
    // TODO: notify backend about new selected filter (i.e. a new poi was selected on the map or a new city was chosen)
    return;
  }

  /**
   * Get the upper and lower value bounds for a particular numerical dimension in the data.
   * @param dimension dimension of the data
   */
  public getExtent(dimension: string) {
    return this.dimensionExtents.get(dimension) || [0, 1];
  }

  /**
   * Set the upper and lower value bounds for a particular numerical dimension in the data.
   * @param dimension dimension of the data
   * @param extent new upper and lower bound
   */
  public setExtent(dimension: string, extent: number[]) {
    this.dimensionExtents.set(dimension, extent);
  }

  public selectItems(items: any[]) {
    const selectedIds = items.map(d => d.id);
    sendUserSelection(selectedIds)
  }

  public selectRegion(region: number[][]) {
    const [[xMin, xMax], [yMin, yMax]] = region;
    sendUserSelectionBounds(xMin, xMax, yMin, yMax);
  }

  /**
   * Get the filters currently set for a particular dimension in the data.
   * @param dimension dimension of the data
   */
  public getFilters(dimension: string) {
    return this.dimensionFilters.get(dimension) || [];
  }

  public getAllFilters() {
    return this.dimensionFilters;
  }

  public getTotalDataSize() {
    return TOTAL_DATA_SIZE;
  }

  public get dimensions(): string[] {
    return ALL_DIMENSIONS;
  }

  public get xDimension(): string {
    return this._xDimension;
  }

  public set xDimension(xDimension: string) {
    this._xDimension = xDimension;
  }

  public get yDimension(): string {
    return this._yDimension;
  }

  public set yDimension(yDimension: string) {
    this._yDimension = yDimension;
  }

  public get data(): any[] { return this._data; }
}

export type EelDataAdapter = DataAdapter;

const instance = new DataAdapter();

export function getEelDataAdapter() {
  return instance;
}

export function getPOIs() {
  return DEFAULT_POIS;
}

// DEBUGGING: Generate random data after a fixed interval and add it to the datamanager
const interval = window.setInterval(() => {
  const newData = generateRandomData(CHUNK_SIZE);
  instance.addData(newData);
}, TOTAL_DURATION / (TOTAL_DATA_SIZE / CHUNK_SIZE));


window.setTimeout(() => {
  window.clearInterval(interval);
}, TOTAL_DURATION);