import { sendUserSelectionBounds, sendUserSelection, sendUserParameters, SelectionSize, ScenarioPreset, ProgressionState, sendProgressionState, TrainingState } from "./EelBridge";
import * as d3 from 'd3';
import { DEFAULT_TOTAL_DATA_SIZE, DEFAULT_POIS } from "./EelBackendDummy";

class DataAdapter {
  private _chunkSize: number = 0;
  private _progressionState: ProgressionState = 'running';
  private _trainingState: TrainingState = "collectingData";
  private _data: any[] = [];
  private _nonSteeringData: any[] = [];
  private _cumulativeDataSize: number[] = [0];
  private _dimensions: string[] = [];
  private _onDataChangedCallbacks: any[] = [];
  private _onFilterChangedCallbacks: any[] = [];
  private _onMetricChangedCallbacks: any[] = [];
  private _scenarioPresets: ScenarioPreset[] = [];
  private _allItemsInSelection: any[] = [];
  private _allNonSteeredItemsInSelection: any[] = [];
  private _trainingStateHistory: TrainingState[] = [];

  private dimensionFilters: Map<string, [number, number]> = new Map();
  private dimensionExtents: Map<string, [number, number]> = new Map();
  private evaluationMetrics: Map<string, number[]> = new Map();

  private unloadBuffer: boolean = false;

  private _selectionSize: SelectionSize = {
    min: 0,
    max: 1,
    name: "distance"
  };

  public addData(data: any[]) {
    if (this._dimensions.length === 0) {
      this._dimensions = Object.keys(data[0]).filter(d => d !== "id");
    }

    if (this.progressionState === 'running') {
      if (this.unloadBuffer) {
        this._chunkSize += data.length;
      } else {
        this._chunkSize = data.length;
      }
      this._data.push(...data);
      this._trainingStateHistory.push(this._trainingState);
      this.notifyDataObservers();
    } else if (this.progressionState === 'paused') {
      this._chunkSize += data.length;
      this._data.push(...data);
      this._trainingStateHistory.push(this._trainingState);
    }

    const lastLength = this._cumulativeDataSize[this._cumulativeDataSize.length - 1];
    this._cumulativeDataSize.push(data.length + lastLength);
  }

  public addNonSteeringData(data: any[]) {
    this._nonSteeringData.push(...data);
    this.notifyDataObservers();
  }

  public subscribeOnDataChanged(callback: any) {
    this._onDataChangedCallbacks.push(callback);
  }

  public subscribeOnFilterChanged(callback: any) {
    this._onFilterChangedCallbacks.push(callback);
  }

