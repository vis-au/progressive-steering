const ALL_DIMENSIONS = ["a", "b", "c", "d", "e"];
const X_DIMENSION = "a";
const X_EXTENT = 2.0;
const Y_DIMENSION = "b";
const Y_EXTENT = 2.0;

const TOTAL_DATA_SIZE = 1000;
const TOTAL_DURATION = 10000;
const CHUNK_SIZE = 10;

function generateRandomData(chunkSize: number): any[] {
  const randomData: any[] = [];

  for (let i = 0; i < chunkSize; i++) {
    const randomEntry: any = {};

    randomEntry[X_DIMENSION] = Math.random() * X_EXTENT;
    randomEntry[Y_DIMENSION] = Math.random() * Y_EXTENT;
    randomEntry.id = `datum_${Math.floor(Math.random() * 100000000)}`;

    randomData.push(randomEntry);
  }

  return randomData;
}

class EelDataManagerSingleton {
  private _data: any[] = [];
  private _onDataChangedCallbacks: any[] = [];

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
   * Returns an array of size two, representing the range of values of a given dimension across the
   * data. Returns [], if the given dimension is not defined in the data or the data is empty.
   * @param dimension
   */
  public getExtent(dimension: string) {
    if (this._data.length === 0) {
      return [];
    }
    if (this._data[0][dimension] === undefined) {
      return [];
    }

    return [0, X_EXTENT];
  }

  public getTotalDataSize() {
    return TOTAL_DATA_SIZE;
  }

  public get dimensions(): string[] {
    return ALL_DIMENSIONS;
  }

  public get xDimension(): string {
    return X_DIMENSION;
  }

  public get yDimension(): string {
    return Y_DIMENSION;
  }

  public get data(): any[] { return this._data; }
}

export type EelDataManager = EelDataManagerSingleton;

const instance = new EelDataManagerSingleton();

const interval = window.setInterval(() => {
  const newData = generateRandomData(CHUNK_SIZE);
  instance.addData(newData);
}, TOTAL_DURATION / (TOTAL_DATA_SIZE / CHUNK_SIZE));


window.setTimeout(() => {
  window.clearInterval(interval);
}, TOTAL_DURATION);


export function getEelDataManager() {
  return instance;
}