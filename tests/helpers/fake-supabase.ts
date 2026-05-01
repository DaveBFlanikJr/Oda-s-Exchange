type Row = Record<string, unknown>;

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type OrderBy = {
  field: string;
  ascending: boolean;
};

class FakeSupabaseQuery implements PromiseLike<QueryResult> {
  private filters: Array<(row: Row) => boolean> = [];
  private orders: OrderBy[] = [];
  private limitCount: number | null = null;
  private expectSingle = false;

  constructor(private readonly rows: readonly Row[]) {}

  select() {
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  in(field: string, values: readonly unknown[]) {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }

  not(field: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) {
      this.filters.push((row) => row[field] !== null && row[field] !== undefined);
      return this;
    }

    this.filters.push((row) => row[field] !== value);
    return this;
  }

  gte(field: string, value: string | number) {
    this.filters.push((row) => {
      const candidate = row[field];

      if (typeof candidate === "number" && typeof value === "number") {
        return candidate >= value;
      }

      return String(candidate) >= String(value);
    });
    return this;
  }

  order(field: string, options: { ascending: boolean }) {
    this.orders.push({ field, ascending: options.ascending });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.expectSingle = true;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): QueryResult {
    let rows = [...this.rows];

    for (const filter of this.filters) {
      rows = rows.filter(filter);
    }

    if (this.orders.length > 0) {
      rows.sort((left, right) => {
        for (const { field, ascending } of this.orders) {
          const leftValue = left[field];
          const rightValue = right[field];

          if (leftValue === rightValue) {
            continue;
          }

          const comparison =
            String(leftValue).localeCompare(String(rightValue), undefined, {
              numeric: true
            });

          if (comparison !== 0) {
            return ascending ? comparison : -comparison;
          }
        }

        return 0;
      });
    }

    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    return {
      data: this.expectSingle ? (rows[0] ?? null) : rows,
      error: null
    };
  }
}

export function createFakeSupabaseClient(
  tables: Record<string, readonly Row[]>
) {
  return {
    from(tableName: string) {
      return new FakeSupabaseQuery(tables[tableName] ?? []);
    }
  };
}
