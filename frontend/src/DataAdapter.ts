const ALL_DIMENSIONS = ["a", "b", "c", "d", "e"];
const X_DIMENSION = "a";
const Y_DIMENSION = "b";
const DATA_EXTENT = 1.0;

const TOTAL_DATA_SIZE = 1000;
const TOTAL_DURATION = 10000;
const CHUNK_SIZE = 10;

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
  private _onDataChangedCallbacks: any[] = [];
  private _xDimension: string = "";
  private _yDimension: string = "";

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

  public filterDimension(dimension: string, filter: number[]) {
    // TODO
  }

  /**
   * Get the upper and lower value bounds for a particular dimension in the data.
   * @param dimension dimension of the data
   */
  public getExtent(dimension: string) {
    return this.dimensionExtents.get(dimension) || [0, 1];
  }

  /**
   * Set the upper and lower value bounds for a particular dimension in the data.
   * @param dimension dimension of the data
   * @param extent new upper and lower bound
   */
  public setExtent(dimension: string, extent: number[]) {
    this.dimensionExtents.set(dimension, extent);
  }

  /**
   * Get the filters currently set for a particular dimension in the data.
   * @param dimension dimension of the data
   */
  public getFilters(dimension: string) {
    return this.dimensionFilters.get(dimension) || [];
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

// DEBUGGING: Generate random data after a fixed interval and add it to the datamanager
const interval = window.setInterval(() => {
  const newData = generateRandomData(CHUNK_SIZE);
  instance.addData(newData);
}, TOTAL_DURATION / (TOTAL_DATA_SIZE / CHUNK_SIZE));


window.setTimeout(() => {
  window.clearInterval(interval);
}, TOTAL_DURATION);