  public subscribeOnMetricChanged(callback: any) {
    this._onMetricChangedCallbacks.push(callback);
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

  private notifyMetricObservers(message?: any) {
    this.notifyObservers(this._onMetricChangedCallbacks, message);
  }

  /**
   * Set a filter for a numerical dimension of the data.
   * @param dimension dimension of the data
   * @param filter numerical extent to be included
   */
  public filterNumericalDimension(dimension: string, filter: [number, number]) {
    this.dimensionFilters.set(dimension, filter);
    this.notifyFilterObservers({ dimension, filter });

    sendUserParameters([{
      name: dimension,
      type: "numerical",
      interval: filter
    }]);
  }

  /**
   * Filter a categorical dimension by an element of its domain.
   * @param dimension categorical dimension of the data
   * @param filter element of that dimension
   */
  public filterCategoricalDimension(dimension: string, filter: string) {
    this.notifyFilterObservers({ dimension, filter });

    sendUserParameters([{
      name: dimension,
      type: "categorical",
      interval: filter
    }]);
  }

  /**
   * Get the upper and lower value bounds for a particular numerical dimension in the data.
   * @param dimension dimension of the data
   */
  public getDomain(dimension: string | null): [number, number] {
    if (dimension === null) {
      return [0, 1];
    }

    return this.dimensionExtents.get(dimension) || [0, 1];
  }

  /**
   * Set the domain bounds for a particular numerical dimension in the data.
   * @param dimension dimension of the data
   * @param extent new upper and lower bound
   */
  public setDomain(dimension: string, extent: [number, number]) {
    this.dimensionExtents.set(dimension, extent);
    this.notifyDataObservers();
  }

  private getPaddedSelectedBins(histogramGenerator: d3.HistogramGeneratorNumber<number, number>, thresholds: number[]) {

    const selectedHistogramGenerator = d3.histogram()
      .domain(histogramGenerator.domain())
      .thresholds(histogramGenerator.thresholds() as any)
      .value(histogramGenerator.value());

    const selectedHistogram = selectedHistogramGenerator(this._allItemsInSelection);
    const selectedHistogramPadded = thresholds.map(x0 => {
      const bin = selectedHistogram.find(d => d.x0 === x0);

      if (bin === undefined) {
        return [];
      }

      return bin;
    });

    const paddedBins = selectedHistogramPadded.map(d => d.length);
    return paddedBins;
  }

  /**
   * Computes the histogram for a dimension in the data. Is not progressive.
   * @param dimension dimension of the data
   */
  public getHistogram(dimension: string | null, onlySelected: boolean = false) {
    if (dimension === null) {
      return;
    }
    const histogramGenerator = d3.histogram()
      .domain(this.dimensionExtents.get(dimension) || [0, 1])
      .value((d: any) => d[dimension]);

    let histogram: d3.Bin<number, number>[] | null = null;

    histogram = histogramGenerator(this._data);

    if (onlySelected) {
      const thresholds = histogram.map(bin => bin.x0 || -1);
      const paddedSelectedBins = this.getPaddedSelectedBins(histogramGenerator, thresholds);
      return paddedSelectedBins;
    }

    const bins = histogram.map(bin => bin.length);
    return bins;
  }

  public getEvaluationMetric(label: string) {
    return this.evaluationMetrics.get(label) || [];
  }

  public setEvaluationMetric(label: string, value: number) {
    let currentValues = this.evaluationMetrics.get(label) || [];
    currentValues.push(value);
    this.evaluationMetrics.set(label, currentValues);
    this.notifyMetricObservers();
  }

  public selectItems(items: any[]) {
    const selectedIds = items.map(d => d.id);
    sendUserSelection(selectedIds)
  }

  public updateAllSelectedItems(allSelectedItems: any[]) {
    this._allItemsInSelection = allSelectedItems;
  }

  public updateAllSelectedNonSteeredItems(allSelectedNonSteeredItems: any[]) {
    this._allNonSteeredItemsInSelection = allSelectedNonSteeredItems;
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
    if (this._dimensions.length < 1) {
      return null;
    }

    return this._dimensions[0];
  }

  public set xDimension(xDimension: string | null) {
    if (xDimension === null) {
      return;
    }

    const indexInDimensions = this._dimensions.indexOf(xDimension);
    if (indexInDimensions === -1) {
      return;
    }

    this._dimensions.splice(indexInDimensions, 1);
    this._dimensions.splice(0, 0, xDimension);
  }

  public get yDimension(): string | null {
    if (this._dimensions.length < 2) {
      return null;
    }

    return this.dimensions[1];
  }

  public set yDimension(yDimension: string | null) {
    if (yDimension === null) {
      return;
    }

    const indexInDimensions = this._dimensions.indexOf(yDimension);
    if (indexInDimensions === -1) {
      return;
    }

    this._dimensions.splice(indexInDimensions, 1);
    this._dimensions.splice(1, 0, yDimension);
  }

  public get chunkSize(): number {
    return this._chunkSize;
  }

  public set progressionState(newState: ProgressionState) {
    console.log("changed progression state:", newState);
    this._progressionState = newState;
    sendProgressionState(newState);
  }

  public get progressionState(): ProgressionState {
    return this._progressionState;
  }

  public set trainingState(newState: TrainingState) {
    this._trainingState = newState;
  }

  public get trainingState(): TrainingState {
    return this._trainingState;
  }

  public get trainingStateHistory(): TrainingState[] {
    return this._trainingStateHistory;
  }

  public get data(): any[] { return this._data; }

  public get nonSteeringData(): any[] { return this._nonSteeringData; }

  public get cumulativeDataSize(): number[] { return this._cumulativeDataSize; }

  public get minSelectionSize(): SelectionSize {
    return this._selectionSize;
  }

  public set minSelectionSize(minSelectionSize: SelectionSize) {
    console.log("new selection size received:", minSelectionSize)
    this._selectionSize = minSelectionSize;
  }

  public get allItemsInSelection(): any[] {
    return this._allItemsInSelection;
  }

  public get allNonSteeredItemsInSelection(): any[] {
    return this._allNonSteeredItemsInSelection;
  }

  public set scenarioPresets(presets: ScenarioPreset[]) {
    this._scenarioPresets = presets;
  }

  public get scenarioPresets(): ScenarioPreset[] {
    return this._scenarioPresets;
  }
}

export type EelDataAdapter = DataAdapter;

const instance = new DataAdapter();

export function getEelDataAdapter() {
  return instance;
}

export function getPOIs() {
  return DEFAULT_POIS;
}
