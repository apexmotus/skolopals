/** Returned by a Manager's list method; `ResponseEnvelopeInterceptor` detects it with `instanceof` and emits the `{ data, meta }` shape (generic spec §7.3). */
export class PagedResult<T> {
  constructor(
    public readonly items: T[],
    public readonly page: number,
    public readonly pageSize: number,
    public readonly totalCount: number,
  ) {}

  get totalPages(): number {
    return this.pageSize > 0 ? Math.ceil(this.totalCount / this.pageSize) : 0;
  }
}
