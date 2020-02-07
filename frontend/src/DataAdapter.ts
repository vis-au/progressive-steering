import { sendUserSelectionBounds, sendUserSelection } from "./EelBridge";
import * as d3 from 'd3';

export const DEFAULT_DIMENSIONS = ["a", "b", "c", "d", "e"];
export const DEFAULT_TOTAL_DATA_SIZE = 100000;

export const DEFAULT_POIS = [
  {lon: 540, lat: 100, label: "poi 1"},
  {lon: 200, lat: 300, label: "poi 2"},
  {lon: 360, lat: 250, label: "poi 3"},
  {lon: 276, lat: 400, label: "poi 4"},
  {lon: 344, lat: 100, label: "poi 5"}
];

class DataAdapter {
  private _data: any[] = [];
  private _dimensions: string[] = [];
  private _xDimension: string | null = null;
  private _yDimension: string | null = null;
  private _onDataChangedCallbacks: any[] = [];
  private _onFilterChangedCallbacks: any[] = [];
  private _chunkSize: number = 0;

  private dimensionFilters: Map<string, number[]> = new Map();
  private dimensionExtents: Map<string, number[]> = new Map();

  constructor() {
    this._dimensions = DEFAULT_DIMENSIONS;
  }

  public addData(data: any[]) {
    if (this._dimensions.length === 0) {
      this._dimensions = Object.keys(data[0]);
    }

    this._chunkSize = data.length;
    this._data.push(...data);
    this.notifyDataObservers();
  }

  public subscribeOnDataChanged(callback: any) {
    this._onDataChangedCallbacks.push(callback);
  }

  public subscribeOnFilterChanged(callback: any) {
    this._onFilterChangedCallbacks.push(callback);
  }

  private notifyObservers(observerList: any[], message?: any) {
    observerList.forEach(callback => {
      if (typeof callback !== "function") {
        return;
      }

      callback(message);
    });
  }

  private notifyFilterObservers(message?: any) {
    this.notifyObservers(this._onFilterChangedCallbacks, message);
  }

  private notifyDataObservers(message?: any) {
    this.notifyObservers(this._onDataChangedCallbacks, message);
  }

  /**
   * Set a filter for a numerical dimension of the data.
   * @param dimension dimension of the data
   * @param filter numerical extent to be included
   */
  public filterNumericalDimension(dimension: string, filter: number[]) {
    // TODO: send filters to backend

    this.dimensionFilters.set(dimension, filter);
    this.notifyFilterObservers({ dimension, filter });
  }

  /**
   * Filter a categorical dimension by an element of its domain.
   * @param dimension categorical dimension of the data
   * @param filter element of that dimension
   */
  public filterCategoricalDimension(dimension: string, filter: string) {
    // TODO: notify backend about new selected filter (i.e. a new poi was selected on the map or a new city was chosen)
    this.notifyFilterObservers({ dimension, filter });
    return;
  }

  /**
   * Get the upper and lower value bounds for a particular numerical dimension in the data.
   * @param dimension dimension of the data
   */
  public getExtent(dimension: string | null) {
    if (dimension === null) {
      return [0, 1];
    }

    return this.dimensionExtents.get(dimension) || [0, 1];
  }

  /**
   * Set the upper and lower value bounds for a particular numerical dimension in the data.
   * @param dimension dimension of the data
   * @param extent new upper and lower bound
   */
  public setExtent(dimension: string, extent: number[]) {
    this.dimensionExtents.set(dimension, extent.slice());
    this.notifyDataObservers();
  }

  /**
   * Computes the histogram for a dimension in the data. Is not progressive.
   * @param dimension dimension of the data
   */
  public getHistogram(dimension: string | null) {
    if (dimension === null) {
      return;
    }
    const histogramGenerator = d3.histogram()
      .value((d: any) => d[dimension]);

    const histogram: d3.Bin<number, number>[] = histogramGenerator(this._data);
    const values = histogram.map(bin => bin.length);

    return values;
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
    return DEFAULT_TOTAL_DATA_SIZE;
  }

  public get dimensions(): string[] {
    return this._dimensions;
  }

  public set dimensions(dimensions: string[]) {
    this._dimensions = dimensions;
  }

  public get xDimension(): string | null {
    return this._xDimension;
  }

  public set xDimension(xDimension: string | null) {
    this._xDimension = xDimension;
  }

  public get yDimension(): string | null {
    return this._yDimension;
  }

  public set yDimension(yDimension: string | null) {
    this._yDimension = yDimension;
  }

  public get chunkSize(): number {
    return this._chunkSize;
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
