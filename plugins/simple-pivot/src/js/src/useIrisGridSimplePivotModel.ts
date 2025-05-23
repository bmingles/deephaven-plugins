import { type dh } from '@deephaven/jsapi-types';
import { useApi } from '@deephaven/jsapi-bootstrap';
import { useCallback, useEffect, useState } from 'react';
import { type IrisGridModel } from '@deephaven/iris-grid';
import IrisGridSimplePivotModel from './IrisGridSimplePivotModel';

import {
  type KeyColumnArray,
  type SimplePivotSchema,
} from './SimplePivotUtils';

export interface SimplePivotFetchResult {
  columnMap: KeyColumnArray;
  schema: SimplePivotSchema;
  table: dh.Table;
  keyTable: dh.Table;
  totalsTable: dh.Table | null;
  pivotWidget: dh.Widget;
}

export type IrisGridModelFetch = () => Promise<SimplePivotFetchResult>;

export type IrisGridModelFetchErrorResult = {
  error: NonNullable<unknown>;
  status: 'error';
};

export type IrisGridModelFetchLoadingResult = {
  status: 'loading';
};

export type IrisGridModelFetchSuccessResult = {
  status: 'success';
  model: IrisGridModel;
};

export type IrisGridModelFetchResult = (
  | IrisGridModelFetchErrorResult
  | IrisGridModelFetchLoadingResult
  | IrisGridModelFetchSuccessResult
) & {
  reload: () => void;
};

/** Pass in a table `fetch` function, will load the model and handle any errors */
export function useIrisGridSimplePivotModel(
  fetch: IrisGridModelFetch
): IrisGridModelFetchResult {
  const dh = useApi();
  const [model, setModel] = useState<IrisGridModel>();
  const [error, setError] = useState<unknown>();
  const [isLoading, setIsLoading] = useState(true);

  // Close the model when component is unmounted
  useEffect(
    () => () => {
      if (model) {
        model.close();
      }
    },
    [model]
  );

  const makeModel = useCallback(async () => {
    const { columnMap, keyTable, pivotWidget, schema, table, totalsTable } =
      await fetch();
    return new IrisGridSimplePivotModel(
      dh,
      table,
      keyTable,
      totalsTable,
      columnMap,
      schema,
      pivotWidget
    );
  }, [dh, fetch]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const newModel = await makeModel();
      setModel(newModel);
      setIsLoading(false);
    } catch (e) {
      setError(e);
      setIsLoading(false);
    }
  }, [makeModel]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setIsLoading(true);
      setError(undefined);
      try {
        const newModel = await makeModel();
        if (!cancelled) {
          setModel(newModel);
          setIsLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e);
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [makeModel]);

  if (isLoading) {
    return { reload, status: 'loading' };
  }
  if (error != null) {
    return { error, reload, status: 'error' };
  }
  if (model != null) {
    return { model, reload, status: 'success' };
  }
  throw new Error('Invalid state');
}
